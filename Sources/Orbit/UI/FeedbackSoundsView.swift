//  FeedbackSoundsView.swift
//  个性化 › 提示音: bind a sound to each dictation start/stop moment, preview the
//  macOS built-in cue library, and create custom single-source or multi-track
//  feedback sounds.

import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct FeedbackSoundsView: View {
    @EnvironmentObject var store: SettingsStore
    @State private var player = FeedbackSoundPlayer()
    /// Non-nil while the create/edit sheet is open (a working copy of the cue).
    @State private var editing: SoundCue?

    private var fb: FeedbackSoundSettings { store.settings.feedbackSounds }
    private var builtInCues: [SoundCue] { fb.cues.filter(\.isBuiltInSystemCue) }
    private var customCues: [SoundCue] { fb.cues.filter { !$0.isBuiltInSystemCue } }

    var body: some View {
        PageScaffold(title: "个性化 · 提示音", toolbar: {
            Button { startCreate() } label: { Label("添加自定义", systemImage: "plus") }
                .controlSize(.small)
        }) {
            Form {
                Section {
                    Toggle("启用提示音", isOn: $store.settings.feedbackSounds.enabled)
                    HStack(spacing: 10) {
                        Image(systemName: "speaker.fill").foregroundStyle(.secondary)
                        Slider(value: $store.settings.feedbackSounds.masterVolume, in: 0...1)
                        Image(systemName: "speaker.wave.3.fill").foregroundStyle(.secondary)
                    }
                    .disabled(!fb.enabled)
                } header: {
                    Text("总开关")
                } footer: {
                    Text("默认绑定跟随 macOS 当前系统提示音；每个触发时刻也可绑定任意内置系统音或自定义多音轨提示音。")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("触发事件") {
                    ForEach(FeedbackEvent.allCases) { event in
                        eventRow(event)
                    }
                }
                .disabled(!fb.enabled)

                Section {
                    ForEach(builtInCues) { cue in
                        cueRow(cue)
                    }
                } header: {
                    Text("内置系统提示音（\(builtInCues.count)）")
                } footer: {
                    Text("系统默认项会读取 macOS 的「警告声音」设置；其余项来自系统声音目录，并作为 Orbit 内置提示音保留。")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .disabled(!fb.enabled)

                Section {
                    if customCues.isEmpty {
                        Text("还没有自定义提示音。点右上角「添加自定义」，或复制任一系统提示音后再编辑，可混合系统音、合成音调和导入音频。")
                            .font(.caption).foregroundStyle(.secondary)
                    } else {
                        ForEach(customCues) { cue in
                            cueRow(cue)
                        }
                    }
                } header: {
                    Text("自定义提示音（\(customCues.count)）")
                }
                .disabled(!fb.enabled)
            }
            .formStyle(.grouped)
        }
        .sheet(item: $editing) { cue in
            SoundCueEditor(cue: cue) { saved in save(saved) }
        }
    }

    // MARK: Rows

    @ViewBuilder
    private func eventRow(_ event: FeedbackEvent) -> some View {
        HStack(spacing: 12) {
            Image(systemName: event.symbol)
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(event.displayName)
                Text(event.summary).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Picker("", selection: binding(for: event)) {
                Text("无").tag(String?.none)
                ForEach(fb.cues) { Text($0.name).tag(Optional($0.id)) }
            }
            .labelsHidden()
            .frame(width: 220)

            Button {
                if let cue = fb.cue(for: event) { player.play(cue, masterVolume: fb.masterVolume) }
            } label: {
                Image(systemName: "play.circle")
            }
            .buttonStyle(.borderless)
            .help("试听")
            .disabled(fb.cue(for: event) == nil)
        }
    }

    @ViewBuilder
    private func cueRow(_ cue: SoundCue) -> some View {
        HStack(spacing: 12) {
            Image(systemName: cue.source.symbol)
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(cue.name.isEmpty ? "未命名" : cue.name)
                    if cue.isBuiltInSystemCue {
                        Text("内置")
                            .font(.caption2.weight(.medium))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(.secondary.opacity(0.12), in: Capsule())
                            .foregroundStyle(.secondary)
                    }
                }
                Text(cue.source.detailLabel).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button { player.play(cue, masterVolume: fb.masterVolume) } label: {
                Image(systemName: "play.circle")
            }
            .buttonStyle(.borderless).help("试听")

            if cue.isBuiltInSystemCue {
                Button { duplicate(cue) } label: { Image(systemName: "plus.square.on.square") }
                    .buttonStyle(.borderless).help("复制为自定义")
            } else {
                Button { editing = cue } label: { Image(systemName: "pencil") }
                    .buttonStyle(.borderless).help("编辑")

                Button(role: .destructive) { store.removeSoundCue(id: cue.id) } label: {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless).help("删除")
            }
        }
    }

    // MARK: Actions

    private func binding(for event: FeedbackEvent) -> Binding<String?> {
        Binding(
            get: { store.settings.feedbackSounds.bindings[event.rawValue] },
            set: { store.bindFeedback(event: event, to: $0) }
        )
    }

    private func startCreate() {
        editing = SoundCue(
            name: "新提示音",
            source: .systemDefault,
            volume: 0.9
        )
    }

    private func duplicate(_ cue: SoundCue) {
        editing = SoundCue(
            name: "\(cue.name.replacingOccurrences(of: "（系统）", with: "")) 副本",
            source: cue.source,
            volume: cue.volume
        )
    }

    private func save(_ cue: SoundCue) {
        if store.settings.feedbackSounds.cues.contains(where: { $0.id == cue.id }) {
            store.updateSoundCue(id: cue.id) { $0 = cue }
        } else {
            store.addSoundCue(cue)
        }
    }
}

// MARK: - Editor

/// Create / edit a single cue, with a live "试听" so you can debug the sound as
/// you tune it. Edits stay on a working copy until "保存".
private struct SoundCueEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State var cue: SoundCue
    let onSave: (SoundCue) -> Void

    @State private var player = FeedbackSoundPlayer()

    private enum SourceKind: String, CaseIterable, Identifiable {
        case systemDefault, system, mix, tone, file
        var id: String { rawValue }
        var title: String {
            switch self {
            case .systemDefault: return "系统默认"
            case .system:        return "系统内置"
            case .mix:           return "多音轨混音"
            case .tone:          return "合成音调"
            case .file:          return "导入文件"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            Form {
                Section("名称") {
                    TextField("提示音名称", text: $cue.name)
                        .textFieldStyle(.roundedBorder)
                }

                Section("声音来源") {
                    Picker("类型", selection: sourceKind) {
                        ForEach(SourceKind.allCases) { Text($0.title).tag($0) }
                    }
                    sourceControls
                }

                Section("整体音量") {
                    HStack(spacing: 10) {
                        Image(systemName: "speaker.fill").foregroundStyle(.secondary)
                        Slider(value: $cue.volume, in: 0...1)
                        Image(systemName: "speaker.wave.3.fill").foregroundStyle(.secondary)
                    }
                }
            }
            .formStyle(.grouped)

            Divider()

            HStack(spacing: 10) {
                Button { player.play(cue) } label: { Label("试听", systemImage: "play.fill") }
                Spacer()
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("保存") { onSave(cue); dismiss() }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
            }
            .padding(16)
        }
        .frame(width: 620, height: 680)
    }

    // MARK: Source-specific controls

    @ViewBuilder
    private var sourceControls: some View {
        switch cue.source {
        case .systemDefault:
            LabeledContent("当前系统默认") {
                Text(FeedbackSoundSettings.systemDefaultSoundDisplayName())
                    .foregroundStyle(.secondary)
            }
            Text("跟随 macOS「系统设置 → 声音 → 警告声音」。用户改系统默认后，Orbit 自动使用新的默认提示音。")
                .font(.caption).foregroundStyle(.secondary)

        case .system(let name):
            Picker("系统音效", selection: systemName) {
                ForEach(FeedbackSoundSettings.systemSoundNames, id: \.self) { Text($0).tag($0) }
            }
            Text("作为 Orbit 内置音效使用 macOS 系统提示音「\(name)」。")
                .font(.caption).foregroundStyle(.secondary)

        case .mix:
            mixControls

        case .tone:
            toneControls

        case .file(let filename):
            fileControls(filename: filename)

        case .silent:
            Text("静音。").foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var toneControls: some View {
        Picker("波形", selection: tone.waveform) {
            ForEach(Waveform.allCases) { Text($0.displayName).tag($0) }
        }
        frequencyRow("起始音高", tone.startHz)
        frequencyRow("结束音高", tone.endHz)
        HStack {
            Text("时长")
            Slider(value: tone.duration, in: 0.03...0.8)
            Text(String(format: "%.0f ms", tone.duration.wrappedValue * 1000))
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.secondary)
                .frame(width: 56, alignment: .trailing)
        }
        Text("合成音可作为单独提示音，也可放进多音轨混音中，与系统音或导入音频叠加。")
            .font(.caption).foregroundStyle(.secondary)
    }

    @ViewBuilder
    private func fileControls(filename: String) -> some View {
        HStack {
            Image(systemName: "music.note")
            Text(filename.isEmpty ? "未选择文件" : filename)
                .lineLimit(1).truncationMode(.middle)
                .foregroundStyle(filename.isEmpty ? .secondary : .primary)
            Spacer()
            Button("选择文件…") { pickFileForCue() }
        }
        Text("支持 .wav / .aiff / .mp3 / .m4a / .caf。文件会复制进 Orbit 的应用目录统一管理。")
            .font(.caption).foregroundStyle(.secondary)
    }

    @ViewBuilder
    private var mixControls: some View {
        if mix.wrappedValue.tracks.isEmpty {
            Text("混音里还没有音轨。添加系统音、合成音调或导入文件后即可试听。")
                .font(.caption).foregroundStyle(.secondary)
        } else {
            ForEach(mix.wrappedValue.tracks) { track in
                MixTrackEditor(
                    track: bindingForTrack(id: track.id),
                    onDelete: { removeTrack(id: track.id) }
                )
            }
        }

        Menu {
            Button("系统默认") { addTrack(.systemDefault) }
            Button("系统内置") { addTrack(.system(FeedbackSoundSettings.systemSoundNames.first ?? FeedbackSoundSettings.fallbackSystemSoundName)) }
            Button("合成音调") { addTrack(.tone(ToneSpec())) }
            Button("导入文件…") { pickFileForNewTrack() }
        } label: {
            Label("添加音轨", systemImage: "plus")
        }
        Text("每条音轨都有独立延迟和音量。短系统音可做主体，轻微延迟的合成音可补充尾音或方向感。")
            .font(.caption).foregroundStyle(.secondary)
    }

    private func frequencyRow(_ label: String, _ value: Binding<Double>) -> some View {
        HStack {
            Text(label)
            Slider(value: value, in: 120...2000)
            Text(String(format: "%.0f Hz", value.wrappedValue))
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.secondary)
                .frame(width: 56, alignment: .trailing)
        }
    }

    // MARK: Bindings into associated values

    private var sourceKind: Binding<SourceKind> {
        Binding(
            get: {
                switch cue.source {
                case .systemDefault: return .systemDefault
                case .system:        return .system
                case .mix:           return .mix
                case .tone:          return .tone
                case .file:          return .file
                case .silent:        return .systemDefault
                }
            },
            set: { kind in
                switch kind {
                case .systemDefault:
                    if case .systemDefault = cue.source {} else { cue.source = .systemDefault }
                case .system:
                    if case .system = cue.source {} else { cue.source = .system(FeedbackSoundSettings.systemSoundNames.first ?? FeedbackSoundSettings.fallbackSystemSoundName) }
                case .mix:
                    if case .mix = cue.source {} else {
                        cue.source = .mix(SoundMix(tracks: [SoundTrack(name: "主音", source: .systemDefault)]))
                    }
                case .tone:
                    if case .tone = cue.source {} else { cue.source = .tone(ToneSpec()) }
                case .file:
                    if case .file = cue.source {} else { cue.source = .file("") }
                }
            }
        )
    }

    private var tone: Binding<ToneSpec> {
        Binding(
            get: { if case .tone(let t) = cue.source { return t } else { return ToneSpec() } },
            set: { cue.source = .tone($0) }
        )
    }

    private var systemName: Binding<String> {
        Binding(
            get: { if case .system(let n) = cue.source { return n } else { return FeedbackSoundSettings.systemSoundNames.first ?? FeedbackSoundSettings.fallbackSystemSoundName } },
            set: { cue.source = .system($0) }
        )
    }

    private var mix: Binding<SoundMix> {
        Binding(
            get: { if case .mix(let m) = cue.source { return m } else { return SoundMix() } },
            set: { cue.source = .mix($0) }
        )
    }

    private func bindingForTrack(id: String) -> Binding<SoundTrack> {
        Binding(
            get: {
                mix.wrappedValue.tracks.first { $0.id == id } ?? SoundTrack(id: id)
            },
            set: { updated in
                var value = mix.wrappedValue
                guard let index = value.tracks.firstIndex(where: { $0.id == id }) else { return }
                value.tracks[index] = updated
                mix.wrappedValue = value
            }
        )
    }

    // MARK: Actions

    private func addTrack(_ source: TrackSoundSource) {
        var value = mix.wrappedValue
        value.tracks.append(SoundTrack(name: "音轨 \(value.tracks.count + 1)", source: source))
        mix.wrappedValue = value
    }

    private func removeTrack(id: String) {
        var value = mix.wrappedValue
        value.tracks.removeAll { $0.id == id }
        mix.wrappedValue = value
    }

    private func pickFileForCue() {
        guard let filename = pickAudioFile() else { return }
        cue.source = .file(filename)
    }

    private func pickFileForNewTrack() {
        guard let filename = pickAudioFile() else { return }
        addTrack(.file(filename))
    }

    private func pickAudioFile() -> String? {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.audio]
        panel.prompt = "导入"
        guard panel.runModal() == .OK, let url = panel.url else { return nil }
        return FeedbackSoundPlayer.importFile(from: url)
    }
}

// MARK: - Mix track editor

private struct MixTrackEditor: View {
    @Binding var track: SoundTrack
    let onDelete: () -> Void

    private enum TrackSourceKind: String, CaseIterable, Identifiable {
        case systemDefault, system, tone, file
        var id: String { rawValue }
        var title: String {
            switch self {
            case .systemDefault: return "系统默认"
            case .system:        return "系统内置"
            case .tone:          return "合成音调"
            case .file:          return "导入文件"
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: track.source.symbol)
                    .foregroundStyle(.secondary)
                    .frame(width: 18)
                Text(track.name.isEmpty ? "未命名音轨" : track.name)
                    .font(.headline)
                Spacer()
                Button(role: .destructive) { onDelete() } label: {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
                .help("删除音轨")
            }

            TextField("音轨名称", text: $track.name)
                .textFieldStyle(.roundedBorder)

            Picker("来源", selection: sourceKind) {
                ForEach(TrackSourceKind.allCases) { Text($0.title).tag($0) }
            }

            sourceControls

            HStack {
                Text("延迟")
                Slider(value: $track.offset, in: 0...1.2)
                Text(String(format: "%.0f ms", track.offset * 1000))
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .frame(width: 62, alignment: .trailing)
            }

            HStack {
                Text("音量")
                Slider(value: $track.volume, in: 0...1)
                Text(String(format: "%.0f%%", track.volume * 100))
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .frame(width: 42, alignment: .trailing)
            }
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var sourceControls: some View {
        switch track.source {
        case .systemDefault:
            LabeledContent("当前系统默认") {
                Text(FeedbackSoundSettings.systemDefaultSoundDisplayName())
                    .foregroundStyle(.secondary)
            }
        case .system(let name):
            Picker("系统音效", selection: systemName) {
                ForEach(FeedbackSoundSettings.systemSoundNames, id: \.self) { Text($0).tag($0) }
            }
            Text("系统音效 · \(name)")
                .font(.caption).foregroundStyle(.secondary)
        case .tone:
            Picker("波形", selection: tone.waveform) {
                ForEach(Waveform.allCases) { Text($0.displayName).tag($0) }
            }
            frequencyRow("起始音高", tone.startHz)
            frequencyRow("结束音高", tone.endHz)
            HStack {
                Text("时长")
                Slider(value: tone.duration, in: 0.03...0.8)
                Text(String(format: "%.0f ms", tone.duration.wrappedValue * 1000))
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .frame(width: 56, alignment: .trailing)
            }
        case .file(let filename):
            HStack {
                Image(systemName: "music.note")
                Text(filename.isEmpty ? "未选择文件" : filename)
                    .lineLimit(1).truncationMode(.middle)
                    .foregroundStyle(filename.isEmpty ? .secondary : .primary)
                Spacer()
                Button("选择文件…") { pickFileForTrack() }
            }
        }
    }

    private func frequencyRow(_ label: String, _ value: Binding<Double>) -> some View {
        HStack {
            Text(label)
            Slider(value: value, in: 120...2000)
            Text(String(format: "%.0f Hz", value.wrappedValue))
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.secondary)
                .frame(width: 56, alignment: .trailing)
        }
    }

    private var sourceKind: Binding<TrackSourceKind> {
        Binding(
            get: {
                switch track.source {
                case .systemDefault: return .systemDefault
                case .system:        return .system
                case .tone:          return .tone
                case .file:          return .file
                }
            },
            set: { kind in
                switch kind {
                case .systemDefault:
                    if case .systemDefault = track.source {} else { track.source = .systemDefault }
                case .system:
                    if case .system = track.source {} else { track.source = .system(FeedbackSoundSettings.systemSoundNames.first ?? FeedbackSoundSettings.fallbackSystemSoundName) }
                case .tone:
                    if case .tone = track.source {} else { track.source = .tone(ToneSpec()) }
                case .file:
                    if case .file = track.source {} else { track.source = .file("") }
                }
            }
        )
    }

    private var tone: Binding<ToneSpec> {
        Binding(
            get: { if case .tone(let t) = track.source { return t } else { return ToneSpec() } },
            set: { track.source = .tone($0) }
        )
    }

    private var systemName: Binding<String> {
        Binding(
            get: { if case .system(let n) = track.source { return n } else { return FeedbackSoundSettings.systemSoundNames.first ?? FeedbackSoundSettings.fallbackSystemSoundName } },
            set: { track.source = .system($0) }
        )
    }

    private func pickFileForTrack() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.audio]
        panel.prompt = "导入"
        guard panel.runModal() == .OK, let url = panel.url,
              let filename = FeedbackSoundPlayer.importFile(from: url) else { return }
        track.source = .file(filename)
    }
}
