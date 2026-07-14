use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::secrets;

/// Non-sensitive app settings persisted as JSON under `app_config_dir()`.
/// The API key never lands here — it lives in the OS credential store.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub base_url: String,
    pub model: String,
}

fn settings_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法定位配置目录：{e}"))?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取设置失败：{e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("设置文件损坏：{e}"))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("创建配置目录失败：{e}"))?;
    }
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw).map_err(|e| format!("写入设置失败：{e}"))
}

#[tauri::command]
pub fn save_api_key(value: String) -> Result<(), String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("API Key 不能为空".into());
    }
    secrets::set_api_key(trimmed)
}

#[tauri::command]
pub fn has_api_key() -> Result<bool, String> {
    Ok(secrets::get_api_key()?.is_some())
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    secrets::delete_api_key()
}
