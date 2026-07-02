//  Chat.swift
//  The conversation model behind Orbit's chat (Agent) surface. Codable so a
//  later debounced JSON writer can persist conversations, but in-memory for now.

import Foundation

enum ChatRole: String, Codable, Hashable {
    case system, user, assistant, tool
}

/// A tool invocation the assistant asked for. `argumentsJSON` is kept as the raw
/// JSON string the model produced (OpenAI streams it in fragments; Anthropic
/// gives an object we re-serialize) so it round-trips verbatim in follow-ups.
struct ToolCall: Codable, Hashable {
    var id: String
    var name: String
    var argumentsJSON: String
}

/// The outcome of running a tool, fed back to the model on the next round.
struct ToolResult: Codable, Hashable {
    var toolCallID: String
    var content: String
    var isError: Bool
}

struct ChatMessage: Identifiable, Codable, Hashable {
    let id: UUID
    let role: ChatRole
    var content: String
    /// Set on an assistant message that requested tool invocations.
    var toolCalls: [ToolCall]?
    /// Set on a `.tool` message carrying a tool's output back to the model.
    var toolResult: ToolResult?
    /// Local file paths of assets a tool produced (images/videos) so the
    /// transcript can render them inline.
    var attachments: [String]?

    init(id: UUID = UUID(), role: ChatRole, content: String,
         toolCalls: [ToolCall]? = nil, toolResult: ToolResult? = nil,
         attachments: [String]? = nil) {
        self.id = id
        self.role = role
        self.content = content
        self.toolCalls = toolCalls
        self.toolResult = toolResult
        self.attachments = attachments
    }
}

struct Conversation: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var messages: [ChatMessage]
    var createdAt: Date

    init(id: UUID = UUID(),
         title: String = "新对话",
         messages: [ChatMessage] = [],
         createdAt: Date = Date()) {
        self.id = id
        self.title = title
        self.messages = messages
        self.createdAt = createdAt
    }

    /// A short title derived from the first user message.
    static func deriveTitle(from text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "新对话" }
        let firstLine = trimmed.split(whereSeparator: \.isNewline).first.map(String.init) ?? trimmed
        return firstLine.count > 30 ? String(firstLine.prefix(30)) + "…" : firstLine
    }
}
