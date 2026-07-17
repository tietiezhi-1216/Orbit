use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Let the user pick a folder for a project or skill import.
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

pub(crate) fn resolve_task_workspace(
    app: &AppHandle,
    project_id: Option<&str>,
    task_id: Option<&str>,
) -> Result<PathBuf, String> {
    let task_id = task_id.ok_or_else(|| "任务尚未创建".to_string())?;
    let workspace = super::conversations::task_workspace_path(app, task_id)?;
    let Some(project_id) = project_id.map(str::trim).filter(|id| !id.is_empty()) else {
        std::fs::create_dir_all(&workspace).map_err(|e| format!("创建任务工作区失败：{e}"))?;
        return Ok(workspace);
    };

    let project = super::projects::find_project(app, project_id)?
        .ok_or_else(|| "项目不存在或已被移除".to_string())?;
    let project_root = PathBuf::from(&project.root_path);
    if !project_root.is_dir() {
        return Err("项目文件夹不存在".into());
    }

    if workspace.join(".git").exists() {
        let _ = super::projects::mark_used(app, project_id);
        return Ok(workspace);
    }
    if workspace.exists() {
        let is_empty = std::fs::read_dir(&workspace)
            .map_err(|e| format!("读取任务工作区失败：{e}"))?
            .next()
            .is_none();
        if !is_empty {
            return Err("任务工作区已有文件，不能再绑定项目".into());
        }
        std::fs::remove_dir(&workspace).map_err(|e| format!("准备任务工作区失败：{e}"))?;
    }

    let git_root = git_output(&project_root, &["rev-parse", "--show-toplevel"])?;
    let canonical_git_root =
        dunce::canonicalize(git_root.trim()).map_err(|e| format!("无法解析 Git 仓库目录：{e}"))?;
    let canonical_project =
        dunce::canonicalize(&project_root).map_err(|e| format!("无法解析项目目录：{e}"))?;
    if canonical_git_root != canonical_project {
        return Err("请选择 Git 仓库根目录作为项目文件夹".into());
    }

    if let Some(parent) = workspace.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建任务目录失败：{e}"))?;
    }
    git_status(
        &project_root,
        &[
            "worktree",
            "add",
            "--detach",
            workspace.to_string_lossy().as_ref(),
            "HEAD",
        ],
    )?;
    let _ = super::projects::mark_used(app, project_id);
    Ok(workspace)
}

/// Best-effort worktree unregistering. The caller still removes the managed
/// task directory, but this prevents stale entries in the project's Git data.
pub(crate) fn cleanup_task_workspace(app: &AppHandle, project_id: &str, workspace: &Path) {
    if project_id.is_empty() || !workspace.exists() || !workspace.join(".git").exists() {
        return;
    }
    let Ok(Some(project)) = super::projects::find_project(app, project_id) else {
        return;
    };
    let root = PathBuf::from(project.root_path);
    let _ = Command::new("git")
        .args(["-C"])
        .arg(&root)
        .args(["worktree", "remove", "--force"])
        .arg(workspace)
        .status();
    let _ = Command::new("git")
        .args(["-C"])
        .arg(root)
        .args(["worktree", "prune"])
        .status();
}

fn git_output(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(["-C"])
        .arg(root)
        .args(args)
        .output()
        .map_err(|e| format!("无法执行 Git：{e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if message.is_empty() {
            "所选项目不是可用的 Git 仓库".into()
        } else {
            format!("Git 操作失败：{message}")
        })
    }
}

fn git_status(root: &Path, args: &[&str]) -> Result<(), String> {
    git_output(root, args).map(|_| ())
}
