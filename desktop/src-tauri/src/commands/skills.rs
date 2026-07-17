use tauri::AppHandle;

use crate::skills::{self, SkillMeta};

#[tauri::command]
pub fn list_skills(app: AppHandle) -> Result<Vec<SkillMeta>, String> {
    let settings = super::settings::read_settings(&app)?;
    skills::list(&app, &settings.skills_disabled)
}

/// Read the full SKILL.md for the editor.
#[tauri::command]
pub fn read_skill(app: AppHandle, name: String) -> Result<String, String> {
    skills::read_skill(&app, &name)
}

/// Create or overwrite a skill's SKILL.md. The frontmatter is written from
/// the given fields so name/description stay consistent with the folder.
#[tauri::command]
pub fn upsert_skill(
    app: AppHandle,
    name: String,
    description: String,
    body: String,
) -> Result<(), String> {
    skills::validate_name(&name)?;
    let path = skills::skill_md_path(&app, &name)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("创建技能目录失败：{e}"))?;
    }
    // If the body already carries frontmatter (e.g. edited raw), keep it as-is.
    let content = if body.trim_start().starts_with("---") {
        body
    } else {
        let description = description.replace('\n', " ");
        format!("---\nname: {name}\ndescription: {description}\n---\n\n{body}")
    };
    std::fs::write(&path, content).map_err(|e| format!("写入技能失败：{e}"))
}

#[tauri::command]
pub fn delete_skill(app: AppHandle, name: String) -> Result<(), String> {
    skills::validate_name(&name)?;
    let dir = skills::skills_dir(&app)?.join(&name);
    match std::fs::remove_dir_all(&dir) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("删除技能失败：{e}")),
    }
}

#[tauri::command]
pub fn set_skill_enabled(app: AppHandle, name: String, enabled: bool) -> Result<(), String> {
    skills::validate_name(&name)?;
    let mut settings = super::settings::read_settings(&app)?;
    settings.skills_disabled.retain(|n| n != &name);
    if !enabled {
        settings.skills_disabled.push(name);
    }
    super::settings::save_settings(app, settings)
}

const MAX_IMPORT_BYTES: u64 = 5 * 1024 * 1024;

/// Import a skill by copying a local folder (must contain SKILL.md) into the
/// skills directory. Returns the imported skill's metadata.
#[tauri::command]
pub fn import_skill(app: AppHandle, path: String) -> Result<SkillMeta, String> {
    let src = std::path::PathBuf::from(path.trim());
    if !src.is_dir() {
        return Err("请选择一个包含 SKILL.md 的文件夹".into());
    }
    let md = src.join("SKILL.md");
    let content = std::fs::read_to_string(&md).map_err(|_| "文件夹内缺少 SKILL.md".to_string())?;
    let (name, description) = skills::parse_frontmatter(&content);
    let folder_name = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let name = name.unwrap_or(folder_name);
    skills::validate_name(&name)?;

    let dest = skills::skills_dir(&app)?.join(&name);
    copy_dir(&src, &dest, 0)?;
    Ok(SkillMeta {
        name,
        description: description.unwrap_or_default(),
        enabled: true,
    })
}

fn copy_dir(src: &std::path::Path, dest: &std::path::Path, depth: usize) -> Result<(), String> {
    if depth > 8 {
        return Err("技能文件夹层级过深".into());
    }
    std::fs::create_dir_all(dest).map_err(|e| format!("创建目录失败：{e}"))?;
    for entry in std::fs::read_dir(src)
        .map_err(|e| format!("读取目录失败：{e}"))?
        .flatten()
    {
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        let to = dest.join(entry.file_name());
        if ty.is_dir() {
            copy_dir(&entry.path(), &to, depth + 1)?;
        } else if ty.is_file() {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size > MAX_IMPORT_BYTES {
                return Err(format!(
                    "文件 {} 过大（>5MB）",
                    entry.file_name().to_string_lossy()
                ));
            }
            std::fs::copy(entry.path(), &to).map_err(|e| format!("复制文件失败：{e}"))?;
        }
    }
    Ok(())
}
