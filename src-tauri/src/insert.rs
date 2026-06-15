//! Auto-insert the final text into whatever app currently has focus by
//! simulating keyboard input. On macOS this requires Accessibility permission
//! (System Settings → Privacy & Security → Accessibility). Run from the main
//! thread — see `dictation::finish`.

use enigo::{Enigo, Keyboard, Settings};

pub fn type_text(text: &str) -> anyhow::Result<()> {
    if text.is_empty() {
        return Ok(());
    }
    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| anyhow::anyhow!("enigo init failed: {e:?}"))?;
    enigo
        .text(text)
        .map_err(|e| anyhow::anyhow!("simulated typing failed: {e:?}"))?;
    Ok(())
}
