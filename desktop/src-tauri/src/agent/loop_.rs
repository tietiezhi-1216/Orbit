use std::collections::BTreeMap;
use std::path::PathBuf;

use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::ipc::Channel;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use super::events::ChatEvent;
use super::failure::{retry_delay_ms, ChatFailure, MAX_RETRIES};
use crate::commands::api_url;
use crate::commands::models::{
    ModelCapability, ModelInfo, ReasoningEffort, ReasoningMode, ReasoningProfile,
    ReasoningTransport,
};
use crate::mcp::{self, McpManager, McpServerConfig};
use crate::permission::{needs_approval, Decision, PermissionBroker, PermissionMode};
use crate::tools::{self, ToolCtx};

pub const MAX_ITERATIONS: usize = 50;

/// The fully-resolved execution environment for one agent chat turn.
pub struct AgentEnv {
    pub system_prompt: String,
    pub allowed_tools: Vec<String>,
    pub available_skills: Vec<String>,
    pub permission_mode: PermissionMode,
    pub mcp_configs: Vec<McpServerConfig>,
    pub workspace: PathBuf,
}

/// One fully-accumulated tool call out of the stream.
#[derive(Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

impl ToolCall {
    pub fn parsed_args(&self) -> Value {
        serde_json::from_str(&self.arguments)
            .unwrap_or_else(|_| Value::String(self.arguments.clone()))
    }
}

// ---- SSE chunk shapes ------------------------------------------------------

#[derive(Deserialize)]
struct StreamChunk {
    #[serde(default)]
    choices: Vec<StreamChoice>,
    #[serde(default)]
    usage: Option<StreamUsage>,
}

#[derive(Deserialize)]
struct StreamUsage {
    #[serde(default)]
    prompt_tokens: u64,
    #[serde(default)]
    completion_tokens: u64,
    #[serde(default)]
    total_tokens: u64,
    /// OpenAI-standard cache reporting: `prompt_tokens_details.cached_tokens`.
    #[serde(default)]
    prompt_tokens_details: Option<PromptTokensDetails>,
    /// DeepSeek-style cache reporting: cache-hit prompt tokens.
    #[serde(default)]
    prompt_cache_hit_tokens: Option<u64>,
}

impl StreamUsage {
    /// Prompt tokens billed from cache, normalized across the OpenAI and
    /// DeepSeek shapes (0 when the provider reports neither).
    fn cached_tokens(&self) -> u64 {
        self.prompt_tokens_details
            .as_ref()
            .map(|d| d.cached_tokens)
            .filter(|&c| c > 0)
            .or(self.prompt_cache_hit_tokens)
            .unwrap_or(0)
    }
}

#[derive(Deserialize)]
struct PromptTokensDetails {
    #[serde(default)]
    cached_tokens: u64,
}

#[derive(Deserialize)]
struct StreamChoice {
    #[serde(default)]
    delta: StreamDelta,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Deserialize, Default)]
struct StreamDelta {
    #[serde(default)]
    content: Option<String>,
    // Reasoning models stream their chain-of-thought here: `reasoning_content`
    // (DeepSeek and most OpenAI-compatible relays) or `reasoning` (OpenRouter).
    #[serde(default)]
    reasoning_content: Option<String>,
    #[serde(default)]
    reasoning: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<ToolCallDelta>>,
}

#[derive(Deserialize)]
struct ToolCallDelta {
    #[serde(default)]
    index: Option<u32>,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    function: Option<FunctionDelta>,
}

#[derive(Deserialize, Default)]
struct FunctionDelta {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<String>,
}

/// Accumulates streamed tool-call deltas keyed by index. Handles both
/// fragmented arguments (OpenAI) and whole-call-in-one-delta relays.
#[derive(Default)]
pub struct ToolCallAccumulator {
    calls: BTreeMap<u32, ToolCall>,
    next_implicit_index: u32,
}

impl ToolCallAccumulator {
    fn push(&mut self, delta: ToolCallDelta) {
        let index = delta.index.unwrap_or_else(|| {
            // Some relays omit index; a delta carrying an id starts a new call.
            if delta.id.is_some() && !self.calls.is_empty() {
                self.next_implicit_index += 1;
            }
            self.next_implicit_index
        });
        let entry = self.calls.entry(index).or_insert_with(|| ToolCall {
            id: String::new(),
            name: String::new(),
            arguments: String::new(),
        });
        if let Some(id) = delta.id {
            if !id.is_empty() {
                entry.id = id;
            }
        }
        if let Some(f) = delta.function {
            if let Some(name) = f.name {
                if !name.is_empty() {
                    entry.name = name;
                }
            }
            if let Some(args) = f.arguments {
                entry.arguments.push_str(&args);
            }
        }
    }

    fn finish(self) -> Vec<ToolCall> {
        self.calls
            .into_values()
            .enumerate()
            .map(|(i, mut c)| {
                if c.id.is_empty() {
                    c.id = format!("call_{i}");
                }
                c
            })
            .filter(|c| !c.name.is_empty())
            .collect()
    }
}

struct StreamOutcome {
    text: String,
    tool_calls: Vec<ToolCall>,
    cancelled: bool,
}

/// One streamed chat/completions round: emits text deltas, accumulates tool
/// calls, returns both.
async fn stream_once(
    http: &reqwest::Client,
    base_url: &str,
    api_key: Option<&str>,
    model: &str,
    transcript: &[Value],
    tools: &[Value],
    reasoning: Option<&ReasoningProfile>,
    reasoning_effort: ReasoningEffort,
    cancel: &CancellationToken,
    on_event: &Channel<ChatEvent>,
) -> Result<StreamOutcome, ChatFailure> {
    let mut body = json!({
        "model": model,
        "messages": transcript,
        "stream": true,
        "stream_options": {"include_usage": true},
    });
    if !tools.is_empty() {
        body["tools"] = Value::Array(tools.to_vec());
    }
    apply_reasoning(&mut body, reasoning, reasoning_effort);

    let mut req = http.post(api_url(base_url, "chat/completions")).json(&body);
    if let Some(key) = api_key {
        req = req.bearer_auth(key);
    }

    let resp = tokio::select! {
        _ = cancel.cancelled() => return Ok(StreamOutcome { text: String::new(), tool_calls: vec![], cancelled: true }),
        r = req.send() => r.map_err(ChatFailure::request)?,
    };

    let status = resp.status();
    if !status.is_success() {
        let retry_after_ms = resp
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<u64>().ok())
            .map(|seconds| seconds.saturating_mul(1_000));
        let body = resp.text().await.unwrap_or_default();
        return Err(ChatFailure::http(status, body, retry_after_ms));
    }

    let mut stream = resp.bytes_stream();
    let mut lines = crate::commands::chat::SseLineBuffer::default();
    let mut text = String::new();
    let mut acc = ToolCallAccumulator::default();

    'outer: loop {
        let chunk = tokio::select! {
            _ = cancel.cancelled() => return Ok(StreamOutcome { text, tool_calls: vec![], cancelled: true }),
            c = stream.next() => c,
        };
        let Some(chunk) = chunk else { break };
        let chunk = chunk.map_err(|error| ChatFailure::stream(error, !text.is_empty()))?;

        for line in lines.push(&chunk) {
            let Some(data) = crate::commands::chat::sse_data(&line) else {
                continue;
            };
            if data == "[DONE]" {
                break 'outer;
            }
            let Ok(parsed) = serde_json::from_str::<StreamChunk>(data) else {
                continue;
            };
            if let Some(usage) = parsed.usage {
                let total_tokens = if usage.total_tokens == 0 {
                    usage.prompt_tokens + usage.completion_tokens
                } else {
                    usage.total_tokens
                };
                if total_tokens > 0 {
                    on_event
                        .send(ChatEvent::Usage {
                            prompt_tokens: usage.prompt_tokens,
                            completion_tokens: usage.completion_tokens,
                            total_tokens,
                            cached_tokens: usage.cached_tokens(),
                        })
                        .map_err(|e| ChatFailure::channel(format!("推送消息到界面失败：{e}")))?;
                }
            }
            for choice in parsed.choices {
                // Reasoning first (it precedes the answer), forwarded as its own
                // event so it never mixes into `text`/the transcript replayed to
                // the model.
                if let Some(reasoning) = choice.delta.reasoning_content.or(choice.delta.reasoning) {
                    if !reasoning.is_empty() {
                        on_event
                            .send(ChatEvent::Reasoning { content: reasoning })
                            .map_err(|e| {
                                ChatFailure::channel(format!("推送消息到界面失败：{e}"))
                            })?;
                    }
                }
                if let Some(content) = choice.delta.content {
                    if !content.is_empty() {
                        text.push_str(&content);
                        on_event.send(ChatEvent::Delta { content }).map_err(|e| {
                            ChatFailure::channel(format!("推送消息到界面失败：{e}"))
                        })?;
                    }
                }
                if let Some(deltas) = choice.delta.tool_calls {
                    for d in deltas {
                        acc.push(d);
                    }
                }
                let _ = choice.finish_reason;
            }
        }
    }

    Ok(StreamOutcome {
        text,
        tool_calls: acc.finish(),
        cancelled: false,
    })
}

fn apply_reasoning(
    body: &mut Value,
    profile: Option<&ReasoningProfile>,
    selected: ReasoningEffort,
) {
    let Some(profile) = profile else { return };
    if profile.mode == ReasoningMode::Fixed || selected == ReasoningEffort::Auto {
        return;
    }
    if !profile.supported_efforts.is_empty() && !profile.supported_efforts.contains(&selected) {
        return;
    }

    match profile.transport {
        ReasoningTransport::None => {}
        ReasoningTransport::OpenaiReasoningEffort => {
            if let Some(value) = selected.as_wire_value() {
                body["reasoning_effort"] = Value::String(value.into());
            }
        }
        ReasoningTransport::OpenrouterReasoning => {
            if let Some(value) = selected.as_wire_value() {
                body["reasoning"] = json!({"effort": value});
            }
        }
        ReasoningTransport::EnableThinking => {
            body["enable_thinking"] = Value::Bool(selected != ReasoningEffort::Off);
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn stream_with_retries(
    http: &reqwest::Client,
    base_url: &str,
    api_key: Option<&str>,
    model: &str,
    transcript: &[Value],
    tools: &[Value],
    reasoning: Option<&ReasoningProfile>,
    reasoning_effort: ReasoningEffort,
    cancel: &CancellationToken,
    on_event: &Channel<ChatEvent>,
) -> Result<StreamOutcome, ChatFailure> {
    let mut retries = 0;
    loop {
        match stream_once(
            http,
            base_url,
            api_key,
            model,
            transcript,
            tools,
            reasoning,
            reasoning_effort,
            cancel,
            on_event,
        )
        .await
        {
            Ok(outcome) => return Ok(outcome),
            Err(failure)
                if failure.retryable && !failure.output_started && retries < MAX_RETRIES =>
            {
                retries += 1;
                let delay_ms = retry_delay_ms(retries, failure.retry_after_ms);
                on_event
                    .send(ChatEvent::Retrying {
                        attempt: retries,
                        max_retries: MAX_RETRIES,
                        delay_ms,
                        reason: failure.retry_reason().into(),
                    })
                    .map_err(|e| ChatFailure::channel(format!("推送重试状态到界面失败：{e}")))?;
                tokio::select! {
                    _ = cancel.cancelled() => {
                        return Ok(StreamOutcome {
                            text: String::new(),
                            tool_calls: vec![],
                            cancelled: true,
                        });
                    }
                    _ = tokio::time::sleep(std::time::Duration::from_millis(delay_ms)) => {}
                }
            }
            Err(failure) => return Err(failure.with_retries(retries)),
        }
    }
}

fn permission_description(name: &str, args: &Value) -> String {
    match name {
        "bash" => args
            .get("command")
            .and_then(Value::as_str)
            .map(|c| format!("执行命令：{c}"))
            .unwrap_or_else(|| "执行命令".into()),
        "write_file" => args
            .get("path")
            .and_then(Value::as_str)
            .map(|p| format!("写入文件：{p}"))
            .unwrap_or_else(|| "写入文件".into()),
        "edit_file" => args
            .get("path")
            .and_then(Value::as_str)
            .map(|p| format!("编辑文件：{p}"))
            .unwrap_or_else(|| "编辑文件".into()),
        other => format!("调用工具：{other}"),
    }
}

/// The tool-calling agent loop. Returns `Ok(true)` when cancelled by the user.
#[allow(clippy::too_many_arguments)]
pub async fn run_agent_loop(
    app: &AppHandle,
    http: &reqwest::Client,
    broker: &PermissionBroker,
    mcp_manager: &McpManager,
    request_id: u32,
    base_url: &str,
    api_key: Option<&str>,
    model: &str,
    model_info: Option<&ModelInfo>,
    reasoning_effort: ReasoningEffort,
    messages: Vec<crate::commands::chat::ChatMessage>,
    env: AgentEnv,
    cancel: &CancellationToken,
    on_event: &Channel<ChatEvent>,
) -> Result<bool, ChatFailure> {
    // MCP is a client-side bridge implemented through native function calling.
    // Unknown and explicitly unsupported models run as plain chat instead of
    // receiving a request body they may reject with HTTP 400.
    let supports_tools =
        model_info.is_some_and(|model| model.has_capability(ModelCapability::ToolCall));
    let mut tool_specs = if supports_tools {
        tools::specs(&env.allowed_tools, &env.available_skills)
    } else {
        Vec::new()
    };
    if supports_tools {
        for cfg in &env.mcp_configs {
            match mcp_manager.list_tools(cfg).await {
                Ok(list) => {
                    for t in list {
                        tool_specs.push(json!({
                            "type": "function",
                            "function": {
                                "name": mcp::namespaced(&cfg.id, &t.name),
                                "description": t.description,
                                "parameters": t.input_schema,
                            }
                        }));
                    }
                }
                // A dead MCP server shouldn't kill the chat; surface in status.
                Err(e) => eprintln!("[mcp] {}: {e}", cfg.name),
            }
        }
    }

    let system_prompt = if supports_tools {
        env.system_prompt.clone()
    } else {
        format!(
            "{}\n\n# 工具限制\n当前模型未声明原生工具调用能力。本轮没有可调用的内置工具或 MCP 工具；不要声称已经读取、执行或修改了本地内容。",
            env.system_prompt
        )
    };
    let mut transcript: Vec<Value> = Vec::with_capacity(messages.len() + 1);
    transcript.push(json!({"role": "system", "content": system_prompt}));
    for m in &messages {
        transcript.push(json!({"role": m.role, "content": m.content}));
    }

    let ctx = ToolCtx {
        app: app.clone(),
        http: http.clone(),
        workspace: env.workspace.clone(),
        available_skills: env.available_skills.clone(),
        cancel: cancel.clone(),
    };

    for _ in 0..MAX_ITERATIONS {
        let outcome = stream_with_retries(
            http,
            base_url,
            api_key,
            model,
            &transcript,
            &tool_specs,
            model_info.and_then(ModelInfo::effective_reasoning),
            reasoning_effort,
            cancel,
            on_event,
        )
        .await?;
        if outcome.cancelled {
            return Ok(true);
        }
        if outcome.tool_calls.is_empty() {
            return Ok(false);
        }

        transcript.push(json!({
            "role": "assistant",
            "content": outcome.text,
            "tool_calls": outcome.tool_calls.iter().map(|c| json!({
                "id": c.id,
                "type": "function",
                "function": {"name": c.name, "arguments": c.arguments},
            })).collect::<Vec<_>>(),
        }));

        for call in &outcome.tool_calls {
            if cancel.is_cancelled() {
                return Ok(true);
            }
            let args = call.parsed_args();
            on_event
                .send(ChatEvent::ToolCallStart {
                    id: call.id.clone(),
                    name: call.name.clone(),
                    args: args.clone(),
                })
                .map_err(|e| ChatFailure::channel(format!("推送消息到界面失败：{e}")))?;

            // Permission gate.
            let mut allowed = true;
            if !broker.is_session_allowed(request_id, &call.name)
                && needs_approval(env.permission_mode, &call.name, &args, &env.workspace)
            {
                let perm_id = uuid::Uuid::new_v4().to_string();
                let rx = broker.register(&perm_id);
                on_event
                    .send(ChatEvent::PermissionRequest {
                        id: perm_id.clone(),
                        tool: call.name.clone(),
                        description: permission_description(&call.name, &args),
                        args: args.clone(),
                    })
                    .map_err(|e| ChatFailure::channel(format!("推送消息到界面失败：{e}")))?;
                match broker.wait(&perm_id, rx, cancel).await {
                    Decision::Allow => {}
                    Decision::AllowAlways => broker.allow_for_session(request_id, &call.name),
                    Decision::Deny => allowed = false,
                }
                if cancel.is_cancelled() {
                    return Ok(true);
                }
            }

            let (output, is_error) = if !allowed {
                ("用户拒绝了此操作".to_string(), true)
            } else if let Some((server_id, tool)) = mcp::parse_namespaced(&call.name) {
                match env.mcp_configs.iter().find(|c| c.id == server_id) {
                    Some(cfg) => match mcp_manager.call_tool(cfg, tool, &args).await {
                        Ok((out, err)) => (tools::truncate_output(&out), err),
                        Err(e) => (e, true),
                    },
                    None => (format!("未知的 MCP 服务器：{server_id}"), true),
                }
            } else {
                match tools::run(&call.name, &args, &ctx).await {
                    Ok(out) => (out, false),
                    Err(e) => (e, true),
                }
            };

            on_event
                .send(ChatEvent::ToolResult {
                    id: call.id.clone(),
                    output: output.clone(),
                    is_error,
                })
                .map_err(|e| ChatFailure::channel(format!("推送消息到界面失败：{e}")))?;

            transcript.push(json!({
                "role": "tool",
                "tool_call_id": call.id,
                "content": output,
            }));
        }
    }
    Err(ChatFailure::message(format!(
        "已达到最大工具调用轮数（{MAX_ITERATIONS}），请新建任务继续"
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn delta(
        index: Option<u32>,
        id: Option<&str>,
        name: Option<&str>,
        args: Option<&str>,
    ) -> ToolCallDelta {
        ToolCallDelta {
            index,
            id: id.map(Into::into),
            function: Some(FunctionDelta {
                name: name.map(Into::into),
                arguments: args.map(Into::into),
            }),
        }
    }

    fn usage(json: &str) -> StreamUsage {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn cached_tokens_reads_openai_and_deepseek_shapes() {
        // OpenAI-standard nested shape.
        assert_eq!(
            usage(r#"{"prompt_tokens":100,"prompt_tokens_details":{"cached_tokens":40}}"#)
                .cached_tokens(),
            40
        );
        // DeepSeek flat shape.
        assert_eq!(
            usage(r#"{"prompt_tokens":100,"prompt_cache_hit_tokens":24}"#).cached_tokens(),
            24
        );
        // Neither reported → 0, and a zero nested value doesn't mask nothing.
        assert_eq!(usage(r#"{"prompt_tokens":100}"#).cached_tokens(), 0);
        assert_eq!(
            usage(r#"{"prompt_tokens":100,"prompt_tokens_details":{"cached_tokens":0}}"#)
                .cached_tokens(),
            0
        );
    }

    #[test]
    fn accumulator_joins_fragmented_arguments() {
        let mut acc = ToolCallAccumulator::default();
        acc.push(delta(
            Some(0),
            Some("call_a"),
            Some("read_file"),
            Some("{\"pa"),
        ));
        acc.push(delta(Some(0), None, None, Some("th\":\"a.txt\"}")));
        let calls = acc.finish();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "read_file");
        assert_eq!(calls[0].arguments, "{\"path\":\"a.txt\"}");
        assert_eq!(calls[0].parsed_args()["path"], "a.txt");
    }

    #[test]
    fn accumulator_handles_multiple_and_single_chunk_calls() {
        let mut acc = ToolCallAccumulator::default();
        acc.push(delta(Some(0), Some("a"), Some("t1"), Some("{}")));
        acc.push(delta(Some(1), Some("b"), Some("t2"), Some("{\"x\":1}")));
        let calls = acc.finish();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[1].name, "t2");
    }

    #[test]
    fn accumulator_synthesizes_missing_index_and_id() {
        let mut acc = ToolCallAccumulator::default();
        acc.push(delta(None, Some("x"), Some("t1"), Some("{}")));
        acc.push(delta(None, Some("y"), Some("t2"), Some("{}")));
        let calls = acc.finish();
        assert_eq!(calls.len(), 2);

        let mut acc = ToolCallAccumulator::default();
        acc.push(delta(Some(0), None, Some("t"), Some("{}")));
        let calls = acc.finish();
        assert_eq!(calls[0].id, "call_0");
    }

    #[test]
    fn accumulator_drops_nameless_noise() {
        let mut acc = ToolCallAccumulator::default();
        acc.push(delta(Some(0), None, None, Some("junk")));
        assert!(acc.finish().is_empty());
    }

    fn adjustable_reasoning(transport: ReasoningTransport) -> ReasoningProfile {
        ReasoningProfile {
            mode: ReasoningMode::Effort,
            supported_efforts: vec![ReasoningEffort::Low, ReasoningEffort::High],
            default_effort: Some(ReasoningEffort::High),
            transport,
        }
    }

    #[test]
    fn reasoning_effort_is_added_only_when_supported() {
        let mut body = json!({"model": "test"});
        apply_reasoning(
            &mut body,
            Some(&adjustable_reasoning(
                ReasoningTransport::OpenaiReasoningEffort,
            )),
            ReasoningEffort::High,
        );
        assert_eq!(body["reasoning_effort"], "high");

        let mut unsupported = json!({"model": "test"});
        apply_reasoning(
            &mut unsupported,
            Some(&adjustable_reasoning(
                ReasoningTransport::OpenaiReasoningEffort,
            )),
            ReasoningEffort::Medium,
        );
        assert!(unsupported.get("reasoning_effort").is_none());
    }

    #[test]
    fn auto_reasoning_leaves_provider_default_untouched() {
        let mut body = json!({"model": "test"});
        apply_reasoning(
            &mut body,
            Some(&adjustable_reasoning(
                ReasoningTransport::OpenrouterReasoning,
            )),
            ReasoningEffort::Auto,
        );
        assert!(body.get("reasoning").is_none());
    }
}
