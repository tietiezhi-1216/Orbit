//  AddProviderSheet.swift
//  A modal editor for creating or editing a provider: protocol, name, Base URL,
//  API Key. The protocol (OpenAI Chat / OpenAI Responses / Anthropic) drives the
//  endpoint paths and auth scheme. The user can fetch the provider's model list
//  and test the connection before saving.

import SwiftUI

struct AddProviderSheet: View {
    /// Pass an existing provider to edit it; nil to create a new one.
    var editing: Provider?
    var onSave: (Provider) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var draft: Provider
    @State private var testStatus = ""
    @State private var testOK: Bool? = nil
    @State private var testing = false

    @State private var fetching = false
    @State private var models: [String] = []
    @State private var modelsError: String?

    private let labelWidth: CGFloat = 84

    init(editing: Provider? = nil, onSave: @escaping (Provider) -> Void) {
        self.editing = editing
        self.onSave = onSave
        _draft = State(initialValue: editing ?? Provider(name: "OpenAI"))
    }

    private var isEditing: Bool { editing != nil }
    private var canSave: Bool { !draft.name.trimmed.isEmpty }
    private var showsResults: Bool { !models.isEmpty || modelsError != nil }

    /// Live preview of where requests will actually go — lets the user see at a
    /// glance whether they need `/v1` in the Base URL.
    private var endpointPreview: String {
        draft.chatEndpoint?.absoluteString ?? "（Base URL 无效）"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(isEditing ? "编辑服务商" : "添加服务商").font(.headline)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 14)

            Divider()

            fields
                .padding(.horizontal, 20)
                .padding(.vertical, 18)

            if showsResults {
                Divider()
                resultsPanel
                    .padding(.horizontal, 20)
                    .padding(.vertical, 14)
            }

            Spacer(minLength: 0)
            Divider()
            footer
        }
        .frame(width: 540, height: showsResults ? 600 : 380)
        .onChange(of: draft.api) { _, newValue in
            // Switching protocol: prefill the matching default Base URL when the
            // field is empty or still on another protocol's default, and clear
            // results that belonged to the old endpoint.
            let defaults = Set(APIProtocol.allCases.map(\.defaultBaseURL))
            let current = draft.baseURL.trimmed
            if current.isEmpty || defaults.contains(current) {
                draft.baseURL = newValue.defaultBaseURL
            }
            resetProbes()
        }
    }

    // MARK: - Fields

    private var fields: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Protocol — a pop-up select listing each provider's real API name.
            labeledRow("协议") {
                VStack(alignment: .leading, spacing: 5) {
                    Picker("", selection: $draft.api) {
                        ForEach(APIProtocol.allCases) { proto in
                            Text(proto.displayName).tag(proto)
                        }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .fixedSize()
                    Text(draft.api.summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            labeledRow("名称") {
                TextField("例如：OpenAI、Claude", text: $draft.name)
                    .textFieldStyle(.roundedBorder)
            }

            // Base URL + endpoint preview
            labeledRow("Base URL") {
                VStack(alignment: .leading, spacing: 5) {
                    TextField(draft.api.defaultBaseURL, text: $draft.baseURL)
                        .textFieldStyle(.roundedBorder)
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.turn.down.right")
                        Text(endpointPreview)
                            .textSelection(.enabled)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    if draft.api.expectsVersionInBase {
                        Text("OpenAI 风格：版本段（/v1）写在 Base URL 里。")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    } else {
                        Text("Anthropic：Base URL 不含 /v1，应用会自动补全。")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            labeledRow("API Key") {
                RevealableSecureField(title: draft.api == .anthropic ? "sk-ant-…" : "sk-…",
                                      text: $draft.apiKey)
            }
        }
    }

    @ViewBuilder
    private func labeledRow<Field: View>(_ label: String,
                                         @ViewBuilder _ field: () -> Field) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(label)
                .frame(width: labelWidth, alignment: .leading)
                .foregroundStyle(.secondary)
            field()
        }
    }

    // MARK: - Fetched models panel

    private var resultsPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                if let err = modelsError {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                    Text(err).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                } else {
                    Image(systemName: "cube.box").foregroundStyle(.secondary)
                    Text("可用模型 · \(models.count)").font(.subheadline.weight(.medium))
                    Spacer()
                    Button {
                        models = []; modelsError = nil
                    } label: { Image(systemName: "xmark.circle.fill") }
                        .buttonStyle(.plain)
                        .foregroundStyle(.tertiary)
                        .help("清除列表")
                }
            }
            if !models.isEmpty {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(models, id: \.self) { id in
                            Text(id)
                                .font(.callout.monospaced())
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 4)
                                .padding(.horizontal, 8)
                            Divider()
                        }
                    }
                }
                .frame(height: 150)
                .background(Color(nsColor: .textBackgroundColor).opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(.quaternary))
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: 10) {
            Button {
                fetchModels()
            } label: {
                Label(fetching ? "获取中…" : "获取模型列表", systemImage: "arrow.down.circle")
            }
            .disabled(fetching)

            if !testStatus.isEmpty {
                Image(systemName: testOK == true ? "checkmark.circle.fill"
                      : (testOK == false ? "xmark.circle.fill" : "circle.dashed"))
                    .foregroundStyle(testOK == true ? .green : (testOK == false ? .red : .secondary))
                Text(testStatus)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)

            Button("取消") { dismiss() }
                .keyboardShortcut(.cancelAction)
            Button(testing ? "测试中…" : "测试连接") { runTest() }
                .disabled(testing)
            Button("保存") { save() }
                .keyboardShortcut(.defaultAction)
                .disabled(!canSave)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Actions

    private func resetProbes() {
        testStatus = ""; testOK = nil
        models = []; modelsError = nil
    }

    private func runTest() {
        testing = true
        testStatus = ""
        testOK = nil
        let snapshot = draft
        Task { @MainActor in
            defer { testing = false }
            do {
                testStatus = try await ProviderAPI.test(snapshot)
                testOK = true
            } catch {
                testStatus = (error as? ProviderAPIError)?.errorDescription
                    ?? error.localizedDescription
                testOK = false
            }
        }
    }

    private func fetchModels() {
        fetching = true
        modelsError = nil
        let snapshot = draft
        Task { @MainActor in
            defer { fetching = false }
            do {
                let ids = try await ProviderAPI.fetchModels(snapshot)
                models = ids
                if ids.isEmpty { modelsError = "该服务商没有返回任何模型。" }
            } catch {
                models = []
                modelsError = (error as? ProviderAPIError)?.errorDescription
                    ?? error.localizedDescription
            }
        }
    }

    private func save() {
        var provider = draft
        provider.name = provider.name.trimmed
        provider.baseURL = provider.baseURL.trimmed
        onSave(provider)
        dismiss()
    }
}
