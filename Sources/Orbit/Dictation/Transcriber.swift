//  Transcriber.swift
//  Speech → text over an OpenAI-compatible HTTP transcription endpoint
//  (`POST /audio/transcriptions`), plus an in-memory WAV encoder for the
//  recorded PCM. Realtime WebSocket and 火山引擎 transports are planned next.

import Foundation

enum Transcriber {

    /// Transcribe a recorded WAV. Returns the recognized text.
    static func http(_ model: ResolvedModel, wav: Data) async throws -> String {
        guard !model.apiKey.trimmed.isEmpty else {
            throw OrbitError("所选语音识别服务商缺少 API Key。")
        }
        let base = model.baseURL.trimmingTrailingSlash
        guard let url = URL(string: base + "/audio/transcriptions") else {
            throw OrbitError("语音识别 Base URL 无效。")
        }

        let boundary = "orbit-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        req.setValue("Bearer \(model.apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n")
        body.append("Content-Type: audio/wav\r\n\r\n")
        body.append(wav)
        body.append("\r\n")
        appendField(&body, boundary: boundary, name: "model", value: model.model)
        appendField(&body, boundary: boundary, name: "response_format", value: "json")
        if let lang = model.language, !lang.isEmpty {
            appendField(&body, boundary: boundary, name: "language", value: lang)
        }
        body.append("--\(boundary)--\r\n")
        req.httpBody = body

        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw OrbitError("语音识别请求失败（\(code)）：\(text.prefix(300))")
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return (json?["text"] as? String) ?? ""
    }

    private static func appendField(_ body: inout Data, boundary: String, name: String, value: String) {
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
        body.append(value)
        body.append("\r\n")
    }
}

// MARK: - WAV encoding

enum WAV {
    /// Encode mono Int16 PCM as a little-endian WAV container.
    static func encode(_ samples: [Int16], rate: Int) -> Data {
        let dataBytes = samples.withUnsafeBytes { Data($0) }   // little-endian on Apple Silicon
        let dataSize = dataBytes.count
        let byteRate = rate * 2

        var d = Data()
        d.append("RIFF")
        d.appendLE(UInt32(36 + dataSize))
        d.append("WAVE")
        d.append("fmt ")
        d.appendLE(UInt32(16))        // PCM fmt chunk size
        d.appendLE(UInt16(1))         // audio format = PCM
        d.appendLE(UInt16(1))         // channels = mono
        d.appendLE(UInt32(rate))
        d.appendLE(UInt32(byteRate))
        d.appendLE(UInt16(2))         // block align
        d.appendLE(UInt16(16))        // bits per sample
        d.append("data")
        d.appendLE(UInt32(dataSize))
        d.append(dataBytes)
        return d
    }
}

// MARK: - Data helpers

extension Data {
    mutating func append(_ string: String) {
        if let d = string.data(using: .utf8) { append(d) }
    }
    mutating func appendLE(_ value: UInt16) {
        Swift.withUnsafeBytes(of: value.littleEndian) { append(contentsOf: $0) }
    }
    mutating func appendLE(_ value: UInt32) {
        Swift.withUnsafeBytes(of: value.littleEndian) { append(contentsOf: $0) }
    }
}
