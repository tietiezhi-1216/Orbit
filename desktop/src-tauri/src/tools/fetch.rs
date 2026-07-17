use serde_json::Value;

use super::{str_arg, ToolCtx};

const MAX_BODY_BYTES: usize = 5 * 1024 * 1024;
const TIMEOUT_SECS: u64 = 30;

pub async fn fetch_tool(ctx: &ToolCtx, args: &Value) -> Result<String, String> {
    let url = str_arg(args, "url")?.trim().to_string();
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("只支持 http/https URL".into());
    }

    let req = ctx
        .http
        .get(&url)
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECS));

    let resp = tokio::select! {
        _ = ctx.cancel.cancelled() => return Err("请求已被用户取消".into()),
        r = req.send() => r.map_err(|e| format!("请求失败：{e}"))?,
    };

    let status = resp.status();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取响应失败：{e}"))?;
    let body = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_BODY_BYTES)]).into_owned();
    if status.is_success() {
        Ok(body)
    } else {
        Err(format!(
            "HTTP {}：{}",
            status.as_u16(),
            crate::commands::snippet(&body)
        ))
    }
}
