use crate::skills::SkillMeta;

/// Built-in default system prompt (opencode-flavored). User settings and
/// per-agent prompts override it; workspace/skills context is always appended.
pub const DEFAULT_SYSTEM_PROMPT: &str = "\
你是铁铁汁（Tietiezhi），一个运行在用户桌面上的智能体助手。

# 工作方式
- 回答默认使用简体中文，除非用户使用其它语言。
- 你可以调用工具来读写文件、搜索、执行命令、抓取网页。需要动手时直接调用工具，不要口头描述你\"将要\"做什么。
- 工具的文件路径一律使用相对工作区的路径。
- 修改文件前先用 read_file 确认原文；编辑使用 edit_file 做精确替换。
- 执行有风险的命令前先向用户说明意图。
- 完成任务后简要总结做了什么；出错时如实报告错误内容。

# 输出
- 使用 Markdown。代码引用用代码块并标注语言。
- 保持简洁：直接给结论，再给必要的细节。";

/// Compose the final system prompt: (agent prompt || user override || builtin)
/// + workspace + enabled skills.
pub fn compose(
    base_override: &str,
    agent_prompt: &str,
    workspace: &str,
    skills: &[SkillMeta],
) -> String {
    let mut prompt = if !agent_prompt.trim().is_empty() {
        agent_prompt.trim().to_string()
    } else if !base_override.trim().is_empty() {
        base_override.trim().to_string()
    } else {
        DEFAULT_SYSTEM_PROMPT.to_string()
    };

    prompt.push_str(&format!("\n\n# 环境\n- 当前工作区目录：{workspace}"));

    let enabled: Vec<&SkillMeta> = skills.iter().filter(|s| s.enabled).collect();
    if !enabled.is_empty() {
        prompt.push_str("\n\n# 可用技能\n以下技能可通过 skill 工具按需加载完整说明（当任务与某技能描述相关时先加载它）：\n");
        for s in enabled {
            prompt.push_str(&format!("- {}: {}\n", s.name, s.description));
        }
    }
    prompt
}

#[cfg(test)]
mod tests {
    use super::*;

    fn skill(name: &str, enabled: bool) -> SkillMeta {
        SkillMeta {
            name: name.into(),
            description: format!("{name} 描述"),
            enabled,
        }
    }

    #[test]
    fn agent_prompt_wins_over_override_and_default() {
        let p = compose("用户覆盖", "智能体提示词", "/ws", &[]);
        assert!(p.starts_with("智能体提示词"));
        let p = compose("用户覆盖", "", "/ws", &[]);
        assert!(p.starts_with("用户覆盖"));
        let p = compose("", "", "/ws", &[]);
        assert!(p.starts_with("你是铁铁汁"));
    }

    #[test]
    fn skills_only_lists_enabled() {
        let p = compose("", "", "/ws", &[skill("a", true), skill("b", false)]);
        assert!(p.contains("- a: a 描述"));
        assert!(!p.contains("- b:"));
    }
}
