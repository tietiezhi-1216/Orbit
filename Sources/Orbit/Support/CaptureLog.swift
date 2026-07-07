//  CaptureLog.swift
//  A dead-simple append-to-file diagnostic log for the screenshot pipeline.
//  NSLog from a signed/release .app does not reliably surface through the macOS
//  unified log (`log show` comes up empty), which makes remote diagnosis of
//  "the hotkey does nothing" almost impossible. Writing to a plain file under
//  ~/.orbit that anyone can `tail` sidesteps that entirely. Cheap and best-effort
//  — failures to write are swallowed.

import Foundation

enum CaptureLog {
    private static let queue = DispatchQueue(label: "com.orbit.capturelog")
    private static let fileURL = SettingsStore.configDirectory()
        .appendingPathComponent("capture-debug.log")

    private static let stampFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        return f
    }()

    static func log(_ message: String) {
        NSLog("[capture] \(message)")   // keep the unified-log line too
        let line = "\(stampFormatter.string(from: Date()))  \(message)\n"
        queue.async {
            guard let data = line.data(using: .utf8) else { return }
            if let handle = try? FileHandle(forWritingTo: fileURL) {
                defer { try? handle.close() }
                _ = try? handle.seekToEnd()
                try? handle.write(contentsOf: data)
            } else {
                try? data.write(to: fileURL, options: .atomic)
            }
        }
    }
}
