//! Process-wide shared state, managed by Tauri as `Arc<AppState>`.

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

use parking_lot::Mutex;
use tokio::sync::mpsc;

use crate::config::Settings;

/// Control messages sent from the UI / hotkey into a running dictation session.
#[derive(Debug, Clone, Copy)]
pub enum SessionCtrl {
    /// Finish recording and run recognition (second hotkey press / ✓).
    Commit,
    /// Abort and discard (✗).
    Cancel,
}

#[derive(Default)]
pub struct DictInner {
    pub active: bool,
    pub ctrl_tx: Option<mpsc::Sender<SessionCtrl>>,
}

pub struct AppState {
    pub config_dir: PathBuf,
    pub settings: Mutex<Settings>,
    /// The hotkey the global listener currently matches against. Kept separate
    /// from `settings` so the listener can read it cheaply on every keypress.
    pub hotkey: Mutex<String>,
    /// When true, the next global keypress is captured as the new hotkey
    /// instead of triggering dictation.
    pub capturing: AtomicBool,
    pub dict: Mutex<DictInner>,
}

impl AppState {
    pub fn new(config_dir: PathBuf, settings: Settings) -> Self {
        let hotkey = settings.hotkey.clone();
        AppState {
            config_dir,
            settings: Mutex::new(settings),
            hotkey: Mutex::new(hotkey),
            capturing: AtomicBool::new(false),
            dict: Mutex::new(DictInner::default()),
        }
    }
}
