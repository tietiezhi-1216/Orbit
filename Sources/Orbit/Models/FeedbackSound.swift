//  FeedbackSound.swift
//  The customizable feedback-sound system: short audio cues played when the user
//  starts / stops a dictation session.
//
//  Feedback sounds are intentionally data-driven. macOS alert sounds are seeded
//  as built-in Orbit cues, the initial event bindings follow the user's current
//  macOS default alert sound, and custom cues can be single-source or multi-track
//  mixes made from system sounds, generated tones, and imported audio files.
//
//  Persisted inside `Settings`. Decoding is tolerant (each field falls back to a
//  default) so a malformed cue never wipes the rest of the configuration.

import Foundation

// MARK: - Waveform

/// The shape of a synthesized tone. Square / sawtooth are harsher and are
/// rendered a little quieter (see `FeedbackSoundPlayer`).
enum Waveform: String, Codable, Hashable, CaseIterable, Identifiable {
    case sine
    case triangle
    case square
    case sawtooth

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .sine:     return "正弦（柔和）"
        case .triangle: return "三角（清脆）"
        case .square:   return "方波（电子）"
        case .sawtooth: return "锯齿（明亮）"
        }
    }
}

// MARK: - Tone spec

/// A synthesized tone. A linear glide from `startHz` to `endHz` makes "rising"
/// and "falling" cues feel directional; set them equal for a steady pitch.
struct ToneSpec: Codable, Hashable {
    /// Pitch at the start of the cue, in Hz.
    var startHz: Double
    /// Pitch at the end of the cue, in Hz (== `startHz` for a steady tone).
    var endHz: Double
    /// Total length, in seconds.
    var duration: Double
    var waveform: Waveform

    init(startHz: Double = 660,
         endHz: Double = 660,
         duration: Double = 0.12,
         waveform: Waveform = .sine) {
        self.startHz = startHz
        self.endHz = endHz
        self.duration = duration
        self.waveform = waveform
    }
}

// MARK: - Track source

/// A source that can be used inside a multi-track cue. It deliberately excludes
/// `.mix` to keep mixes one level deep and easy to edit in Settings.
enum TrackSoundSource: Hashable {
    case systemDefault
    case system(String)   // a macOS named alert sound
    case tone(ToneSpec)   // a synthesized tone
    case file(String)     // a filename under the app's sounds directory

    var symbol: String {
        switch self {
        case .systemDefault: return "speaker.wave.2"
        case .system:        return "waveform"
        case .tone:          return "waveform.path"
        case .file:          return "music.note"
        }
    }

    var kindLabel: String {
        switch self {
        case .systemDefault: return "系统默认音效"
        case .system:        return "系统内置音效"
        case .tone:          return "合成音调"
        case .file:          return "导入文件"
        }
    }

    var detailLabel: String {
        switch self {
        case .systemDefault:
            return "跟随 macOS 默认提示音"
        case .system(let name):
            return "系统音效 · \(name)"
        case .tone(let spec):
            return String(format: "合成音调 · %.0f→%.0f Hz · %.0f ms", spec.startHz, spec.endHz, spec.duration * 1000)
        case .file(let filename):
            return filename.isEmpty ? "导入文件 · 未选择" : "导入文件 · \(filename)"
        }
    }

    var importedFilenames: [String] {
        if case .file(let filename) = self, !filename.isEmpty { return [filename] }
        return []
    }
}

extension TrackSoundSource: Codable {
    private enum CodingKeys: String, CodingKey { case type, system, tone, file }
    private enum Kind: String, Codable { case systemDefault, system, tone, file }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let kind = (try? c.decode(Kind.self, forKey: .type)) ?? .systemDefault
        switch kind {
        case .systemDefault:
            self = .systemDefault
        case .system:
            self = .system((try? c.decode(String.self, forKey: .system)) ?? FeedbackSoundSettings.fallbackSystemSoundName)
        case .tone:
            self = .tone((try? c.decode(ToneSpec.self, forKey: .tone)) ?? ToneSpec())
        case .file:
            self = .file((try? c.decode(String.self, forKey: .file)) ?? "")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .systemDefault:
            try c.encode(Kind.systemDefault, forKey: .type)
        case .system(let name):
            try c.encode(Kind.system, forKey: .type)
            try c.encode(name, forKey: .system)
        case .tone(let spec):
            try c.encode(Kind.tone, forKey: .type)
            try c.encode(spec, forKey: .tone)
        case .file(let filename):
            try c.encode(Kind.file, forKey: .type)
            try c.encode(filename, forKey: .file)
        }
    }
}

// MARK: - Multi-track mix

struct SoundTrack: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var source: TrackSoundSource
    /// Delay from cue start, in seconds.
    var offset: Double
    /// Gain applied on top of the cue and master volume (0…1).
    var volume: Double

    init(id: String = UUID().uuidString,
         name: String = "",
         source: TrackSoundSource = .systemDefault,
         offset: Double = 0,
         volume: Double = 1) {
        self.id = id
        self.name = name
        self.source = source
        self.offset = offset
        self.volume = volume
    }

    private enum CodingKeys: String, CodingKey { case id, name, source, offset, volume }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        source = (try? c.decode(TrackSoundSource.self, forKey: .source)) ?? .systemDefault
        offset = try c.decodeIfPresent(Double.self, forKey: .offset) ?? 0
        volume = try c.decodeIfPresent(Double.self, forKey: .volume) ?? 1
    }
}

struct SoundMix: Codable, Hashable {
    var tracks: [SoundTrack]

    init(tracks: [SoundTrack] = []) {
        self.tracks = tracks
    }

    var importedFilenames: [String] {
        tracks.flatMap { $0.source.importedFilenames }
    }
}

// MARK: - Sound source

/// Where a cue's audio comes from. `Codable` via an explicit `type` discriminator
/// so the on-disk shape is stable and tolerant of partial data.
enum SoundSource: Hashable {
    case silent
    case systemDefault     // current macOS alert sound
    case system(String)    // a macOS named alert sound
    case tone(ToneSpec)    // a synthesized tone
    case file(String)      // a filename under the app's sounds directory
    case mix(SoundMix)     // user-authored multi-track cue

    var symbol: String {
        switch self {
        case .silent:        return "speaker.slash"
        case .systemDefault: return "speaker.wave.2"
        case .system:        return "waveform"
        case .tone:          return "waveform.path"
        case .file:          return "music.note"
        case .mix:           return "slider.horizontal.3"
        }
    }

    var kindLabel: String {
        switch self {
        case .silent:        return "静音"
        case .systemDefault: return "系统默认音效"
        case .system:        return "系统内置音效"
        case .tone:          return "合成音调"
        case .file:          return "导入文件"
        case .mix:           return "多音轨混音"
        }
    }

    var detailLabel: String {
        switch self {
        case .silent:
            return "不播放声音"
        case .systemDefault:
            return "跟随 macOS 默认提示音"
        case .system(let name):
            return "系统音效 · \(name)"
        case .tone(let spec):
            return String(format: "合成音调 · %.0f→%.0f Hz · %.0f ms", spec.startHz, spec.endHz, spec.duration * 1000)
        case .file(let filename):
            return filename.isEmpty ? "导入文件 · 未选择" : "导入文件 · \(filename)"
        case .mix(let mix):
            return "多音轨混音 · \(mix.tracks.count) 条音轨"
        }
    }

    var importedFilenames: [String] {
        switch self {
        case .file(let filename):
            return filename.isEmpty ? [] : [filename]
        case .mix(let mix):
            return mix.importedFilenames
        case .silent, .systemDefault, .system, .tone:
            return []
        }
    }
}

extension SoundSource: Codable {
    private enum CodingKeys: String, CodingKey { case type, system, tone, file, mix }
    private enum Kind: String, Codable { case silent, systemDefault, system, tone, file, mix }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let kind = (try? c.decode(Kind.self, forKey: .type)) ?? .silent
        switch kind {
        case .silent:
            self = .silent
        case .systemDefault:
            self = .systemDefault
        case .system:
            self = .system((try? c.decode(String.self, forKey: .system)) ?? FeedbackSoundSettings.fallbackSystemSoundName)
        case .tone:
            self = .tone((try? c.decode(ToneSpec.self, forKey: .tone)) ?? ToneSpec())
        case .file:
            self = .file((try? c.decode(String.self, forKey: .file)) ?? "")
        case .mix:
            self = .mix((try? c.decode(SoundMix.self, forKey: .mix)) ?? SoundMix())
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .silent:
            try c.encode(Kind.silent, forKey: .type)
        case .systemDefault:
            try c.encode(Kind.systemDefault, forKey: .type)
        case .system(let name):
            try c.encode(Kind.system, forKey: .type)
            try c.encode(name, forKey: .system)
        case .tone(let spec):
            try c.encode(Kind.tone, forKey: .type)
            try c.encode(spec, forKey: .tone)
        case .file(let name):
            try c.encode(Kind.file, forKey: .type)
            try c.encode(name, forKey: .file)
        case .mix(let mix):
            try c.encode(Kind.mix, forKey: .type)
            try c.encode(mix, forKey: .mix)
        }
    }
}

// MARK: - Sound cue (a library entry)

/// One named, reusable sound the user can bind to events. `volume` is the cue's
/// own gain (0…1); the player multiplies it by the master volume.
struct SoundCue: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var source: SoundSource
    var volume: Double

    init(id: String = UUID().uuidString,
         name: String,
         source: SoundSource,
         volume: Double = 1) {
        self.id = id
        self.name = name
        self.source = source
        self.volume = volume
    }

    private enum CodingKeys: String, CodingKey { case id, name, source, volume }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "提示音"
        source = (try? c.decode(SoundSource.self, forKey: .source)) ?? .silent
        volume = try c.decodeIfPresent(Double.self, forKey: .volume) ?? 1
    }

    var importedFilenames: [String] { source.importedFilenames }

    var isBuiltInSystemCue: Bool { FeedbackSoundSettings.isBuiltInCueID(id) }
}

// MARK: - Feedback event

/// A moment in the dictation gesture worth an audible cue. The four map onto the
/// engine's gesture state machine (see `DictationEngine`).
enum FeedbackEvent: String, Codable, Hashable, CaseIterable, Identifiable {
    case clickStart    // 单击开始一次免手会话
    case clickStop     // 再次单击结束会话
    case holdPress     // 长按按下（按住说话）
    case holdRelease   // 长按松手结束

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .clickStart:   return "单击 · 开始"
        case .clickStop:    return "单击 · 结束"
        case .holdPress:    return "长按 · 按下"
        case .holdRelease:  return "长按 · 松手"
        }
    }

    var summary: String {
        switch self {
        case .clickStart:   return "点一下开始录音时"
        case .clickStop:    return "再点一下结束录音时"
        case .holdPress:    return "按住进入「按住说话」时"
        case .holdRelease:  return "松开按键结束时"
        }
    }

    var symbol: String {
        switch self {
        case .clickStart:   return "play.circle"
        case .clickStop:    return "stop.circle"
        case .holdPress:    return "hand.tap"
        case .holdRelease:  return "hand.raised.slash"
        }
    }
}

// MARK: - System sounds

struct SystemSoundInfo: Identifiable, Hashable {
    var name: String
    var url: URL?

    var id: String { name }
}

// MARK: - Feedback sound settings (persisted)

/// The whole feedback-sound configuration: a master switch + volume, the cue
/// library, and which cue each event is bound to.
struct FeedbackSoundSettings: Codable, Hashable {
    var enabled: Bool
    /// Master gain applied on top of each cue's own volume (0…1).
    var masterVolume: Double
    /// The cue library (built-in system cues + anything the user creates).
    var cues: [SoundCue]
    /// `FeedbackEvent.rawValue` → `SoundCue.id`. A missing key means "no sound".
    var bindings: [String: String]

    init(enabled: Bool = true,
         masterVolume: Double = 0.7,
         cues: [SoundCue],
         bindings: [String: String]) {
        self.enabled = enabled
        self.masterVolume = masterVolume
        let normalized = FeedbackSoundSettings.normalized(cues: cues, bindings: bindings)
        self.cues = normalized.cues
        self.bindings = normalized.bindings
    }

    private enum CodingKeys: String, CodingKey { case enabled, masterVolume, cues, bindings }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = FeedbackSoundSettings.defaults
        enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? d.enabled
        masterVolume = try c.decodeIfPresent(Double.self, forKey: .masterVolume) ?? d.masterVolume
        let decodedCues = (try? c.decode([SoundCue].self, forKey: .cues)) ?? d.cues
        let decodedBindings = (try? c.decode([String: String].self, forKey: .bindings)) ?? d.bindings
        let normalized = FeedbackSoundSettings.normalized(cues: decodedCues, bindings: decodedBindings)
        cues = normalized.cues
        bindings = normalized.bindings
    }

    /// The cue currently bound to an event, if any.
    func cue(for event: FeedbackEvent) -> SoundCue? {
        guard let id = bindings[event.rawValue] else { return nil }
        return cues.first { $0.id == id }
    }

    // MARK: Seed and migration

    static let systemDefaultCueID = "orbit.system.default"
    static let fallbackSystemSoundName = "Tink"

    static var defaults: FeedbackSoundSettings {
        FeedbackSoundSettings(
            enabled: true,
            masterVolume: 0.7,
            cues: builtInSystemCues,
            bindings: Dictionary(uniqueKeysWithValues: FeedbackEvent.allCases.map { ($0.rawValue, systemDefaultCueID) })
        )
    }

    static var builtInSystemCues: [SoundCue] {
        let defaultCue = SoundCue(
            id: systemDefaultCueID,
            name: "系统默认（跟随 macOS）",
            source: .systemDefault,
            volume: 0.9
        )
        let namedCues = systemSoundNames.map { name in
            SoundCue(
                id: systemCueID(for: name),
                name: "\(name)（系统）",
                source: .system(name),
                volume: 0.9
            )
        }
        return [defaultCue] + namedCues
    }

    static func isBuiltInCueID(_ id: String) -> Bool {
        id == systemDefaultCueID || id.hasPrefix("orbit.system.")
    }

    static func systemCueID(for name: String) -> String {
        let slug = name.lowercased().map { ch -> Character in
            if ch.isLetter || ch.isNumber { return ch }
            return "-"
        }
        .reduce(into: "") { $0.append($1) }
        .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return "orbit.system.\(slug.isEmpty ? "sound" : slug)"
    }

    private static let legacySeedCueIDs: Set<String> = [
        "orbit.start", "orbit.stop", "orbit.press", "orbit.release"
    ]

    private static func normalized(cues inputCues: [SoundCue], bindings inputBindings: [String: String]) -> (cues: [SoundCue], bindings: [String: String]) {
        let inputByID = Dictionary(uniqueKeysWithValues: inputCues.map { ($0.id, $0) })
        var bindings = inputBindings
        for event in FeedbackEvent.allCases {
            guard let cueID = bindings[event.rawValue], legacySeedCueIDs.contains(cueID) else { continue }
            if inputByID[cueID].map(isLegacySeedCue(_:)) ?? true {
                bindings[event.rawValue] = systemDefaultCueID
            }
        }

        let builtIns = builtInSystemCues
        let builtInIDs = Set(builtIns.map(\.id))
        var result = builtIns
        var seen = builtInIDs
        for cue in inputCues {
            if builtInIDs.contains(cue.id) { continue }
            if isLegacySeedCue(cue) { continue }
            guard seen.insert(cue.id).inserted else { continue }
            result.append(cue)
        }
        return (result, bindings)
    }

    private static func isLegacySeedCue(_ cue: SoundCue) -> Bool {
        guard legacySeedCueIDs.contains(cue.id) else { return false }
        if case .tone = cue.source { return true }
        return false
    }

    // MARK: macOS system sounds

    /// macOS named alert sounds available via `NSSound(named:)` or the system
    /// sounds folder. Enumerated dynamically so newly added system sounds become
    /// Orbit built-ins without a code change.
    static var systemSounds: [SystemSoundInfo] {
        let systemDir = URL(fileURLWithPath: "/System/Library/Sounds", isDirectory: true)
        let libraryDir = URL(fileURLWithPath: "/Library/Sounds", isDirectory: true)
        let urls = [systemDir, libraryDir].flatMap { dir -> [URL] in
            (try? FileManager.default.contentsOfDirectory(
                at: dir,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]
            )) ?? []
        }

        var byName: [String: URL] = [:]
        for url in urls {
            let ext = url.pathExtension.lowercased()
            guard ["aiff", "aif", "wav", "caf"].contains(ext) else { continue }
            byName[url.deletingPathExtension().lastPathComponent] = url
        }

        let names = Set(fallbackSystemSoundNames).union(byName.keys)
        return names
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
            .map { SystemSoundInfo(name: $0, url: byName[$0]) }
    }

    static var systemSoundNames: [String] { systemSounds.map(\.name) }

    static func systemSoundURL(for name: String) -> URL? {
        systemSounds.first { $0.name == name }?.url
    }

    static func systemDefaultSoundURL() -> URL? {
        guard let raw = UserDefaults.standard.string(forKey: "com.apple.sound.beep.sound"), !raw.isEmpty else {
            return systemSoundURL(for: fallbackSystemSoundName)
        }
        if raw.hasPrefix("/") {
            let url = URL(fileURLWithPath: raw)
            if FileManager.default.fileExists(atPath: url.path) { return url }
            return systemSoundURL(for: url.deletingPathExtension().lastPathComponent)
        }
        return systemSoundURL(for: raw) ?? systemSoundURL(for: fallbackSystemSoundName)
    }

    static func systemDefaultSoundDisplayName() -> String {
        systemDefaultSoundURL()?.deletingPathExtension().lastPathComponent ?? "系统默认"
    }

    private static let fallbackSystemSoundNames = [
        "Basso", "Blow", "Bottle", "Frog", "Funk", "Glass", "Hero",
        "Morse", "Ping", "Pop", "Purr", "Sosumi", "Submarine", "Tink",
    ]
}
