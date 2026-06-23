//  LLM.swift
//  Optional polish step. After ASR, the recognized text is injected into the
//  active prompt template and sent to an OpenAI-compatible chat model, which
//  rewrites it. Toggleable — never mandatory.

import Foundation

enum LLM {

    /// Substitute the transcript into the template. `placeholder` is the name
    /// inside `{{…}}`; if absent, the transcript is appended after the template.
    static func render(template: String, placeholder: String, transcript: String) -> String {
        let token = "{{\(placeholder)}}"
        if template.contains(token) {
            return template.replacingOccurrences(of: token, with: transcript)
        }
        return "\(template)\n\n\(transcript)"
    }

    static func polish(_ model: ResolvedModel,
                       template: String,
                       placeholder: String,
                       transcript: String) async throws -> String {
        guard !model.apiKey.trimmed.isEmpty else {
            throw OrbitError("所选大模型服务商缺少 API Key。")
        }
        let base = model.baseURL.trimmingTrailingSlash
        guard let url = URL(string: base + "/chat/completions") else {
            throw OrbitError("大模型 Base URL 无效。")
        }
        let content = render(template: template, placeholder: placeholder, transcript: transcript)

        let payload: [String: Any] = [
            "model": model.model,
            "messages": [["role": "user", "content": content]],
            "temperature": 0.3,
        ]
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        req.setValue("Bearer \(model.apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw OrbitError("大模型请求失败（\(code)）：\(text.prefix(300))")
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let choices = json?["choices"] as? [[String: Any]]
        let message = choices?.first?["message"] as? [String: Any]
        let text = (message?["content"] as? String) ?? ""
        return text.trimmed
    }
}
