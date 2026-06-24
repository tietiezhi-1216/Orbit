//  AddProviderSheet.swift
//  A modal editor for creating or editing a provider. A provider is now just
//  credentials (name, Base URL, API Key, auth scheme) PLUS a catalog of
//  "services" — the interfaces it offers (chat / responses / image / asr / …).
//  Each service is a capability + wire + optional path override. Models attach
//  to a service in the 模型 screen, so one Base URL can host many models that
//  speak different protocols. Vendor presets seed sensible defaults; the user
//  can fetch the model list and test the connection before saving.

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
        // A new provider starts with one chat service so it's immediately usable;
        // the user adds / edits / removes services freely.
        _draft = State(initialValue: editing ?? Provider(
            name: "", baseURL: "",
            services: [Service(wire: .openAIChat)]
        ))
    }

    private var isEditing: Bool { editing != nil }
    private var canSave: Bool { !draft.name.trimmed.isEmpty }
    private var showsResults: Bool { !models.isEmpty || modelsError != nil }

    /// Live preview of the connection-test target (the list-models endpoint).
    private var modelsPreview: String {
        draft.modelsEndpoint?.absoluteString ?? "（Base URL 无效）"
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

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    fields
                    Divider()
                    servicesEditor
                    if showsResults {
                        Divider()
                        resultsPanel
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 18)
            }

            Divider()
            footer
        }
        .frame(width: 580, height: 640)
    }

    // MARK: - Credential fields

    private var fields: some View {
        VStack(alignment: .leading, spacing: 14) {
            labeledRow("名称") {
                TextField("例如：OpenAI、Claude、硅基流动", text: $draft.name)
                    .textFieldStyle(.roundedBorder)
            }

            labeledRow("Base URL") {
                VStack(alignment: .leading, spacing: 5) {
                    TextField(Provider.openAIBase, text: $draft.baseURL)
                        .textFieldStyle(.roundedBorder)
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.turn.down.right")
                        Text("列表/测试：\(modelsPreview)")
                            .textSelection(.enabled)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    Text(draft.auth == .anthropic
                         ? "Anthropic：Base URL 不含 /v1，应用会自动补全。"
                         : "OpenAI 风格：版本段（/v1）写在 Base URL 里。")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            labeledRow("鉴权") {
                VStack(alignment: .leading, spacing: 5) {
                    Picker("", selection: $draft.auth) {
                        ForEach(AuthScheme.allCases) { scheme in
                            Text(scheme.displayName).tag(scheme)
                        }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .fixedSize()
                }
            }

            labeledRow("API Key") {
                RevealableSecureField(title: draft.auth == .anthropic ? "sk-ant-…" : "sk-…",
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

    // MARK: - Services editor

    private var servicesEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("支持的协议").font(.subheadline.weight(.semibold))
                Spacer()
                addProtocolMenu
            }

            Text("这个服务商支持哪些协议（接口规范）。模型在「模型」页选择其中之一——端点由协议决定，无需手填。")
                .font(.caption)
                .foregroundStyle(.secondary)

            if draft.services.isEmpty {
                Text("还没有协议，点「添加协议」。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 10)
            } else {
                ForEach(draft.services) { svc in
                    protocolRow(svc)
                }
            }
        }
    }

    private var addProtocolMenu: some View {
        Menu {
            ForEach(capabilitiesWithAvailable) { cap in
                Section(cap.displayName) {
                    ForEach(availableWires(for: cap)) { wire in
                        Button(wire.displayName) {
                            draft.services.append(Service(wire: wire))
                        }
                    }
                }
            }
        } label: {
            Label("添加协议", systemImage: "plus")
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .disabled(capabilitiesWithAvailable.isEmpty)
    }

    private func protocolRow(_ svc: Service) -> some View {
        HStack(spacing: 10) {
            Image(systemName: svc.capability.symbol)
                .foregroundStyle(.secondary)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(svc.wire.displayName).font(.callout)
                Text("\(svc.capability.displayName) · \(svc.wire.summary)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(role: .destructive) {
                draft.services.removeAll { $0.id == svc.id }
            } label: {
                Image(systemName: "trash")
            }
            .buttonStyle(.borderless)
        }
        .padding(10)
        .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 8))
    }

    /// Protocols of `capability` not yet added to this provider.
    private func availableWires(for capability: Capability) -> [Wire] {
        Wire.all(for: capability).filter { wire in
            !draft.services.contains { $0.wire == wire }
        }
    }

    /// Capabilities (functions) that still have an unused protocol to offer.
    private var capabilitiesWithAvailable: [Capability] {
        Capability.allCases.filter { !availableWires(for: $0).isEmpty }
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

