//! Shortcut helpers shared by the capsule hint and the settings recorder.
//!
//! The wire format is the one `tauri-plugin-global-shortcut` parses, e.g.
//! "Alt+Space" / "CommandOrControl+Shift+D". Display is platform-flavoured.

const IS_MAC = navigator.platform.toLowerCase().includes("mac");

const MAC_SYMBOLS: Record<string, string> = {
  CommandOrControl: "⌘",
  Command: "⌘",
  Control: "⌃",
  Alt: "⌥",
  Option: "⌥",
  Shift: "⇧",
};

const WIN_LABELS: Record<string, string> = {
  CommandOrControl: "Ctrl",
  Command: "Win",
  Control: "Ctrl",
  Alt: "Alt",
  Option: "Alt",
  Shift: "Shift",
};

/** "Alt+Space" → "⌥Space" (macOS) / "Alt+Space" (Windows). */
export function formatShortcut(shortcut: string): string {
  const parts = shortcut.split("+").filter(Boolean);
  if (parts.length === 0) return shortcut;
  const table = IS_MAC ? MAC_SYMBOLS : WIN_LABELS;
  const rendered = parts.map((p) => table[p] ?? p);
  return IS_MAC ? rendered.join("") : rendered.join("+");
}

/**
 * Turn a keydown into the wire format. Returns null while only modifiers are
 * held (the user hasn't picked the main key yet) or when no modifier is present
 * — a bare key would swallow normal typing system-wide.
 */
export function shortcutFromEvent(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.metaKey) mods.push("CommandOrControl");
  if (e.ctrlKey && !e.metaKey) mods.push("Control");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");

  const key = mainKey(e);
  if (!key) return null;
  if (mods.length === 0) return null;
  return [...mods, key].join("+");
}

/** The non-modifier key of an event, in the plugin's naming. */
function mainKey(e: KeyboardEvent): string | null {
  const code = e.code;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code;
  switch (code) {
    case "Space":
      return "Space";
    case "Enter":
      return "Enter";
    case "Backquote":
      return "`";
    case "Minus":
      return "-";
    case "Equal":
      return "=";
    case "Slash":
      return "/";
    case "Backslash":
      return "\\";
    case "Comma":
      return ",";
    case "Period":
      return ".";
    case "Semicolon":
      return ";";
    case "Quote":
      return "'";
    case "BracketLeft":
      return "[";
    case "BracketRight":
      return "]";
    default:
      return null; // modifiers and anything we don't map
  }
}
