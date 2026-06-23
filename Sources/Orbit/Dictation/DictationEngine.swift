//  DictationEngine.swift
//  The state machine that ties recording → ASR → (optional) LLM polish →
//  (optional) auto-insert together, driving the on-screen pill. First hotkey
//  press starts recording; the next commits (finish & recognize); ✗ cancels.
//
//  Native version currently implements the HTTP transport (buffer the utterance,
//  upload once). Realtime WebSocket + 火山引擎 streaming are planned next; the
//  engine surfaces a clear message if one of those is selected.

import AppKit

/// Thread-safe accumulator for PCM frames arriving on the audio thread.
private final class FrameSink {
    private let lock = NSLock()
    private var buffer: [Int16] = []

    func append(_ frame: [Int16]) {
        lock.lock(); buffer.append(contentsOf: frame); lock.unlock()
    }
    func drain() -> [Int16] {
        lock.lock(); defer { buffer = []; lock.unlock() }
        return buffer
    }
    func reset() {
        lock.lock(); buffer = []; lock.unlock()
    }
}

@MainActor
final class DictationEngine {
    private let store: SettingsStore
    private let pill = PillController()
    private let sink = FrameSink()
    private var capture: AudioCapture?

    private var active = false
    private var finishing = false

    private let httpRate = 16_000

    init(store: SettingsStore) {
        self.store = store
        pill.onCancel = { [weak self] in self?.cancel() }
        pill.onCommit = { [weak self] in self?.commit() }
    }

    // MARK: - Entry points

    func toggle() {
        if active { commit() } else { start() }
    }

    func start() {
        guard !active else { return }
        active = true
        finishing = false
        sink.reset()
        pill.show()
        pill.update(status: .recording, text: "", level: 0)

        guard let asr = store.settings.asrModel,
              let resolved = store.settings.resolve(asr) else {
            fail("未选择语音识别模型，请在「模型」里添加并选择。")
            return
        }
        guard resolved.transport == .http else {
            fail("传输方式「\(resolved.transport.rawValue)」暂未在原生版本实现，请在模型里选择 HTTP。")
            return
        }

        let sink = self.sink
        let capture = AudioCapture(targetRate: httpRate) { [weak self] frame in
            sink.append(frame)
            let level = AudioCapture.level(frame)
            Task { @MainActor in
                guard let self, self.active, !self.finishing else { return }
                self.pill.update(status: .recording, text: "", level: level)
            }
        }
        do {
            try capture.start()
            self.capture = capture
        } catch {
            fail("无法开始录音：\(error.localizedDescription)")
        }
    }

    func commit() {
        guard active, !finishing else { return }
        finishing = true
        capture?.stop()
        capture = nil

        guard let asr = store.settings.asrModel,
              let resolved = store.settings.resolve(asr) else {
            fail("识别模型缺失。")
            return
        }

        let samples = sink.drain()
        if samples.isEmpty { finishIdle(); return }

        pill.update(status: .transcribing, text: "", level: 0)
        let settings = store.settings
        let rate = httpRate

        Task { @MainActor in
            do {
                let wav = WAV.encode(samples, rate: rate)
                var text = try await Transcriber.http(resolved, wav: wav)

                if settings.llmPolishEnabled,
                   let llm = settings.llmModel,
                   let resolvedLLM = settings.resolve(llm) {
                    pill.update(status: .polishing, text: text, level: 0)
                    let template = settings.activeTemplate?.template
                        ?? "{{\(settings.insertPosition)}}"
                    if let polished = try? await LLM.polish(
                        resolvedLLM,
                        template: template,
                        placeholder: settings.insertPosition,
                        transcript: text
                    ), !polished.isEmpty {
                        text = polished
                    }
                }

                if settings.autoInsert, !text.isEmpty {
                    pill.update(status: .inserting, text: text, level: 0)
                    TextInserter.insert(text)
                }
                finishIdle()
            } catch {
                fail("识别失败：\(error.localizedDescription)")
            }
        }
    }

    func cancel() {
        capture?.stop()
        capture = nil
        sink.reset()
        finishIdle()
    }

    // MARK: - Helpers

    private func fail(_ message: String) {
        NSLog("[dictation] \(message)")
        pill.update(status: .error, text: message, level: 0)
        capture?.stop()
        capture = nil
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            finishIdle()
        }
    }

    private func finishIdle() {
        active = false
        finishing = false
        pill.hide()
    }
}
