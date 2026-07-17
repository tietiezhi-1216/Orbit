use serde_json::Value;

use super::{str_arg, ToolCtx};
use crate::skills;

pub fn skill_tool(ctx: &ToolCtx, args: &Value) -> Result<String, String> {
    let name = str_arg(args, "name")?;
    skills::read_skill(&ctx.app, name)
}
