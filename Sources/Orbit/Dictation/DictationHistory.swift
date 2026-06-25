//  DictationHistory.swift
//  A persisted log of dictation results so a transcript is never lost once the
//  pill disappears. Each entry keeps the raw recognized text, the polished
//  rewrite (if any), and whether it was auto-inserted. Stored as its own JSON
//  file under Application Support — kept out of config.json so transcripts never
//  bloat the settings document.

import Foundation
import Combine

struct DictationEntry: Identifiable, Codable, Hashable {
    var id: String
    var date: Date
    /// Raw ASR text.
    var transcript: String
    /// LLM-polished text, when polishing ran and produced something.
    var polished: String?
    /// Whether the result was pasted into the focused app.
    var inserted: Bool
    /// Which template produced this (the template name), or "raw" for
    /// transcribe-only sessions. Optional so older history still decodes.
    var mode: String?

    /// The text actually delivered: the polish if present, else the raw transcript.
    var finalText: String {
        if let p = polished, !p.isEmpty { return p }
        return transcript
    }

    init(id: String = UUID().uuidString,
         date: Date,
         transcript: String,
         polished: String? = nil,
         inserted: Bool,
         mode: String? = nil) {
        self.id = id
        self.date = date
        self.transcript = transcript
        self.polished = polished
        self.inserted = inserted
        self.mode = mode
    }
}

@MainActor
final class DictationHistoryStore: ObservableObject {
    @Published private(set) var entries: [DictationEntry] = []

    private let fileURL: URL
    private let maxEntries = 200

    init() {
        let dir = SettingsStore.configDirectory()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("history.json")
        load()
    }

    /// Record a new result at the top of the list.
    func add(_ entry: DictationEntry) {
        entries.insert(entry, at: 0)
        if entries.count > maxEntries {
            entries.removeLast(entries.count - maxEntries)
        }
        save()
    }

    func remove(id: String) {
        entries.removeAll { $0.id == id }
        save()
    }

    func clear() {
        entries.removeAll()
        save()
    }

    // MARK: - Persistence

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let data = try? Data(contentsOf: fileURL),
              let decoded = try? decoder.decode([DictationEntry].self, from: data)
        else { return }
        entries = decoded
    }

    private func save() {
        let snapshot = entries
        let url = fileURL
        DispatchQueue.global(qos: .utility).async {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted]
            guard let data = try? encoder.encode(snapshot) else { return }
            try? data.write(to: url, options: .atomic)
        }
    }
}
