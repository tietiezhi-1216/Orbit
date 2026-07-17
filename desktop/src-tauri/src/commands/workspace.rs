use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Let the user pick a folder to bind as the conversation's workspace.
/// Returns `None` when the dialog is dismissed.
#[tauri::command]
pub async fn pick_workspace_dir(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder);
    });
    let folder = rx.await.map_err(|_| "选择目录失败".to_string())?;
    Ok(folder.map(|p| p.to_string()))
}
