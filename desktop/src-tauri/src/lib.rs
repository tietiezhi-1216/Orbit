mod commands;
mod secrets;

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use tokio_util::sync::CancellationToken;

pub struct AppState {
    pub(crate) http: reqwest::Client,
    /// Cancellation tokens of in-flight chat streams, keyed by request id.
    pub(crate) chat_cancels: Mutex<HashMap<u32, CancellationToken>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .build()
        .expect("failed to build http client");

    tauri::Builder::default()
        .manage(AppState {
            http,
            chat_cancels: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::settings::save_api_key,
            commands::settings::has_api_key,
            commands::settings::delete_api_key,
            commands::connection::test_connection,
            commands::chat::chat_stream,
            commands::chat::chat_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
