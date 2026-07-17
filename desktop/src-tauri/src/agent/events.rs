use serde::Serialize;
use serde_json::Value;

/// Events streamed to the frontend over the tauri IPC channel. Tag values are
/// camelCase, which keeps the original lowercase `delta`/`done`/`error`
/// spelling intact for existing consumers (dictation polish).
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ChatEvent {
    Started {
        model: String,
    },
    Delta {
        content: String,
    },
    Usage {
        prompt_tokens: u64,
        completion_tokens: u64,
        total_tokens: u64,
    },
    ToolCallStart {
        id: String,
        name: String,
        args: Value,
    },
    ToolResult {
        id: String,
        output: String,
        is_error: bool,
    },
    PermissionRequest {
        id: String,
        tool: String,
        description: String,
        args: Value,
    },
    Retrying {
        attempt: u8,
        max_retries: u8,
        delay_ms: u64,
        reason: String,
    },
    Done {
        cancelled: bool,
    },
    Error {
        message: String,
        detail: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<u16>,
        retryable: bool,
        retries: u8,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn legacy_tags_unchanged() {
        let v = serde_json::to_value(ChatEvent::Delta {
            content: "x".into(),
        })
        .unwrap();
        assert_eq!(v, json!({"type":"delta","content":"x"}));
        let v = serde_json::to_value(ChatEvent::Done { cancelled: false }).unwrap();
        assert_eq!(v, json!({"type":"done","cancelled":false}));
    }

    #[test]
    fn new_tags_are_camel_case() {
        let v = serde_json::to_value(ChatEvent::Usage {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
        })
        .unwrap();
        assert_eq!(
            v,
            json!({"type":"usage","promptTokens":12,"completionTokens":8,"totalTokens":20})
        );

        let v = serde_json::to_value(ChatEvent::ToolResult {
            id: "1".into(),
            output: "ok".into(),
            is_error: false,
        })
        .unwrap();
        assert_eq!(
            v,
            json!({"type":"toolResult","id":"1","output":"ok","isError":false})
        );

        let v = serde_json::to_value(ChatEvent::Retrying {
            attempt: 2,
            max_retries: 5,
            delay_ms: 1_600,
            reason: "服务暂时不可用（503）".into(),
        })
        .unwrap();
        assert_eq!(
            v,
            json!({
                "type":"retrying",
                "attempt":2,
                "maxRetries":5,
                "delayMs":1600,
                "reason":"服务暂时不可用（503）"
            })
        );
    }
}
