//  Keycodes.swift
//  Human-readable labels for the macOS virtual keycodes we let users bind as the
//  dictation hotkey. Mirrors the label map from the old web UI.

import Foundation

enum Keycodes {
    static let labels: [String: String] = [
        "54": "右 ⌘", "55": "左 ⌘",
        "59": "左 ⌃", "62": "右 ⌃",
        "56": "左 ⇧", "60": "右 ⇧",
        "58": "左 ⌥", "61": "右 ⌥",
        "63": "Fn",
        "49": "空格", "36": "回车", "53": "Esc",
        "48": "Tab", "51": "删除", "57": "大写锁定",
    ]

    static func label(for code: String) -> String {
        if code.isEmpty { return "—" }
        return labels[code] ?? "键码 \(code)"
    }
}
