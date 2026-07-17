use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// One persisted chat message. `error` marks assistant turns that ended in a
/// stream failure so the UI can restyle them and exclude them from history.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredMessage {
    /// "message" (default, legacy files omit it) | "toolCall" | "permission".
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub content: String,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub error: bool,
    /// When the message was created (ms since epoch). 0 for conversations
    /// written before messages carried timestamps — the UI hides the age then.
    #[serde(default)]
    pub created_at: u64,
    // --- kind == "toolCall" ---
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_args: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_output: Option<String>,
    // --- kind == "permission" ---
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision: Option<String>,
}

fn default_kind() -> String {
    "message".into()
}

/// A full conversation as stored on disk: one JSON file per conversation
/// under `app_data_dir()/conversations/{id}.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub updated_at: u64,
    #[serde(default)]
    pub messages: Vec<StoredMessage>,
    /// Agent profile bound to this conversation ("" = default assistant).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub agent_id: String,
    /// User-picked workspace folder ("" = virtual workspace).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub workspace: String,
}

/// Listing entry: everything the sidebar needs without loading messages.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationMeta {
    pub id: String,
    pub title: String,
    pub updated_at: u64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// IDs come from the frontend (UUID v4); reject anything that could escape
/// the conversations directory when used as a file name.
fn validate_id(id: &str) -> Result<(), String> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-');
    if ok {
        Ok(())
    } else {
        Err("非法的会话 ID".into())
    }
}

fn conversations_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位数据目录：{e}"))?
        .join("conversations");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建会话目录失败：{e}"))?;
    Ok(dir)
}

fn conversation_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    validate_id(id)?;
    Ok(conversations_dir(app)?.join(format!("{id}.json")))
}

#[tauri::command]
pub fn list_conversations(app: AppHandle) -> Result<Vec<ConversationMeta>, String> {
    let dir = conversations_dir(&app)?;
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("读取会话目录失败：{e}"))?;

    let mut metas: Vec<ConversationMeta> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        // Skip unreadable/corrupted files instead of failing the whole list.
        let Ok(raw) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(conv) = serde_json::from_str::<Conversation>(&raw) else {
            continue;
        };
        metas.push(ConversationMeta {
            id: conv.id,
            title: conv.title,
            updated_at: conv.updated_at,
        });
    }
    metas.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(metas)
}

#[tauri::command]
pub fn load_conversation(app: AppHandle, id: String) -> Result<Conversation, String> {
    let path = conversation_path(&app, &id)?;
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取会话失败：{e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("会话文件损坏：{e}"))
}

/// Persist a conversation; the timestamp is stamped server-side so ordering
/// stays consistent. Returns the new `updated_at` for the frontend cache.
#[tauri::command]
pub fn save_conversation(app: AppHandle, mut conversation: Conversation) -> Result<u64, String> {
    let path = conversation_path(&app, &conversation.id)?;
    if conversation.title.trim().is_empty() {
        conversation.title = "新对话".into();
    }
    conversation.updated_at = now_ms();
    let raw = serde_json::to_string_pretty(&conversation).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw).map_err(|e| format!("写入会话失败：{e}"))?;
    Ok(conversation.updated_at)
}

#[tauri::command]
pub fn delete_conversation(app: AppHandle, id: String) -> Result<(), String> {
    let path = conversation_path(&app, &id)?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("删除会话失败：{e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_id_accepts_uuid() {
        assert!(validate_id("3fa85f64-5717-4562-b3fc-2c963f66afa6").is_ok());
    }

    #[test]
    fn validate_id_rejects_path_escapes() {
        assert!(validate_id("").is_err());
        assert!(validate_id("../evil").is_err());
        assert!(validate_id("a/b").is_err());
        assert!(validate_id("a\\b").is_err());
        assert!(validate_id("a.b").is_err());
        assert!(validate_id(&"x".repeat(65)).is_err());
    }

    /// Conversations written before timestamps existed must still load.
    #[test]
    fn stored_message_created_at_defaults_for_legacy_data() {
        let json = r#"{"role":"user","content":"你好"}"#;
        let msg: StoredMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg.created_at, 0);
        assert_eq!(msg.kind, "message");

        let json = r#"{"role":"user","content":"你好","createdAt":1784110000000}"#;
        let msg: StoredMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg.created_at, 1_784_110_000_000);
    }

    #[test]
    fn stored_message_error_flag_roundtrips_and_defaults() {
        let json = r#"{"role":"assistant","content":"hi"}"#;
        let msg: StoredMessage = serde_json::from_str(json).unwrap();
        assert!(!msg.error);
        // `error: false` is omitted on write to keep files tidy.
        let out = serde_json::to_string(&msg).unwrap();
        assert!(!out.contains("error"));
    }

    #[test]
    fn tool_call_messages_roundtrip() {
        let json = r#"{"kind":"toolCall","toolName":"read_file","toolCallId":"c1","toolArgs":{"path":"a.txt"},"toolOutput":"hello","createdAt":1}"#;
        let msg: StoredMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg.kind, "toolCall");
        assert_eq!(msg.tool_name.as_deref(), Some("read_file"));
        let out = serde_json::to_string(&msg).unwrap();
        assert!(out.contains("\"toolName\":\"read_file\""));
        // Optional fields stay omitted for plain messages.
        let plain: StoredMessage = serde_json::from_str(r#"{"role":"user","content":"hi"}"#).unwrap();
        let out = serde_json::to_string(&plain).unwrap();
        assert!(!out.contains("toolName"));
    }
}
