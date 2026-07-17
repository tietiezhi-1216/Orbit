use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// A skill = one folder under `app_data_dir()/skills/{name}/` containing a
/// `SKILL.md` with YAML frontmatter (`name`, `description`) followed by the
/// instruction body — the Anthropic skills layout.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMeta {
    pub name: String,
    pub description: String,
    pub enabled: bool,
}

pub fn skills_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位数据目录：{e}"))?
        .join("skills");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建技能目录失败：{e}"))?;
    Ok(dir)
}

/// Skill names double as folder names; keep them filesystem-safe.
pub fn validate_name(name: &str) -> Result<(), String> {
    let ok = !name.is_empty()
        && name.len() <= 64
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    if ok {
        Ok(())
    } else {
        Err("技能名只能包含字母、数字、- 和 _".into())
    }
}

/// Parse the two known frontmatter keys out of a SKILL.md. Hand-rolled: the
/// spec only requires `name` and `description`, so a YAML dependency isn't
/// worth it. Quoted values are unquoted.
pub fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    let mut name = None;
    let mut description = None;
    let mut lines = content.lines();
    if lines.next().map(str::trim) != Some("---") {
        return (name, description);
    }
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };
        let value = value
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();
        match key.trim() {
            "name" => name = Some(value),
            "description" => description = Some(value),
            _ => {}
        }
    }
    (name, description)
}

pub fn skill_md_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    validate_name(name)?;
    Ok(skills_dir(app)?.join(name).join("SKILL.md"))
}

/// Read the full SKILL.md body for a skill (used by the `skill` tool).
pub fn read_skill(app: &AppHandle, name: &str) -> Result<String, String> {
    let path = skill_md_path(app, name)?;
    std::fs::read_to_string(&path).map_err(|_| format!("技能 {name} 不存在"))
}

/// List all skills on disk; `disabled` comes from settings.
pub fn list(app: &AppHandle, disabled: &[String]) -> Result<Vec<SkillMeta>, String> {
    let dir = skills_dir(app)?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir)
        .map_err(|e| format!("读取技能目录失败：{e}"))?
        .flatten()
    {
        if !entry.path().is_dir() {
            continue;
        }
        let folder = entry.file_name().to_string_lossy().into_owned();
        let Ok(content) = std::fs::read_to_string(entry.path().join("SKILL.md")) else {
            continue;
        };
        let (name, description) = parse_frontmatter(&content);
        out.push(SkillMeta {
            name: name.unwrap_or_else(|| folder.clone()),
            description: description.unwrap_or_default(),
            enabled: !disabled.contains(&folder),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frontmatter_parses_name_and_description() {
        let md = "---\nname: pdf-tools\ndescription: \"处理 PDF: 拆分合并\"\n---\n\n正文";
        let (n, d) = parse_frontmatter(md);
        assert_eq!(n.as_deref(), Some("pdf-tools"));
        assert_eq!(d.as_deref(), Some("处理 PDF: 拆分合并"));
    }

    #[test]
    fn frontmatter_missing_returns_none() {
        assert_eq!(parse_frontmatter("no frontmatter"), (None, None));
    }

    #[test]
    fn validate_name_rejects_paths() {
        assert!(validate_name("my-skill_2").is_ok());
        assert!(validate_name("../x").is_err());
        assert!(validate_name("a/b").is_err());
        assert!(validate_name("").is_err());
    }
}
