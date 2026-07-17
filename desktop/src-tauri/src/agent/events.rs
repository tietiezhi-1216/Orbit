use serde::Serialize;
use serde_json::Value;

/// Events streamed to the frontend over the tauri IPC channel. Tag values are
/// camelCase, which keeps the original lowercase `delta`/`done`/`error`
/// spelling intact for existing consumers (dictation polish).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ChatEvent {
    Delta {
        content: String,
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
    Done {
        cancelled: bool,
    },
    Error {
        message: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn legacy_tags_unchanged() {
        let v = serde_json::to_value(ChatEvent::Delta { content: "x".into() }).unwrap();
        assert_eq!(v, json!({"type":"delta","content":"x"}));
        let v = serde_json::to_value(ChatEvent::Done { cancelled: false }).unwrap();
        assert_eq!(v, json!({"type":"done","cancelled":false}));
    }

    #[test]
    fn new_tags_are_camel_case() {
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
    }
}
