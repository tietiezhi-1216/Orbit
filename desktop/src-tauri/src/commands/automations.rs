use tauri::AppHandle;

use crate::automation::{self, AutomationDocument, AutomationMeta, AutomationValidationIssue};

#[tauri::command]
pub fn list_automations(
    app: AppHandle,
    include_archived: Option<bool>,
) -> Result<Vec<AutomationMeta>, String> {
    automation::store::list(&app, include_archived.unwrap_or(false))
}

#[tauri::command]
pub fn load_automation(app: AppHandle, id: String) -> Result<AutomationDocument, String> {
    automation::store::load(&app, &id)
}

#[tauri::command]
pub fn create_automation(
    app: AppHandle,
    name: Option<String>,
) -> Result<AutomationDocument, String> {
    automation::store::create(&app, name.as_deref().unwrap_or("未命名自动化"))
}

#[tauri::command]
pub fn save_automation(
    app: AppHandle,
    automation: AutomationDocument,
) -> Result<AutomationDocument, String> {
    automation::store::save(&app, automation)
}

#[tauri::command]
pub fn validate_automation(
    automation: AutomationDocument,
    publish: Option<bool>,
) -> Vec<AutomationValidationIssue> {
    automation::validate::validate(&automation, publish.unwrap_or(false))
}

#[tauri::command]
pub fn archive_automation(
    app: AppHandle,
    id: String,
    archived: bool,
) -> Result<AutomationMeta, String> {
    automation::store::archive(&app, &id, archived)
}

#[tauri::command]
pub fn delete_automation(app: AppHandle, id: String) -> Result<(), String> {
    automation::store::delete(&app, &id)
}
