//  AudioCapture.swift
//  Microphone capture via AVAudioEngine. Taps the default input, downmixes to
//  mono, linearly resamples to a target rate, and hands `Int16` PCM frames to a
//  callback (on AVAudioEngine's tap thread). Mirrors the old Rust cpal pipeline.

import AVFoundation

final class AudioCapture {
    private let engine = AVAudioEngine()
    private let targetRate: Double
    private let onFrame: ([Int16]) -> Void
    private var srcRate: Double = 48_000

    /// - Parameters:
    ///   - targetRate: desired output sample rate (e.g. 16_000).
    ///   - onFrame: called with each resampled mono Int16 frame, off the main thread.
    init(targetRate: Int, onFrame: @escaping ([Int16]) -> Void) {
        self.targetRate = Double(targetRate)
        self.onFrame = onFrame
    }

    func start() throws {
        let input = engine.inputNode
        let format = input.inputFormat(forBus: 0)
        srcRate = format.sampleRate
        guard srcRate > 0, format.channelCount > 0 else {
            throw OrbitError("找不到可用的麦克风输入。")
        }
        let target = targetRate
        let cb = onFrame
        input.installTap(onBus: 0, bufferSize: 2_048, format: format) { buffer, _ in
            let frame = AudioCapture.process(buffer, srcRate: format.sampleRate, targetRate: target)
            if !frame.isEmpty { cb(frame) }
        }
        engine.prepare()
        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
    }

    // MARK: - DSP

    private static func process(_ buffer: AVAudioPCMBuffer, srcRate: Double, targetRate: Double) -> [Int16] {
        guard let channelData = buffer.floatChannelData else { return [] }
        let channels = Int(buffer.format.channelCount)
        let n = Int(buffer.frameLength)
        if channels == 0 || n == 0 { return [] }

        // Downmix to mono.
        var mono = [Float](repeating: 0, count: n)
        for i in 0..<n {
            var acc: Float = 0
            for c in 0..<channels { acc += channelData[c][i] }
            mono[i] = acc / Float(channels)
        }

        if srcRate == targetRate {
            return mono.map(toI16)
        }

        // Linear resample mono → targetRate.
        let ratio = targetRate / srcRate
        let outLen = Int(Double(n) * ratio)
        var out = [Int16]()
        out.reserveCapacity(outLen)
        for i in 0..<outLen {
            let pos = Double(i) / ratio
            let idx = Int(pos)
            let frac = Float(pos - Double(idx))
            let a = idx < n ? mono[idx] : 0
            let b = (idx + 1) < n ? mono[idx + 1] : a
            out.append(toI16(a + (b - a) * frac))
        }
        return out
    }

    private static func toI16(_ v: Float) -> Int16 {
        let clamped = max(-1.0, min(1.0, v))
        return Int16(clamped * 32_767)
    }

    /// RMS level mapped to a lively 0…1, for the recording meter.
    static func level(_ frame: [Int16]) -> Float {
        if frame.isEmpty { return 0 }
        var sum = 0.0
        for s in frame {
            let f = Double(s) / 32_768.0
            sum += f * f
        }
        let rms = (sum / Double(frame.count)).squareRoot()
        return Float(min(1.0, rms * 4.0))
    }
}
