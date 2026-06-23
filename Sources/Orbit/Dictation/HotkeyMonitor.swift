//  HotkeyMonitor.swift
//  Global hotkey listener via a macOS CGEventTap, on its own thread + run loop.
//
//  We read ONLY the integer keycode from each event (never converting it to a
//  string), so a single right-⌘ (keycode 54) or any other key toggles dictation,
//  and "learn a key" capture works. Needs Accessibility / Input Monitoring
//  permission; without it the tap simply fails to install (logged, no crash).

import AppKit
import Combine

final class HotkeyMonitor {
    /// Reports the keycode captured in "learn a key" mode.
    var onCaptured: ((String) -> Void)?
    /// Fires when the bound hotkey is pressed.
    var onHotkey: (() -> Void)?

    private var capturing = false
    private var hotkey: String
    private var pressed = Set<Int64>()

    private var tap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var thread: Thread?
    private var cancellable: AnyCancellable?

    init(store: SettingsStore) {
        hotkey = store.settings.hotkey
        cancellable = store.hotkeyDidChange.sink { [weak self] code in
            self?.hotkey = code
        }
    }

    func beginCapture() { capturing = true }
    func cancelCapture() { capturing = false }

    func start() {
        let thread = Thread { [weak self] in self?.runTap() }
        thread.name = "com.orbit.hotkey"
        self.thread = thread
        thread.start()
    }

    func stop() {
        if let tap { CGEvent.tapEnable(tap: tap, enable: false) }
    }

    // MARK: - Tap thread

    private func runTap() {
        let mask = (CGEventMask(1) << CGEventType.keyDown.rawValue)
                 | (CGEventMask(1) << CGEventType.keyUp.rawValue)
                 | (CGEventMask(1) << CGEventType.flagsChanged.rawValue)

        guard let tap = CGEvent.tapCreate(
            tap: .cghidEventTap,
            place: .headInsertEventTap,
            options: .listenOnly,
            eventsOfInterest: mask,
            callback: orbitHotkeyCallback,
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        ) else {
            NSLog("[hotkey] 无法安装全局事件监听 — 请在「系统设置 → 隐私与安全性 → 辅助功能」授权 Orbit，然后重启应用。")
            return
        }

        self.tap = tap
        let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        runLoopSource = source
        CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        CFRunLoopRun()
    }

    // MARK: - Event handling (called on the tap thread)

    fileprivate func handle(type: CGEventType, event: CGEvent) {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap { CGEvent.tapEnable(tap: tap, enable: true) }
            return
        }
        let code = event.getIntegerValueField(.keyboardEventKeycode)
        switch type {
        case .keyDown:
            if pressed.insert(code).inserted { onPress(code) }
        case .keyUp:
            pressed.remove(code)
        case .flagsChanged:
            // Modifiers arrive as FlagsChanged carrying their keycode; toggle.
            if pressed.contains(code) {
                pressed.remove(code)
            } else {
                pressed.insert(code)
                onPress(code)
            }
        default:
            break
        }
    }

    private func onPress(_ code: Int64) {
        if capturing {
            capturing = false
            DispatchQueue.main.async { [weak self] in self?.onCaptured?(String(code)) }
            return
        }
        if String(code) == hotkey {
            DispatchQueue.main.async { [weak self] in self?.onHotkey?() }
        }
    }
}

/// C-compatible tap callback: recover the monitor from `refcon` and dispatch.
private func orbitHotkeyCallback(
    _ proxy: CGEventTapProxy,
    _ type: CGEventType,
    _ event: CGEvent,
    _ refcon: UnsafeMutableRawPointer?
) -> Unmanaged<CGEvent>? {
    if let refcon {
        let monitor = Unmanaged<HotkeyMonitor>.fromOpaque(refcon).takeUnretainedValue()
        monitor.handle(type: type, event: event)
    }
    return Unmanaged.passUnretained(event)
}
