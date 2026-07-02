//  ChatStore.swift
//  In-memory conversation state for the chat (Agent) surface, plus streaming
//  send/cancel. Resolves the active LLM from the shared SettingsStore — the same
//  model dictation's polish uses, so there's no separate chat config.
//  (Persistence to ~/Library/Application Support/com.orbit.app/conversations.json
//  is a straightforward follow-up: the models are already Codable.)

import Foundation
import Combine

@MainActor
final class ChatStore: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var selectedID: UUID?
    @Published var isStreaming = false

    private let settings: SettingsStore
    private let usage: UsageStore
    private let tools: ToolRegistry
    private var streamTask: Task<Void, Never>?

    /// Safety cap on model→tool→model rounds within one send.
    private let maxToolRounds = 5

    init(settings: SettingsStore, usage: UsageStore, tools: ToolRegistry) {
        self.settings = settings
        self.usage = usage
        self.tools = tools
    }

    var selected: Conversation? {
        guard let id = selectedID else { return nil }
        return conversations.first { $0.id == id }
    }

    /// True once an LLM model is configured + selected as the active one.
    var hasLLM: Bool {
        settings.settings.llmModel.flatMap { settings.settings.resolve($0) } != nil
    }

    /// Whether a stream is active *for this specific conversation* (so the
    /// composer/spinner of other conversations aren't wrongly locked).
    func isStreaming(_ conversationID: UUID) -> Bool {
        isStreaming && streamingConversationID == conversationID
    }

    // MARK: - Conversation list

    func newConversation() {
        cancel()
        selectedID = nil
    }

    func deleteConversation(id: UUID) {
        if streamingConversationID == id { cancel() }
        conversations.removeAll { $0.id == id }
        if selectedID == id {
            selectedID = conversations.first?.id
        }
    }

    func renameConversation(id: UUID, title: String) {
        guard let i = conversations.firstIndex(where: { $0.id == id }) else { return }
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        conversations[i].title = trimmed.isEmpty ? "新对话" : trimmed
    }

    // MARK: - Streaming

    @Published private(set) var streamingConversationID: UUID?
    private var streamingMessageID: UUID?

    func cancel() {
        streamTask?.cancel()
        streamTask = nil
        // Drop an assistant placeholder that never received any content.
        if let cid = streamingConversationID, let mid = streamingMessageID,
           let ci = conversations.firstIndex(where: { $0.id == cid }),
           let mi = conversations[ci].messages.firstIndex(where: { $0.id == mid }),
           conversations[ci].messages[mi].role == .assistant,
           conversations[ci].messages[mi].content.isEmpty {
            conversations[ci].messages.remove(at: mi)
        }
        streamingConversationID = nil
        streamingMessageID = nil
        isStreaming = false
    }

    func send(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isStreaming else { return }
        let ci: Int
        let cid: UUID

        if let selectedID, let existingIndex = conversations.firstIndex(where: { $0.id == selectedID }) {
            ci = existingIndex
            cid = selectedID
        } else {
            let convo = Conversation()
            conversations.insert(convo, at: 0)
            selectedID = convo.id
            ci = 0
            cid = convo.id
        }

        conversations[ci].messages.append(ChatMessage(role: .user, content: trimmed))
        if conversations[ci].title == "新对话" {
            conversations[ci].title = Conversation.deriveTitle(from: trimmed)
        }

        // No model configured → answer locally instead of hitting the network.
        guard let model = settings.settings.llmModel.flatMap({ settings.settings.resolve($0) }) else {
            conversations[ci].messages.append(
                ChatMessage(role: .assistant,
                            content: "请先在「设置 → 模型」里配置一个大模型，并选为当前大模型。")
            )
            return
        }

        let assistant = ChatMessage(role: .assistant, content: "")
        let aid = assistant.id
        // Build the request history BEFORE adding the placeholder, dropping any
        // empty assistant turns (e.g. a prior interrupted reply) some strict
        // servers reject — but keeping tool-call turns, whose text may be empty
        // yet must stay paired with their tool results.
        let history = conversations[ci].messages.filter {
            !($0.role == .assistant && $0.content.trimmed.isEmpty && ($0.toolCalls ?? []).isEmpty)
        }
        conversations[ci].messages.append(assistant)

        isStreaming = true
        streamingConversationID = cid
        streamingMessageID = aid
        streamTask = Task { [weak self] in
            guard let self else { return }
            // Offer tools only when the model is flagged tool-capable, on wires
            // the tool loop supports, and there is something to offer.
            let toolSpecs: [ToolSpec]
            if let cfg = self.settings.settings.llmModel,
               cfg.llmCapabilities.toolCalling,
               model.wire == .openAIChat || model.wire == .anthropicMessages,
               !self.tools.isEmpty {
                toolSpecs = self.tools.specs
            } else {
                toolSpecs = []
            }

            var turn = history
            var currentAID = aid
            var rounds = 0
            do {
                // The tool loop: stream → if the model requested tools, run them,
                // feed results back, and stream again — until a plain answer.
                while true {
                    let outcome = try await ChatClient.stream(
                        model: model, messages: turn, tools: toolSpecs
                    ) { piece in
                        self.appendDelta(piece, conversationID: cid, messageID: currentAID)
                    }
                    if let cfg = self.settings.settings.llmModel, !outcome.usage.isEmpty {
                        self.usage.add(self.settings.settings.usageRecord(
                            for: cfg, source: "chat", date: Date(), usage: outcome.usage))
                    }
                    guard !outcome.toolCalls.isEmpty, rounds < self.maxToolRounds else {
                        // Completed with no content at all → leave a visible note
                        // rather than a permanently empty bubble.
                        self.noteIfEmpty(conversationID: cid, messageID: currentAID)
                        break
                    }
                    rounds += 1

                    // Freeze this round's assistant turn (its text + the calls).
                    let assistantText = self.messageContent(conversationID: cid, messageID: currentAID) ?? ""
                    self.attachToolCalls(outcome.toolCalls, conversationID: cid, messageID: currentAID)
                    turn.append(ChatMessage(role: .assistant, content: assistantText,
                                            toolCalls: outcome.toolCalls))

                    // Run every requested tool; failures go back as tool errors so
                    // the model can react instead of the turn dying.
                    for call in outcome.toolCalls {
                        let toolMessage = await self.runTool(call)
                        self.appendMessage(toolMessage, conversationID: cid)
                        turn.append(toolMessage)
                    }

                    // Fresh assistant bubble for the model's follow-up round.
                    let next = ChatMessage(role: .assistant, content: "")
                    currentAID = next.id
                    self.appendMessage(next, conversationID: cid)
                    self.streamingMessageID = currentAID
                }
            } catch {
                if !Task.isCancelled && !(error is CancellationError) {
                    self.appendDelta("\n\n[出错] \(error.localizedDescription)",
                                     conversationID: cid, messageID: currentAID)
                }
            }
            self.isStreaming = false
            self.streamingConversationID = nil
            self.streamingMessageID = nil
            self.streamTask = nil
        }
    }

    /// Execute one tool call and wrap the outcome as a `.tool` transcript message.
    private func runTool(_ call: ToolCall) async -> ChatMessage {
        let result: ToolResult
        var attachments: [String] = []
        if let tool = tools.tool(named: call.name) {
            do {
                let args = (try? JSONSerialization.jsonObject(
                    with: Data(call.argumentsJSON.utf8))) as? [String: Any] ?? [:]
                let output = try await tool.run(args)
                result = ToolResult(toolCallID: call.id, content: output.content, isError: false)
                attachments = output.attachments
            } catch {
                result = ToolResult(toolCallID: call.id,
                                    content: "工具执行失败：\(error.localizedDescription)",
                                    isError: true)
            }
        } else {
            result = ToolResult(toolCallID: call.id, content: "未知工具：\(call.name)", isError: true)
        }
        return ChatMessage(role: .tool, content: "", toolResult: result,
                           attachments: attachments.isEmpty ? nil : attachments)
    }

    private func appendDelta(_ piece: String, conversationID: UUID, messageID: UUID) {
        guard let ci = conversations.firstIndex(where: { $0.id == conversationID }),
              let mi = conversations[ci].messages.firstIndex(where: { $0.id == messageID }) else { return }
        conversations[ci].messages[mi].content += piece
    }

    private func appendMessage(_ message: ChatMessage, conversationID: UUID) {
        guard let ci = conversations.firstIndex(where: { $0.id == conversationID }) else { return }
        conversations[ci].messages.append(message)
    }

    private func messageContent(conversationID: UUID, messageID: UUID) -> String? {
        guard let ci = conversations.firstIndex(where: { $0.id == conversationID }),
              let mi = conversations[ci].messages.firstIndex(where: { $0.id == messageID }) else { return nil }
        return conversations[ci].messages[mi].content
    }

    private func attachToolCalls(_ calls: [ToolCall], conversationID: UUID, messageID: UUID) {
        guard let ci = conversations.firstIndex(where: { $0.id == conversationID }),
              let mi = conversations[ci].messages.firstIndex(where: { $0.id == messageID }) else { return }
        conversations[ci].messages[mi].toolCalls = calls
    }

    private func noteIfEmpty(conversationID: UUID, messageID: UUID) {
        guard let ci = conversations.firstIndex(where: { $0.id == conversationID }),
              let mi = conversations[ci].messages.firstIndex(where: { $0.id == messageID }),
              conversations[ci].messages[mi].content.isEmpty else { return }
        conversations[ci].messages[mi].content = "（模型没有返回内容）"
    }
}
