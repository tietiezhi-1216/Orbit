//  AppDelegate.swift
//  Wires the app together: the settings store, the controller the UI talks to,
//  a menu-bar status item, and the Settings window. The dictation engine and
//  hotkey monitor are attached here too (Stage B) but the UI compiles and runs
//  without them.

import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var store: SettingsStore!
    private var controller: AppController!
    private var statusItem: NSStatusItem!
    private var settingsWindow: NSWindow?

    // Dictation layer (attached in Stage B).
    private var engine: DictationEngine?
    private var hotkey: HotkeyMonitor?

    func applicationDidFinishLaunching(_ notification: Notification) {
        store = SettingsStore()
        controller = AppController(store: store)

        setupStatusItem()
        attachDictation()

        // First run (nothing configured yet) → open settings so the user can
        // add a provider and grant permissions.
        if store.settings.providers.isEmpty {
            showSettings(nil)
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        store.flush()
        hotkey?.stop()
    }

    // MARK: - Dictation wiring

    private func attachDictation() {
        let engine = DictationEngine(store: store)
        self.engine = engine

        let monitor = HotkeyMonitor(store: store)
        self.hotkey = monitor

        // The controller exposes UI intents; route them to the engine/monitor.
        controller.onToggleDictation = { [weak engine] in engine?.toggle() }
        controller.onBeginHotkeyCapture = { [weak monitor] in monitor?.beginCapture() }
        controller.onCancelHotkeyCapture = { [weak monitor] in monitor?.cancelCapture() }

        // The monitor reports a captured key + fires the bound hotkey.
        monitor.onCaptured = { [weak controller] code in
            controller?.finishHotkeyCapture(keycode: code)
        }
        monitor.onHotkey = { [weak engine] in engine?.toggle() }

        monitor.start()
    }

    // MARK: - Status bar

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "waveform.circle",
                                   accessibilityDescription: "Orbit")
        }
        let menu = NSMenu()
        menu.addItem(withTitle: "设置…", action: #selector(showSettings(_:)), keyEquivalent: ",")
        menu.addItem(.separator())
        menu.addItem(withTitle: "开始 / 停止听写",
                     action: #selector(toggleDictation(_:)), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "退出 Orbit", action: #selector(quit(_:)), keyEquivalent: "q")
        for item in menu.items { item.target = self }
        statusItem.menu = menu
    }

    @objc private func toggleDictation(_ sender: Any?) { controller.toggleDictation() }
    @objc private func quit(_ sender: Any?) { NSApp.terminate(nil) }

    // MARK: - Settings window

    @objc func showSettings(_ sender: Any?) {
        if settingsWindow == nil {
            let root = SettingsRootView()
                .environmentObject(controller)
                .environmentObject(store)
            let hosting = NSHostingController(rootView: root)
            let window = NSWindow(contentViewController: hosting)
            window.title = "Orbit 设置"
            window.styleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
            // Transparent, content-spanning titlebar: the sidebar material runs to
            // the top and the traffic lights stay fixed — no per-page chrome shift.
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.titlebarSeparatorStyle = .none
            window.isMovableByWindowBackground = false
            window.setContentSize(NSSize(width: 940, height: 680))
            window.center()
            window.isReleasedWhenClosed = false
            settingsWindow = window
        }
        controller.refreshStatus()
        NSApp.activate(ignoringOtherApps: true)
        settingsWindow?.makeKeyAndOrderFront(nil)
    }
}
