use serde_json::Value;

use super::{str_arg, ToolCtx};
use crate::skills;

pub fn skill_tool(ctx: &ToolCtx, args: &Value) -> Result<String, String> {
    let name = str_arg(args, "name")?;
    ensure_available(name, &ctx.available_skills)?;
    skills::read_skill(&ctx.app, name)
}

fn ensure_available(name: &str, available: &[String]) -> Result<(), String> {
    if available.iter().any(|skill| skill == name) {
        return Ok(());
    }
    if available.is_empty() {
        return Err("当前没有可供本轮使用的技能，无需调用 skill 工具".into());
    }
    Err(format!(
        "技能“{name}”不可用。当前可用技能：{}",
        available.join("、")
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invented_name_with_available_choices() {
        let available = vec!["git-release".to_string(), "pdf-tools".to_string()];
        let error = ensure_available("通用能力", &available).unwrap_err();

        assert_eq!(
            error,
            "技能“通用能力”不可用。当前可用技能：git-release、pdf-tools"
        );
    }

    #[test]
    fn explains_when_no_skill_is_available() {
        let error = ensure_available("通用能力", &[]).unwrap_err();
        assert_eq!(error, "当前没有可供本轮使用的技能，无需调用 skill 工具");
    }

    #[test]
    fn accepts_an_exact_available_name() {
        assert!(ensure_available("git-release", &["git-release".into()]).is_ok());
    }
}
