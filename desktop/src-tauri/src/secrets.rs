use keyring::Entry;

// Keychain service name matches the app identifier so entries are easy to
// locate in Keychain Access / Windows Credential Manager.
const SERVICE: &str = "com.tietiezhi.tietiezhi";
const API_KEY_USER: &str = "relay-api-key";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, API_KEY_USER).map_err(|e| format!("无法访问系统安全存储：{e}"))
}

/// Store the relay API key in the OS credential store.
pub fn set_api_key(value: &str) -> Result<(), String> {
    entry()?
        .set_password(value)
        .map_err(|e| format!("保存 API Key 失败：{e}"))
}

/// Read the relay API key; `Ok(None)` when nothing is stored yet.
pub fn get_api_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("读取 API Key 失败：{e}")),
    }
}

/// Remove the stored key; deleting a missing entry is not an error.
pub fn delete_api_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("删除 API Key 失败：{e}")),
    }
}
