use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use walkdir::WalkDir;

/// The active execution space inside one shared task transcript.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskMode {
    Work,
    #[default]
    Code,
}

impl TaskMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Work => "work",
            Self::Code => "code",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Work => "Work",
            Self::Code => "Code",
        }
    }

    /// Code owns the terminal-first development surface. Work stays focused
    /// on research and deliverables; explicit agent profiles cannot silently
    /// turn it back into a second Code mode.
    pub fn filter_builtin_tools(self, configured: &[String]) -> Vec<String> {
        let source: Vec<String> = if configured.is_empty() {
            crate::tools::ALL_TOOLS
                .iter()
                .map(|tool| (*tool).to_string())
                .collect()
        } else {
            configured.to_vec()
        };
        source
            .into_iter()
            .filter(|tool| self == Self::Code || tool != "bash")
            .collect()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileEntry {
    pub path: String,
    pub size: u64,
    pub modified_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskWorkspaceModeStatus {
    pub mode: TaskMode,
    pub initialized: bool,
    pub root_path: String,
    pub is_git: bool,
    pub file_count: usize,
    pub file_count_capped: bool,
    pub changed_files: Vec<String>,
    pub deliverables: Vec<WorkspaceFileEntry>,
    pub transferable_files: Vec<WorkspaceFileEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskWorkspaceOverview {
    pub work: TaskWorkspaceModeStatus,
    pub code: TaskWorkspaceModeStatus,
}

/// Let the user pick a folder for a project or skill import.
/// Returns `None` when the dialog is dismissed.
#[tauri::command]
pub async fn pick_workspace_dir(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder.map(|path| path.to_string()));
    });
    rx.await.map_err(|_| "选择目录失败".to_string())
}

/// Resolve one of the two lazily-created, writable execution spaces owned by a
/// task. Work and Code share a transcript but never share a writable root.
pub(crate) fn resolve_task_workspace(
    app: &AppHandle,
    project_id: Option<&str>,
    task_id: Option<&str>,
    task_mode: TaskMode,
) -> Result<PathBuf, String> {
    let task_id = task_id.ok_or_else(|| "任务尚未创建".to_string())?;
    let workspace = task_mode_workspace_path(app, task_id, task_mode)?;
    migrate_legacy_workspace(app, task_id, task_mode, &workspace)?;

    let Some(project_id) = project_id.map(str::trim).filter(|id| !id.is_empty()) else {
        std::fs::create_dir_all(&workspace)
            .map_err(|error| format!("创建 {} 工作区失败：{error}", task_mode.label()))?;
        return canonical_or_original(workspace);
    };

    let project = super::projects::find_project(app, project_id)?
        .ok_or_else(|| "项目不存在或已被移除".to_string())?;
    let project_root = resolve_project_directory(Path::new(&project.root_path))?;

    let workspace_ready = workspace.exists()
        && std::fs::read_dir(&workspace)
            .map(|mut entries| entries.next().is_some())
            .unwrap_or(false);
    if workspace.exists() && !workspace_ready {
        let _ = std::fs::remove_dir(&workspace);
    }

    let resolved = if workspace_ready {
        resolve_existing_project_workspace(&project_root, &workspace)?
    } else if let Some((git_root, relative_project)) = git_project(&project_root) {
        match create_git_worktree(&git_root, &relative_project, &workspace) {
            Ok(path) => path,
            Err(_) => create_directory_snapshot(&project_root, &workspace)?,
        }
    } else {
        create_directory_snapshot(&project_root, &workspace)?
    };

    let _ = super::projects::mark_used(app, project_id);
    Ok(resolved)
}

fn task_mode_workspace_path(
    app: &AppHandle,
    task_id: &str,
    task_mode: TaskMode,
) -> Result<PathBuf, String> {
    Ok(super::conversations::task_root(app, task_id)?
        .join("workspaces")
        .join(task_mode.as_str()))
}

/// Read-only status for both execution spaces. Merely opening the panel never
/// creates a worktree or snapshot; spaces remain lazy until first use/import.
#[tauri::command]
pub async fn task_workspace_overview(
    app: AppHandle,
    task_id: String,
) -> Result<TaskWorkspaceOverview, String> {
    tauri::async_runtime::spawn_blocking(move || task_workspace_overview_sync(&app, &task_id))
        .await
        .map_err(|error| format!("读取工作区状态失败：{error}"))?
}

fn task_workspace_overview_sync(
    app: &AppHandle,
    task_id: &str,
) -> Result<TaskWorkspaceOverview, String> {
    super::conversations::validate_id(&task_id)?;
    let project_id = super::conversations::load_conversation(app.clone(), task_id.to_string())
        .ok()
        .map(|conversation| conversation.project_id)
        .filter(|project_id| !project_id.is_empty());
    Ok(TaskWorkspaceOverview {
        work: summarize_mode_workspace(app, task_id, project_id.as_deref(), TaskMode::Work)?,
        code: summarize_mode_workspace(app, task_id, project_id.as_deref(), TaskMode::Code)?,
    })
}

/// Copy one explicitly selected file into the other isolated space. Imports
/// live under `.tietiezhi/imports/{mode}` so they never overwrite project
/// files or pretend that the two roots are automatically synchronized.
#[tauri::command]
pub async fn transfer_task_workspace_file(
    app: AppHandle,
    task_id: String,
    from_mode: TaskMode,
    to_mode: TaskMode,
    path: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        transfer_task_workspace_file_sync(&app, &task_id, from_mode, to_mode, &path)
    })
    .await
    .map_err(|error| format!("交接工作区文件失败：{error}"))?
}

fn transfer_task_workspace_file_sync(
    app: &AppHandle,
    task_id: &str,
    from_mode: TaskMode,
    to_mode: TaskMode,
    path: &str,
) -> Result<String, String> {
    super::conversations::validate_id(&task_id)?;
    if from_mode == to_mode {
        return Err("来源和目标工作区不能相同".into());
    }
    let conversation = super::conversations::load_conversation(app.clone(), task_id.to_string())?;
    let project_id = (!conversation.project_id.is_empty()).then_some(conversation.project_id);
    let source_storage = task_mode_workspace_path(app, task_id, from_mode)?;
    if !source_storage.is_dir() {
        return Err(format!("{} 工作区尚未创建", from_mode.label()));
    }
    let source_root = active_workspace_root(app, project_id.as_deref(), &source_storage)?;
    let relative = checked_relative_path(path)?;
    let source = source_root.join(&relative);
    let canonical_source =
        dunce::canonicalize(&source).map_err(|_| format!("找不到要导入的文件：{path}"))?;
    let canonical_root = dunce::canonicalize(&source_root)
        .map_err(|error| format!("无法解析来源工作区：{error}"))?;
    if !canonical_source.starts_with(&canonical_root)
        || !canonical_source.is_file()
        || source.is_symlink()
    {
        return Err("只能导入来源工作区内的普通文件".into());
    }
    let size = std::fs::metadata(&canonical_source)
        .map_err(|error| format!("读取文件信息失败：{error}"))?
        .len();
    if size > 100 * 1024 * 1024 {
        return Err("单个交接文件不能超过 100 MB".into());
    }

    let target_root = resolve_task_workspace(app, project_id.as_deref(), Some(task_id), to_mode)?;
    let imported_relative = PathBuf::from(".tietiezhi")
        .join("imports")
        .join(from_mode.as_str())
        .join(&relative);
    let destination = target_root.join(&imported_relative);
    if destination.exists() {
        return Err(format!(
            "目标工作区已存在：{}",
            display_relative_path(&imported_relative)
        ));
    }
    let import_root = target_root.join(".tietiezhi");
    if import_root.is_symlink() {
        return Err("目标工作区的 .tietiezhi 不能是符号链接".into());
    }
    if let Some(parent) = destination.parent() {
        reject_symlink_ancestors(&target_root, parent)?;
        std::fs::create_dir_all(parent).map_err(|error| format!("创建导入目录失败：{error}"))?;
        let canonical_target = dunce::canonicalize(&target_root)
            .map_err(|error| format!("无法解析目标工作区：{error}"))?;
        let canonical_parent =
            dunce::canonicalize(parent).map_err(|error| format!("无法解析导入目录：{error}"))?;
        if !canonical_parent.starts_with(canonical_target) {
            return Err("导入目录超出目标工作区".into());
        }
    }
    std::fs::copy(canonical_source, &destination)
        .map_err(|error| format!("导入文件失败：{error}"))?;
    Ok(display_relative_path(&imported_relative))
}

fn reject_symlink_ancestors(root: &Path, destination_parent: &Path) -> Result<(), String> {
    let relative = destination_parent
        .strip_prefix(root)
        .map_err(|_| "导入目录超出目标工作区".to_string())?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(value) = component else {
            return Err("非法的导入目录".into());
        };
        current.push(value);
        if current.is_symlink() {
            return Err("导入目录不能经过符号链接".into());
        }
        if !current.exists() {
            break;
        }
    }
    Ok(())
}

fn summarize_mode_workspace(
    app: &AppHandle,
    task_id: &str,
    project_id: Option<&str>,
    mode: TaskMode,
) -> Result<TaskWorkspaceModeStatus, String> {
    const MAX_SCANNED_FILES: usize = 5_000;
    const MAX_LISTED_FILES: usize = 24;

    let storage_root = task_mode_workspace_path(app, task_id, mode)?;
    if !storage_root.is_dir() {
        return Ok(TaskWorkspaceModeStatus {
            mode,
            initialized: false,
            root_path: storage_root.to_string_lossy().into_owned(),
            is_git: false,
            file_count: 0,
            file_count_capped: false,
            changed_files: Vec::new(),
            deliverables: Vec::new(),
            transferable_files: Vec::new(),
        });
    }
    let root = active_workspace_root(app, project_id, &storage_root)?;
    let is_git = storage_root.join(".git").exists();
    let changed_files = if is_git {
        git_changed_files(&storage_root, &root).unwrap_or_default()
    } else {
        Vec::new()
    };
    let changed: std::collections::HashSet<&str> =
        changed_files.iter().map(String::as_str).collect();
    let mut files = Vec::new();
    let mut file_count = 0;
    let mut file_count_capped = false;
    let entries = WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| entry.file_name() != ".git");
    for entry in entries {
        let Ok(entry) = entry else { continue };
        if !entry.file_type().is_file() || entry.path().is_symlink() {
            continue;
        }
        if file_count >= MAX_SCANNED_FILES {
            file_count_capped = true;
            break;
        }
        file_count += 1;
        let Ok(relative) = entry.path().strip_prefix(&root) else {
            continue;
        };
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        files.push(WorkspaceFileEntry {
            path: display_relative_path(relative),
            size: metadata.len(),
            modified_at: metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as u64)
                .unwrap_or(0),
        });
    }
    files.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    let deliverables: Vec<_> = files
        .iter()
        .filter(|file| {
            is_deliverable(&file.path) && (!is_git || changed.contains(file.path.as_str()))
        })
        .take(MAX_LISTED_FILES)
        .cloned()
        .collect();
    let transferable_files = if mode == TaskMode::Work {
        let source = if deliverables.is_empty() {
            &files
        } else {
            &deliverables
        };
        source.iter().take(MAX_LISTED_FILES).cloned().collect()
    } else {
        files
            .iter()
            .filter(|file| changed.contains(file.path.as_str()))
            .take(MAX_LISTED_FILES)
            .cloned()
            .collect()
    };
    Ok(TaskWorkspaceModeStatus {
        mode,
        initialized: true,
        root_path: root.to_string_lossy().into_owned(),
        is_git,
        file_count,
        file_count_capped,
        changed_files,
        deliverables,
        transferable_files,
    })
}

fn active_workspace_root(
    app: &AppHandle,
    project_id: Option<&str>,
    storage_root: &Path,
) -> Result<PathBuf, String> {
    let Some(project_id) = project_id else {
        return canonical_or_original(storage_root.to_path_buf());
    };
    let Some(project) = super::projects::find_project(app, project_id)? else {
        return canonical_or_original(storage_root.to_path_buf());
    };
    let Ok(project_root) = resolve_project_directory(Path::new(&project.root_path)) else {
        return canonical_or_original(storage_root.to_path_buf());
    };
    resolve_existing_project_workspace(&project_root, storage_root)
}

fn checked_relative_path(path: &str) -> Result<PathBuf, String> {
    let relative = Path::new(path.trim());
    if relative.as_os_str().is_empty()
        || relative.is_absolute()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_) | Component::CurDir))
    {
        return Err("非法的工作区文件路径".into());
    }
    Ok(relative.to_path_buf())
}

fn display_relative_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(value) => Some(value.to_string_lossy()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn is_deliverable(path: &str) -> bool {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    matches!(
        extension.as_str(),
        "md" | "txt"
            | "pdf"
            | "docx"
            | "xlsx"
            | "pptx"
            | "csv"
            | "html"
            | "png"
            | "jpg"
            | "jpeg"
            | "webp"
            | "svg"
            | "json"
    )
}

fn git_changed_files(storage_root: &Path, active_root: &Path) -> Result<Vec<String>, String> {
    let output = git_output_bytes(
        storage_root,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let project_prefix = active_root
        .strip_prefix(storage_root)
        .unwrap_or(Path::new(""));
    let records: Vec<&[u8]> = output
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
        .collect();
    let mut changed = Vec::new();
    let mut index = 0;
    while index < records.len() {
        let record = records[index];
        if record.len() >= 4 {
            let repository_path = PathBuf::from(String::from_utf8_lossy(&record[3..]).into_owned());
            if let Ok(relative) = repository_path.strip_prefix(project_prefix) {
                changed.push(display_relative_path(relative));
            }
            let renamed = matches!(record[0], b'R' | b'C') || matches!(record[1], b'R' | b'C');
            if renamed {
                index += 1;
            }
        }
        index += 1;
    }
    changed.sort();
    changed.dedup();
    changed.truncate(100);
    Ok(changed)
}

/// Standalone tasks created before dual spaces used `task/workspace`. Preserve
/// that content as the Code space; Work starts independently.
fn migrate_legacy_workspace(
    app: &AppHandle,
    task_id: &str,
    task_mode: TaskMode,
    destination: &Path,
) -> Result<(), String> {
    if task_mode != TaskMode::Code || destination.exists() {
        return Ok(());
    }
    let legacy = super::conversations::task_workspace_path(app, task_id)?;
    if !legacy.exists() {
        return Ok(());
    }
    // Moving a registered Git worktree invalidates the path stored in the
    // repository's common metadata. Leave it for deletion cleanup and create a
    // fresh mode-specific worktree instead.
    if legacy.join(".git").is_file() {
        return Ok(());
    }
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("迁移任务工作区失败：{error}"))?;
    }
    std::fs::rename(&legacy, destination).map_err(|error| format!("迁移旧任务工作区失败：{error}"))
}

fn resolve_existing_project_workspace(
    project_root: &Path,
    workspace: &Path,
) -> Result<PathBuf, String> {
    if workspace.join(".git").exists() {
        if let Some((_, relative_project)) = git_project(project_root) {
            let active = workspace.join(relative_project);
            if active.is_dir() {
                return canonical_or_original(active);
            }
        }
    }
    canonical_or_original(workspace.to_path_buf())
}

fn resolve_project_directory(root: &Path) -> Result<PathBuf, String> {
    if !root.is_dir() {
        return Err("项目文件夹不存在".into());
    }
    dunce::canonicalize(root).map_err(|error| format!("无法解析项目目录：{error}"))
}

fn git_project(project_root: &Path) -> Option<(PathBuf, PathBuf)> {
    let output = git_output(project_root, &["rev-parse", "--show-toplevel"]).ok()?;
    let git_root = dunce::canonicalize(output.trim()).ok()?;
    let relative_project = project_root.strip_prefix(&git_root).ok()?.to_path_buf();
    Some((git_root, relative_project))
}

fn create_git_worktree(
    git_root: &Path,
    relative_project: &Path,
    workspace: &Path,
) -> Result<PathBuf, String> {
    if let Some(parent) = workspace.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("创建任务目录失败：{error}"))?;
    }
    let mut command = crate::process::background_command("git");
    let output = command
        .args(["-C"])
        .arg(git_root)
        .args(["worktree", "add", "--detach"])
        .arg(workspace)
        .arg("HEAD")
        .output()
        .map_err(|error| format!("无法执行 Git：{error}"))?;
    if !output.status.success() {
        let _ = std::fs::remove_dir_all(workspace);
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "创建 Git 工作区失败".into()
        } else {
            format!("创建 Git 工作区失败：{message}")
        });
    }

    if let Err(error) = seed_worktree_from_checkout(git_root, workspace) {
        remove_git_worktree(git_root, workspace);
        let _ = std::fs::remove_dir_all(workspace);
        return Err(error);
    }

    let active = workspace.join(relative_project);
    if !active.is_dir() {
        remove_git_worktree(git_root, workspace);
        let _ = std::fs::remove_dir_all(workspace);
        return Err("Git 工作区中找不到所选项目目录".into());
    }
    canonical_or_original(active)
}

/// A detached worktree starts at HEAD. Apply tracked edits and copy untracked,
/// non-ignored files so its initial state matches the checkout the user chose.
fn seed_worktree_from_checkout(source: &Path, workspace: &Path) -> Result<(), String> {
    let patch = git_output_bytes(source, &["diff", "--binary", "HEAD", "--"])?;
    if !patch.is_empty() {
        let mut command = crate::process::background_command("git");
        let mut child = command
            .args(["-C"])
            .arg(workspace)
            .args(["apply", "--whitespace=nowarn", "-"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| format!("无法同步项目改动：{error}"))?;
        child
            .stdin
            .take()
            .ok_or_else(|| "无法写入 Git 补丁".to_string())?
            .write_all(&patch)
            .map_err(|error| format!("写入 Git 补丁失败：{error}"))?;
        let output = child
            .wait_with_output()
            .map_err(|error| format!("等待 Git 补丁失败：{error}"))?;
        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if message.is_empty() {
                "同步项目未提交改动失败".into()
            } else {
                format!("同步项目未提交改动失败：{message}")
            });
        }
    }

    let untracked = git_output_bytes(
        source,
        &["ls-files", "--others", "--exclude-standard", "-z"],
    )?;
    for raw in untracked
        .split(|byte| *byte == 0)
        .filter(|path| !path.is_empty())
    {
        let relative = PathBuf::from(String::from_utf8_lossy(raw).into_owned());
        if relative.is_absolute()
            || relative
                .components()
                .any(|component| component == Component::ParentDir)
        {
            continue;
        }
        let source_file = source.join(&relative);
        if !source_file.is_file() || source_file.is_symlink() {
            continue;
        }
        let destination = workspace.join(&relative);
        if let Some(parent) = destination.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("创建未跟踪文件目录失败：{error}"))?;
        }
        std::fs::copy(&source_file, &destination)
            .map_err(|error| format!("复制未跟踪文件失败：{error}"))?;
    }
    Ok(())
}

fn create_directory_snapshot(source: &Path, destination: &Path) -> Result<PathBuf, String> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("创建任务目录失败：{error}"))?;
        if dunce::canonicalize(parent)
            .ok()
            .is_some_and(|canonical_parent| canonical_parent.starts_with(source))
        {
            return Err("任务工作区不能创建在项目目录内部".into());
        }
    }
    std::fs::create_dir(destination).map_err(|error| format!("创建任务工作区失败：{error}"))?;

    let copied = (|| {
        let entries = WalkDir::new(source)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| entry.file_name() != ".git");
        for entry in entries {
            let entry = entry.map_err(|error| format!("扫描项目目录失败：{error}"))?;
            let relative = entry
                .path()
                .strip_prefix(source)
                .map_err(|error| format!("解析项目文件失败：{error}"))?;
            if relative.as_os_str().is_empty() || entry.file_type().is_symlink() {
                continue;
            }
            let target = destination.join(relative);
            if entry.file_type().is_dir() {
                std::fs::create_dir_all(&target)
                    .map_err(|error| format!("创建快照目录失败：{error}"))?;
            } else if entry.file_type().is_file() {
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|error| format!("创建快照目录失败：{error}"))?;
                }
                std::fs::copy(entry.path(), &target)
                    .map_err(|error| format!("复制项目文件失败：{error}"))?;
            }
        }
        Ok::<(), String>(())
    })();

    if let Err(error) = copied {
        let _ = std::fs::remove_dir_all(destination);
        return Err(error);
    }
    canonical_or_original(destination.to_path_buf())
}

fn canonical_or_original(path: PathBuf) -> Result<PathBuf, String> {
    dunce::canonicalize(&path).map_err(|error| format!("无法解析任务工作区：{error}"))
}

/// Best-effort worktree unregistering. The task directory is removed by the
/// caller after both mode-specific Git worktrees have been detached.
pub(crate) fn cleanup_task_workspaces(app: &AppHandle, project_id: &str, task_root: &Path) {
    if project_id.is_empty() {
        return;
    }
    let Ok(Some(project)) = super::projects::find_project(app, project_id) else {
        return;
    };
    let project_root = PathBuf::from(project.root_path);
    let git_root = git_project(&project_root)
        .map(|(root, _)| root)
        .unwrap_or(project_root);
    for path in [
        task_root.join("workspace"),
        task_root.join("workspaces").join("work"),
        task_root.join("workspaces").join("code"),
    ] {
        if path.join(".git").exists() {
            remove_git_worktree(&git_root, &path);
        }
    }
    let mut prune = crate::process::background_command("git");
    prune.args(["-C"]).arg(git_root).args(["worktree", "prune"]);
    let _ = prune.status();
}

fn remove_git_worktree(git_root: &Path, workspace: &Path) {
    let mut remove = crate::process::background_command("git");
    remove
        .args(["-C"])
        .arg(git_root)
        .args(["worktree", "remove", "--force"])
        .arg(workspace);
    let _ = remove.status();
}

fn git_output(root: &Path, args: &[&str]) -> Result<String, String> {
    git_output_bytes(root, args).map(|output| String::from_utf8_lossy(&output).into_owned())
}

fn git_output_bytes(root: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let mut command = crate::process::background_command("git");
    let output = command
        .args(["-C"])
        .arg(root)
        .args(args)
        .output()
        .map_err(|error| format!("无法执行 Git：{error}"))?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if message.is_empty() {
            "所选项目不是可用的 Git 仓库".into()
        } else {
            format!("Git 操作失败：{message}")
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn task_modes_have_stable_storage_names() {
        assert_eq!(TaskMode::Work.as_str(), "work");
        assert_eq!(TaskMode::Code.as_str(), "code");
        assert_eq!(TaskMode::default(), TaskMode::Code);
        assert!(!TaskMode::Work
            .filter_builtin_tools(&[])
            .iter()
            .any(|tool| tool == "bash"));
        assert!(TaskMode::Code
            .filter_builtin_tools(&[])
            .iter()
            .any(|tool| tool == "bash"));
    }

    #[test]
    fn handoff_paths_and_deliverables_are_strict() {
        assert_eq!(
            checked_relative_path("reports/result.md").unwrap(),
            PathBuf::from("reports/result.md")
        );
        assert!(checked_relative_path("../secret").is_err());
        assert!(checked_relative_path("/tmp/secret").is_err());
        assert!(is_deliverable("reports/result.md"));
        assert!(is_deliverable("data/RESULT.XLSX"));
        assert!(!is_deliverable("src/main.rs"));
    }

    #[test]
    fn directory_snapshots_are_independent_and_skip_git_metadata() {
        let root = std::env::temp_dir().join(format!("tietiezhi-source-{}", Uuid::new_v4()));
        let snapshot = std::env::temp_dir().join(format!("tietiezhi-snapshot-{}", Uuid::new_v4()));
        std::fs::create_dir_all(root.join(".git")).unwrap();
        std::fs::create_dir_all(root.join("nested")).unwrap();
        std::fs::write(root.join("nested/file.txt"), "source").unwrap();
        std::fs::write(root.join(".git/config"), "secret").unwrap();

        create_directory_snapshot(&root, &snapshot).unwrap();
        std::fs::write(snapshot.join("nested/file.txt"), "changed").unwrap();

        assert_eq!(
            std::fs::read_to_string(root.join("nested/file.txt")).unwrap(),
            "source"
        );
        assert!(!snapshot.join(".git").exists());
        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_dir_all(snapshot).unwrap();
    }

    #[test]
    fn git_worktrees_start_with_current_tracked_and_untracked_content() {
        let root = std::env::temp_dir().join(format!("tietiezhi-git-source-{}", Uuid::new_v4()));
        let worktree =
            std::env::temp_dir().join(format!("tietiezhi-git-worktree-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let run = |args: &[&str]| {
            let status = std::process::Command::new("git")
                .args(["-C"])
                .arg(&root)
                .args(args)
                .status()
                .unwrap();
            assert!(status.success(), "git command failed: {args:?}");
        };
        run(&["init", "-q"]);
        std::fs::write(root.join("tracked.txt"), "base").unwrap();
        run(&["add", "tracked.txt"]);
        run(&[
            "-c",
            "user.name=Tietiezhi Test",
            "-c",
            "user.email=test@tietiezhi.invalid",
            "commit",
            "-qm",
            "base",
        ]);
        std::fs::write(root.join("tracked.txt"), "changed").unwrap();
        std::fs::write(root.join("untracked.txt"), "new").unwrap();

        create_git_worktree(&root, Path::new(""), &worktree).unwrap();

        assert_eq!(
            std::fs::read_to_string(worktree.join("tracked.txt")).unwrap(),
            "changed"
        );
        assert_eq!(
            std::fs::read_to_string(worktree.join("untracked.txt")).unwrap(),
            "new"
        );
        remove_git_worktree(&root, &worktree);
        let _ = std::fs::remove_dir_all(&worktree);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_project_directory_is_rejected() {
        let root = std::env::temp_dir().join(format!("tietiezhi-missing-{}", Uuid::new_v4()));
        assert_eq!(
            resolve_project_directory(&root).unwrap_err(),
            "项目文件夹不存在"
        );
    }
}
