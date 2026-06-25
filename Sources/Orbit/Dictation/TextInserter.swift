//  TextInserter.swift
//  Deliver the final text into whatever app has focus. Instead of synthesizing
//  the text key-by-key (slow and flaky for CJK / IME), we put it on the
//  pasteboard, synthesize ⌘V, then restore the previous clipboard.
//
//  Synthesizing a keystroke INTO ANOTHER APP requires Accessibility permission —
//  without it the event is silently dropped, so the paste never lands. We gate on
//  that here and report whether the paste was actually attempted, letting the
//  caller fall back to a manual-copy affordance (the Typeless-style "已复制").

import AppKit
import ApplicationServices

enum TextInserter {

    /// Whether we're trusted to post synthetic keystrokes into other apps.
    static var canAutoInsert: Bool {
        Permissions.accessibility == .granted
    }

    /// Whether the system's currently-focused UI element is an editable text
    /// field — i.e. there's a cursor to paste into. Used to decide auto-insert vs
    /// parking the result in the result stack. Requires Accessibility (returns
    /// false without it, so results fall back to the manual queue).
    static func isEditableFieldFocused() -> Bool {
        guard canAutoInsert else { return false }
        let system = AXUIElementCreateSystemWide()
        var focused: CFTypeRef?
        guard AXUIElementCopyAttributeValue(system, kAXFocusedUIElementAttribute as CFString, &focused) == .success,
              let elementCF = focused,
              CFGetTypeID(elementCF) == AXUIElementGetTypeID()
        else { return false }
        let element = elementCF as! AXUIElement

        var roleCF: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleCF)
        let role = (roleCF as? String) ?? ""
        let editableRoles: Set<String> = ["AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"]
        if editableRoles.contains(role) { return true }

        // Web / Electron fields often report a generic role but a settable value.
        var settable: DarwinBoolean = false
        if AXUIElementIsAttributeSettable(element, kAXValueAttribute as CFString, &settable) == .success,
           settable.boolValue {
            return true
        }
        return false
    }

    /// Put text on the general pasteboard so it can be pasted manually.
    static func copyToPasteboard(_ text: String) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)
    }

    /// Awaitable paste: set the clipboard, synthesize ⌘V, restore the clipboard —
    /// and only return once the whole cycle is done. The result queue awaits this
    /// so concurrent deliveries never clobber each other's clipboard (pastes run
    /// strictly one at a time). Returns false without trying if Accessibility is
    /// missing.
    @MainActor
    @discardableResult
    static func insertAwaiting(_ text: String) async -> Bool {
        guard !text.isEmpty, canAutoInsert else { return false }
        let pasteboard = NSPasteboard.general
        let previous = pasteboard.string(forType: .string)
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        try? await Task.sleep(nanoseconds: 80_000_000)
        pasteCommandV()
        try? await Task.sleep(nanoseconds: 600_000_000)
        pasteboard.clearContents()
        if let previous { pasteboard.setString(previous, forType: .string) }
        return true
    }

    /// Try to paste `text` into the focused app. Returns `false` *without
    /// attempting* when Accessibility isn't granted (the keystroke would be
    /// dropped) — the caller should then surface a manual-copy fallback.
    @discardableResult
    static func insert(_ text: String) -> Bool {
        guard !text.isEmpty, canAutoInsert else { return false }

        let pasteboard = NSPasteboard.general
        let previous = pasteboard.string(forType: .string)
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)

        // Give the pasteboard a beat to settle, then synthesize ⌘V. The pill is a
        // non-activating panel, so focus is still in the user's target app.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            pasteCommandV()
            // Restore the user's clipboard once the paste has been read.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                pasteboard.clearContents()
                if let previous { pasteboard.setString(previous, forType: .string) }
            }
        }
        return true
    }

    /// Synthesize a ⌘V keystroke at the HID level.
    private static func pasteCommandV() {
        let source = CGEventSource(stateID: .combinedSessionState)
        let vKey: CGKeyCode = 9   // ANSI 'v'

        let down = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: true)
        down?.flags = .maskCommand
        let up = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: false)
        up?.flags = .maskCommand

        down?.post(tap: .cghidEventTap)
        up?.post(tap: .cghidEventTap)
    }
}
