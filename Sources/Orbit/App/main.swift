//  main.swift
//  Entry point. Orbit runs as a menu-bar agent (LSUIElement / .accessory): no
//  Dock icon by default, a status-bar item, a Settings window, and a floating
//  recording pill.

import AppKit

// Top-level code is the program entry and already runs on the main thread;
// assume main-actor isolation so we can construct the @MainActor AppDelegate.
MainActor.assumeIsolated {
    let delegate = AppDelegate()
    let app = NSApplication.shared
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    app.run()
}
