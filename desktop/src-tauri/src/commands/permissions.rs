use tauri::State;

use crate::permission::Decision;
use crate::AppState;

/// Frontend answer to a `permissionRequest` chat event.
#[tauri::command]
pub fn permission_respond(
    state: State<'_, AppState>,
    id: String,
    decision: String,
) -> Result<(), String> {
    let decision = Decision::parse(&decision).ok_or("无效的授权决定")?;
    state.permissions.respond(&id, decision)
}

/// The built-in default system prompt, for the settings editor's
/// "恢复默认" affordance.
#[tauri::command]
pub fn default_system_prompt() -> String {
    crate::agent::prompt::DEFAULT_SYSTEM_PROMPT.to_string()
}

/// Names of the builtin tools, for the agent editor's tool toggles.
#[tauri::command]
pub fn list_builtin_tools() -> Vec<String> {
    crate::tools::ALL_TOOLS.iter().map(|s| s.to_string()).collect()
}
