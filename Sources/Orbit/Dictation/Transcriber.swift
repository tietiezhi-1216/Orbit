//  Transcriber.swift
//  Speech → text. ASR is multi-protocol — the model's `wire` decides the shape:
//   • openAITranscription — OpenAI Whisper-style `POST /audio/transcriptions`
//     (multipart upload, returns `{ text }`).
//   • mimoAudioASR        — MiMo-style audio over `POST /chat/completions`
//     (the WAV goes in as a Base64 `input_audio` content part + `asr_options`).
//  Plus an in-memory WAV encoder for the recorded PCM.

import Foundation

enum Transcriber {

    /// Transcribe a recorded WAV, dispatching on the model's ASR protocol.
    static func transcribe(_ model: ResolvedModel, wav: Data) async throws -> String {
        switch model.wire {
        case .mimoAudioASR: return try await chatAudio(model, wav: wav)
        default:            return try await http(model, wav: wav) // Whisper multipart
        }
    }

    // MARK: - OpenAI Whisper (multipart)

    /// Transcribe a recorded WAV. Returns the recognized text.
    static func http(_ model: ResolvedModel, wav: Data) async throws -> String {
        guard !model.apiKey.trimmed.isEmpty else {
            throw OrbitError("所选语音识别服务商缺少 API Key。")
        }
        // Endpoint comes from the model's ASR service (defaults to
        // /audio/transcriptions) — not hardcoded, so a provider can mount it
        // elsewhere via the service's path override.
        guard let url = model.url else {
            throw OrbitError("语音识别 Base URL 无效。")
        }

        let boundary = "orbit-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        model.authorize(&req)
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

    // MARK: - MiMo audio over chat completions

    /// MiMo-style ASR: the WAV is Base64-embedded as an `input_audio` content
    /// part in a `POST /chat/completions` call; the transcript comes back in the
    /// assistant message. See https://mimo.mi.com/docs (Speech Recognition).
    static func chatAudio(_ model: ResolvedModel, wav: Data) async throws -> String {
        guard !model.apiKey.trimmed.isEmpty else {
            throw OrbitError("所选语音识别服务商缺少 API Key。")
        }
        guard let url = model.url else {
            throw OrbitError("语音识别 Base URL 无效。")
        }

        let dataURL = "data:audio/wav;base64,\(wav.base64EncodedString())"
        let content: [[String: Any]] = [
            ["type": "input_audio", "input_audio": ["data": dataURL]]
        ]
        let lang = (model.language?.trimmed).flatMap { $0.isEmpty ? nil : $0 } ?? "auto"
        let payload: [String: Any] = [
            "model": model.model,
            "messages": [["role": "user", "content": content]],
            "asr_options": ["language": lang],
            "stream": false,
        ]

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        model.authorize(&req)
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw OrbitError("语音识别请求失败（\(code)）：\(text.prefix(300))")
        }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        return chatTranscript(json).trimmed
    }

    /// Pull the transcript out of a chat-completions response. The assistant
    /// `content` is usually a plain string, but tolerate the structured
    /// content-parts array too.
    private static func chatTranscript(_ json: [String: Any]) -> String {
        guard let choices = json["choices"] as? [[String: Any]],
              let message = choices.first?["message"] as? [String: Any] else { return "" }
        if let s = message["content"] as? String { return s }
        if let parts = message["content"] as? [[String: Any]] {
            return parts.compactMap { ($0["text"] as? String) ?? ($0["transcript"] as? String) }.joined()
        }
        return ""
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
