use serde_json::Value;

use super::{str_arg, ToolCtx};

pub async fn device_call(ctx: &ToolCtx, args: &Value) -> Result<String, String> {
    let device_id = str_arg(args, "device_id")?;
    let capability = str_arg(args, "capability")?;
    let input = args
        .get("input")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let result = crate::commands::devices::invoke_device_inner(
        &ctx.app, &ctx.http, device_id, capability, input,
    )
    .await?;
    serde_json::to_string_pretty(&result).map_err(|error| error.to_string())
}
