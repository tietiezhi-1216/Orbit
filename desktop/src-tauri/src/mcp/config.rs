use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// One configured MCP server. Lives inside `AppSettings.mcp_servers`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub transport: McpTransport,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum McpTransport {
    Stdio {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        env: HashMap<String, String>,
    },
    Http {
        url: String,
        #[serde(default)]
        headers: HashMap<String, String>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transport_roundtrips() {
        let json = r#"{"id":"s1","name":"fs","transport":{"kind":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem"]}}"#;
        let cfg: McpServerConfig = serde_json::from_str(json).unwrap();
        assert!(cfg.enabled);
        assert!(matches!(cfg.transport, McpTransport::Stdio { .. }));

        let json = r#"{"id":"s2","name":"web","enabled":false,"transport":{"kind":"http","url":"https://x/mcp","headers":{"Authorization":"Bearer t"}}}"#;
        let cfg: McpServerConfig = serde_json::from_str(json).unwrap();
        assert!(!cfg.enabled);
        assert!(matches!(cfg.transport, McpTransport::Http { .. }));
    }
}
