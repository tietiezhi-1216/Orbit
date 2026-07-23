use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::model::{
    AutomationDocument, AutomationMeta, AutomationNode, AutomationPosition, AutomationSettings,
    MissedSchedulePolicy,
};
use super::validate;

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct AutomationIndex {
    version: u32,
    automations: Vec<AutomationMeta>,
}

fn store_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位数据目录：{error}"))?
        .join("automations"))
}

fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(root(app)?.join("index.json"))
}

fn draft_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    validate_id(id)?;
    Ok(root(app)?.join(id).join("draft.json"))
}

fn validate_id(id: &str) -> Result<(), String> {
    Uuid::parse_str(id)
        .map(|_| ())
        .map_err(|_| "Automation ID 无效".to_string())
}

fn read_index(app: &AppHandle) -> Result<AutomationIndex, String> {
    let path = index_path(app)?;
    if !path.exists() {
        return Ok(AutomationIndex {
            version: 1,
            automations: Vec::new(),
        });
    }
    let raw =
        std::fs::read_to_string(path).map_err(|error| format!("读取自动化列表失败：{error}"))?;
    serde_json::from_str(&raw).map_err(|error| format!("自动化列表文件损坏：{error}"))
}

fn write_json_atomic(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "自动化存储路径无效".to_string())?;
    std::fs::create_dir_all(parent).map_err(|error| format!("创建自动化目录失败：{error}"))?;
    let raw = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    let temp = path.with_extension("json.tmp");
    std::fs::write(&temp, raw).map_err(|error| format!("写入自动化临时文件失败：{error}"))?;
    if let Err(first_error) = std::fs::rename(&temp, path) {
        if cfg!(windows) && path.exists() {
            std::fs::remove_file(path).map_err(|error| format!("替换自动化文件失败：{error}"))?;
            std::fs::rename(&temp, path).map_err(|error| format!("替换自动化文件失败：{error}"))?;
        } else {
            return Err(format!("保存自动化失败：{first_error}"));
        }
    }
    Ok(())
}

fn write_index(app: &AppHandle, index: &AutomationIndex) -> Result<(), String> {
    write_json_atomic(&index_path(app)?, index)
}

fn meta_from_document(document: &AutomationDocument, archived_at: u64) -> AutomationMeta {
    let trigger_type = document
        .nodes
        .iter()
        .find(|node| matches!(node.kind.as_str(), "manualTrigger" | "scheduleTrigger"))
        .map(|node| node.kind.clone())
        .unwrap_or_default();
    AutomationMeta {
        id: document.id.clone(),
        name: document.name.clone(),
        description: document.description.clone(),
        revision: document.revision,
        node_count: document.nodes.len(),
        trigger_type,
        created_at: document.created_at,
        updated_at: document.updated_at,
        archived_at,
    }
}

pub fn list(app: &AppHandle, include_archived: bool) -> Result<Vec<AutomationMeta>, String> {
    let _guard = store_lock().lock().map_err(|_| "自动化存储锁已损坏")?;
    let mut items = read_index(app)?.automations;
    if !include_archived {
        items.retain(|item| item.archived_at == 0);
    }
    items.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(items)
}

pub fn load(app: &AppHandle, id: &str) -> Result<AutomationDocument, String> {
    let _guard = store_lock().lock().map_err(|_| "自动化存储锁已损坏")?;
    let path = draft_path(app, id)?;
    if !path.is_file() {
        return Err("Automation 不存在或已被删除".into());
    }
    let raw =
        std::fs::read_to_string(path).map_err(|error| format!("读取 Automation 失败：{error}"))?;
    serde_json::from_str(&raw).map_err(|error| format!("Automation 草稿损坏：{error}"))
}

pub fn create(app: &AppHandle, name: &str) -> Result<AutomationDocument, String> {
    let _guard = store_lock().lock().map_err(|_| "自动化存储锁已损坏")?;
    let name = normalized_name(name)?;
    let timestamp = now_ms();
    let id = Uuid::new_v4().to_string();
    let document = AutomationDocument {
        schema_version: 1,
        id: id.clone(),
        name,
        description: String::new(),
        revision: 0,
        nodes: vec![AutomationNode {
            id: Uuid::new_v4().to_string(),
            kind: "manualTrigger".into(),
            type_version: 1,
            name: "手动触发".into(),
            position: AutomationPosition { x: 96.0, y: 180.0 },
            disabled: false,
            config: json!({}),
            inputs: Default::default(),
        }],
        edges: Vec::new(),
        settings: AutomationSettings {
            timezone: "Asia/Shanghai".into(),
            max_duration_ms: 300_000,
            max_concurrency: 4,
            on_missed_schedule: MissedSchedulePolicy::Skip,
        },
        created_at: timestamp,
        updated_at: timestamp,
    };
    write_json_atomic(&draft_path(app, &id)?, &document)?;

    let mut index = read_index(app)?;
    index.version = 1;
    index.automations.push(meta_from_document(&document, 0));
    if let Err(error) = write_index(app, &index) {
        let _ = std::fs::remove_dir_all(root(app)?.join(&id));
        return Err(error);
    }
    Ok(document)
}

pub fn save(
    app: &AppHandle,
    mut document: AutomationDocument,
) -> Result<AutomationDocument, String> {
    let _guard = store_lock().lock().map_err(|_| "自动化存储锁已损坏")?;
    validate_id(&document.id)?;
    let name = normalized_name(&document.name)?;
    let path = draft_path(app, &document.id)?;
    if !path.is_file() {
        return Err("Automation 不存在或已被删除".into());
    }
    document.name = name;
    let issues = validate::validate(&document, false);
    if let Some(first) = issues.first() {
        return Err(first.message.clone());
    }

    let mut index = read_index(app)?;
    let existing = index
        .automations
        .iter()
        .find(|item| item.id == document.id)
        .cloned()
        .ok_or_else(|| "自动化索引与草稿不一致".to_string())?;
    document.created_at = existing.created_at;
    document.updated_at = now_ms();
    write_json_atomic(&path, &document)?;
    if let Some(slot) = index
        .automations
        .iter_mut()
        .find(|item| item.id == document.id)
    {
        *slot = meta_from_document(&document, existing.archived_at);
    }
    write_index(app, &index)?;
    Ok(document)
}

pub fn archive(app: &AppHandle, id: &str, archived: bool) -> Result<AutomationMeta, String> {
    let _guard = store_lock().lock().map_err(|_| "自动化存储锁已损坏")?;
    validate_id(id)?;
    let mut index = read_index(app)?;
    let item = index
        .automations
        .iter_mut()
        .find(|item| item.id == id)
        .ok_or_else(|| "Automation 不存在或已被删除".to_string())?;
    item.archived_at = if archived { now_ms() } else { 0 };
    let result = item.clone();
    write_index(app, &index)?;
    Ok(result)
}

pub fn delete(app: &AppHandle, id: &str) -> Result<(), String> {
    let _guard = store_lock().lock().map_err(|_| "自动化存储锁已损坏")?;
    validate_id(id)?;
    let mut index = read_index(app)?;
    if !index.automations.iter().any(|item| item.id == id) {
        return Err("Automation 不存在或已被删除".into());
    }
    index.automations.retain(|item| item.id != id);
    write_index(app, &index)?;
    let directory = root(app)?.join(id);
    if directory.exists() {
        std::fs::remove_dir_all(directory)
            .map_err(|error| format!("删除 Automation 文件失败：{error}"))?;
    }
    Ok(())
}

fn normalized_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Ok("未命名自动化".into());
    }
    if name.chars().count() > 80 {
        return Err("名称不能超过 80 个字符".into());
    }
    Ok(name.into())
}
