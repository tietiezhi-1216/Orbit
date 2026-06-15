//! Global hotkey listener. Uses `rdev` so we can react to a single modifier
//! (e.g. right ⌘ = `MetaRight`) or any other key — not just chords. The same
//! listener powers "learn a key": when `capturing` is set, the next keypress is
//! reported back to the UI instead of toggling dictation.
//!
//! On macOS this needs Accessibility permission (System Settings → Privacy &
//! Security → Accessibility).

use std::cell::RefCell;
use std::collections::HashSet;
use std::sync::atomic::Ordering;
use std::sync::Arc;

use rdev::{listen, Event, EventType};
use tauri::{AppHandle, Emitter, Manager};

use crate::state::AppState;

pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        // Tracks currently-held keys so a held modifier fires only once.
        let pressed: RefCell<HashSet<String>> = RefCell::new(HashSet::new());

        let callback = move |event: Event| match event.event_type {
            EventType::KeyPress(key) => {
                let name = format!("{key:?}");
                if pressed.borrow().contains(&name) {
                    return;
                }
                pressed.borrow_mut().insert(name.clone());
                on_press(&app, name);
            }
            EventType::KeyRelease(key) => {
                pressed.borrow_mut().remove(&format!("{key:?}"));
            }
            _ => {}
        };

        if let Err(e) = listen(callback) {
            eprintln!(
                "[hotkey] global listener failed: {e:?} — grant Accessibility permission to Orbit"
            );
        }
    });
}

fn on_press(app: &AppHandle, name: String) {
    let state = match app.try_state::<Arc<AppState>>() {
        Some(s) => s.inner().clone(),
        None => return,
    };

    // "Learn a key" mode: report the captured key and stop.
    if state.capturing.swap(false, Ordering::SeqCst) {
        let _ = app.emit("hotkey://captured", name);
        return;
    }

    if name == *state.hotkey.lock() {
        crate::dictation::toggle(app);
    }
}
