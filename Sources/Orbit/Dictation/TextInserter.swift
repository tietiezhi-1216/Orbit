//  TextInserter.swift
//  Deliver the final text into whatever app has focus. Instead of synthesizing
//  the text key-by-key (slow and flaky for CJK / IME), we put it on the
//  pasteboard, synthesize ⌘V, then restore the previous clipboard. Requires
//  Accessibility permission to post the keystroke into other apps.

import AppKit

enum TextInserter {

    static func insert(_ text: String) {
        guard !text.isEmpty else { return }
        let pasteboard = NSPasteboard.general
        let previous = pasteboard.string(forType: .string)

        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)

        pasteCommandV()

        // Restore the user's clipboard shortly after the paste has been read.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            pasteboard.clearContents()
            if let previous { pasteboard.setString(previous, forType: .string) }
        }
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
