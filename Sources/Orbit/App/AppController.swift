//  AppController.swift
//  The app "brain" the UI talks to for actions and live status. Owns the
//  settings store and (wired up in the dictation layer) the hotkey monitor and
//  dictation engine. Published properties drive the Settings UI.

import Foundation
import AppKit
import Combine

enum OrbitWorkspace {
    case chat
    case settings
}

@MainActor
final class AppController: ObservableObject {
    let store: SettingsStore

    /// Main-window workspace selection. Settings are shown in-window, not as a
    /// sheet or a separate window.
    @Published var workspace: OrbitWorkspace = .chat
    @Published var settingsSection: SettingsSection = .providers

    /// True while we're listening for the next keypress to bind as the hotkey.
    @Published var capturingHotkey = false
    @Published var micPermission: PermissionState = .notDetermined
    @Published var axPermission: PermissionState = .notDetermined
    @Published var audioInputs: [String] = []

    /// Set by the dictation layer once it's constructed (avoids a hard
    /// compile-time dependency from the UI on the engine).
    var onBeginHotkeyCapture: (() -> Void)?
    var onCancelHotkeyCapture: (() -> Void)?
    var onToggleDictation: (() -> Void)?

    private var cancellables = Set<AnyCancellable>()

    init(store: SettingsStore) {
        self.store = store
        refreshStatus()
    }

    func refreshStatus() {
        micPermission = Permissions.microphone
        axPermission = Permissions.accessibility
        audioInputs = AudioDevices.inputNames()
    }

    func openChatWorkspace() {
        workspace = .chat
    }

    func openSettingsWorkspace(_ section: SettingsSection = .providers) {
        refreshStatus()
        settingsSection = section
        workspace = .settings
    }

    // MARK: Permissions

    func requestMicrophone() {
        Permissions.requestMicrophone { [weak self] _ in self?.refreshStatus() }
    }

    func requestAccessibility() {
        Permissions.promptAccessibility()
        // The grant happens in System Settings; re-check shortly after.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.refreshStatus()
        }
    }

    // MARK: Hotkey capture

    func beginHotkeyCapture() {
        capturingHotkey = true
        onBeginHotkeyCapture?()
    }

    func cancelHotkeyCapture() {
        capturingHotkey = false
        onCancelHotkeyCapture?()
    }

    /// Called by the hotkey monitor when a key is captured.
    func finishHotkeyCapture(keycode: String) {
        store.settings.hotkey = keycode
        capturingHotkey = false
    }

    func toggleDictation() {
        onToggleDictation?()
    }
}
