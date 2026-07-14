use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::State;

use super::{api_url, snippet};
use crate::{secrets, AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionResult {
    pub models: Vec<String>,
}

#[derive(Deserialize)]
struct ModelsResponse {
    #[serde(default)]
    data: Vec<ModelEntry>,
}

#[derive(Deserialize)]
struct ModelEntry {
    id: String,
}

/// Probe `GET /v1/models` to verify the relay endpoint and credentials.
/// `api_key` overrides the stored key so users can test before saving.
#[tauri::command]
pub async fn test_connection(
    state: State<'_, AppState>,
    base_url: String,
    api_key: Option<String>,
) -> Result<ConnectionResult, String> {
    let base = base_url.trim();
    if base.is_empty() {
        return Err("请先填写中转站 baseURL".into());
    }
    if !base.starts_with("http://") && !base.starts_with("https://") {
        return Err("baseURL 需以 http:// 或 https:// 开头".into());
    }

    let key = match api_key
        .map(|k| k.trim().to_owned())
        .filter(|k| !k.is_empty())
    {
        Some(k) => Some(k),
        None => secrets::get_api_key()?,
    };

    let mut req = state
        .http
        .get(api_url(base, "models"))
        .timeout(Duration::from_secs(15));
    if let Some(key) = &key {
        req = req.bearer_auth(key);
    }

    let resp = req.send().await.map_err(|e| format!("无法连接中转站：{e}"))?;
    let status = resp.status();
    let body = resp.text().await.map_err(|e| format!("读取响应失败：{e}"))?;
    if !status.is_success() {
        return Err(format!(
            "中转站返回 HTTP {}：{}",
            status.as_u16(),
            snippet(&body)
        ));
    }

    let parsed: ModelsResponse = serde_json::from_str(&body)
        .map_err(|_| format!("响应不是合法的模型列表：{}", snippet(&body)))?;
    let mut models: Vec<String> = parsed.data.into_iter().map(|m| m.id).collect();
    models.sort();
    models.dedup();
    Ok(ConnectionResult { models })
}
