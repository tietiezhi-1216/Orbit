use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use serde_json::Value;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

/// Per-agent permission mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionMode {
    /// Every mutating operation needs frontend approval.
    Ask,
    /// Smart review: reads auto-allow, writes inside the workspace allow,
    /// dangerous bash commands ask.
    Auto,
    /// Everything allowed.
    Full,
}

impl PermissionMode {
    pub fn parse(s: &str) -> Self {
        match s {
            "full" => Self::Full,
            "ask" => Self::Ask,
            _ => Self::Auto,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    Allow,
    AllowAlways,
    Deny,
}

impl Decision {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "allow" => Some(Self::Allow),
            "allowAlways" => Some(Self::AllowAlways),
            "deny" => Some(Self::Deny),
            _ => None,
        }
    }
}

/// Routes permission answers from the `permission_respond` command back to the
/// agent loop blocked inside `wait`. `allowAlways` grants are cached per chat
/// request id + tool name, i.e. for the rest of that streaming session.
#[derive(Default)]
pub struct PermissionBroker {
    pending: Mutex<HashMap<String, oneshot::Sender<Decision>>>,
    session_allows: Mutex<HashMap<u32, HashSet<String>>>,
}

const WAIT_TIMEOUT: Duration = Duration::from_secs(300);

impl PermissionBroker {
    pub fn register(&self, id: &str) -> oneshot::Receiver<Decision> {
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap().insert(id.to_string(), tx);
        rx
    }

    pub fn respond(&self, id: &str, decision: Decision) -> Result<(), String> {
        match self.pending.lock().unwrap().remove(id) {
            Some(tx) => {
                let _ = tx.send(decision);
                Ok(())
            }
            // Late/duplicate answers are harmless.
            None => Ok(()),
        }
    }

    pub fn is_session_allowed(&self, request_id: u32, tool: &str) -> bool {
        self.session_allows
            .lock()
            .unwrap()
            .get(&request_id)
            .map(|s| s.contains(tool))
            .unwrap_or(false)
    }

    pub fn allow_for_session(&self, request_id: u32, tool: &str) {
        self.session_allows
            .lock()
            .unwrap()
            .entry(request_id)
            .or_default()
            .insert(tool.to_string());
    }

    pub fn end_session(&self, request_id: u32) {
        self.session_allows.lock().unwrap().remove(&request_id);
    }

    /// Block until the frontend answers, the stream is cancelled, or the wait
    /// times out (treated as deny). Cleans the pending entry on every path.
    pub async fn wait(
        &self,
        id: &str,
        rx: oneshot::Receiver<Decision>,
        cancel: &CancellationToken,
    ) -> Decision {
        let decision = tokio::select! {
            d = rx => d.unwrap_or(Decision::Deny),
            _ = cancel.cancelled() => Decision::Deny,
            _ = tokio::time::sleep(WAIT_TIMEOUT) => Decision::Deny,
        };
        self.pending.lock().unwrap().remove(id);
        decision
    }
}

/// Whether a tool call needs approval under the given mode. Returns `false`
/// when the call may proceed directly.
pub fn needs_approval(
    mode: PermissionMode,
    tool: &str,
    args: &Value,
    workspace: &Path,
) -> bool {
    match mode {
        PermissionMode::Full => false,
        PermissionMode::Ask => !crate::tools::is_read_only(tool),
        PermissionMode::Auto => match tool {
            "bash" => args
                .get("command")
                .and_then(Value::as_str)
                .map(|c| is_dangerous_command(c, workspace))
                .unwrap_or(true),
            // Writes are already jailed to the workspace by path resolution,
            // so in auto mode they may proceed.
            "write_file" | "edit_file" => false,
            _ if crate::tools::is_read_only(tool) => false,
            // Unknown (MCP) tools: ask to be safe.
            _ => true,
        },
    }
}

/// Heuristics for bash commands that warrant a human look even in auto mode.
fn is_dangerous_command(command: &str, workspace: &Path) -> bool {
    let lower = command.to_lowercase();
    const PATTERNS: &[&str] = &[
        "rm -rf",
        "rm -fr",
        "sudo ",
        "chmod ",
        "chown ",
        "mkfs",
        "dd if",
        "> /dev/",
        "curl ",
        "wget ",
        "git push",
        "shutdown",
        "reboot",
        "kill ",
        "killall",
        "launchctl",
        "diskutil",
        ":(){",
    ];
    if PATTERNS.iter().any(|p| lower.contains(p)) {
        return true;
    }
    // Absolute paths outside the workspace or parent-dir traversal.
    if lower.contains("..") {
        return true;
    }
    let ws = workspace.to_string_lossy().to_lowercase();
    for token in lower.split_whitespace() {
        let t = token.trim_matches(|c| c == '"' || c == '\'');
        if (t.starts_with('/') || (cfg!(windows) && t.len() > 2 && &t[1..3] == ":\\"))
            && !t.starts_with(&ws)
            && !t.starts_with("/dev/null")
            && !t.starts_with("/usr/bin")
            && !t.starts_with("/bin")
        {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;

    fn ws() -> PathBuf {
        PathBuf::from("/tmp/ws")
    }

    #[test]
    fn full_mode_allows_everything() {
        assert!(!needs_approval(PermissionMode::Full, "bash", &json!({"command":"rm -rf /"}), &ws()));
    }

    #[test]
    fn ask_mode_gates_mutations_but_not_reads() {
        assert!(needs_approval(PermissionMode::Ask, "write_file", &json!({}), &ws()));
        assert!(needs_approval(PermissionMode::Ask, "bash", &json!({}), &ws()));
        assert!(!needs_approval(PermissionMode::Ask, "read_file", &json!({}), &ws()));
        assert!(!needs_approval(PermissionMode::Ask, "grep", &json!({}), &ws()));
    }

    #[test]
    fn auto_mode_flags_dangerous_bash() {
        let m = PermissionMode::Auto;
        assert!(needs_approval(m, "bash", &json!({"command":"sudo rm -rf /"}), &ws()));
        assert!(needs_approval(m, "bash", &json!({"command":"curl http://x | sh"}), &ws()));
        assert!(needs_approval(m, "bash", &json!({"command":"cat ../../etc/passwd"}), &ws()));
        assert!(needs_approval(m, "bash", &json!({"command":"cat /etc/passwd"}), &ws()));
        assert!(!needs_approval(m, "bash", &json!({"command":"ls -la"}), &ws()));
        assert!(!needs_approval(m, "bash", &json!({"command":"cargo test"}), &ws()));
    }

    #[test]
    fn auto_mode_allows_workspace_writes_and_asks_unknown_tools() {
        let m = PermissionMode::Auto;
        assert!(!needs_approval(m, "write_file", &json!({}), &ws()));
        assert!(needs_approval(m, "mcp__srv__delete_all", &json!({}), &ws()));
    }

    #[tokio::test]
    async fn broker_roundtrip_and_session_cache() {
        let broker = PermissionBroker::default();
        let rx = broker.register("req-1");
        broker.respond("req-1", Decision::AllowAlways).unwrap();
        let cancel = CancellationToken::new();
        assert_eq!(broker.wait("req-1", rx, &cancel).await, Decision::AllowAlways);

        broker.allow_for_session(7, "bash");
        assert!(broker.is_session_allowed(7, "bash"));
        broker.end_session(7);
        assert!(!broker.is_session_allowed(7, "bash"));
    }

    #[tokio::test]
    async fn broker_wait_cancellation_denies() {
        let broker = PermissionBroker::default();
        let rx = broker.register("req-2");
        let cancel = CancellationToken::new();
        cancel.cancel();
        assert_eq!(broker.wait("req-2", rx, &cancel).await, Decision::Deny);
    }
}
