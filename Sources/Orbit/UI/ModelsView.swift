//  ModelsView.swift
//  Models shown as a SwiftUI `Table` (mirrors the providers screen): name,
//  provider, protocol (the wire of the model's service), model id, resolved
//  endpoint. A model just points at a provider + one of that provider's
//  services (interfaces) — the service decides the capability/protocol. Add /
//  edit happen in a modal sheet (SwiftUI Table is read-only).
//
//  Which model a *feature* uses (听写 / 对话) is NOT configured here — that
//  belongs in each feature's own settings.

import SwiftUI

struct ModelsView: View {
    @EnvironmentObject var store: SettingsStore

    @State private var selectedID: ModelConfig.ID?
    @State private var showingAdd = false
    @State private var showingBatch = false
    @State private var editingModel: ModelConfig?

    /// Providers that expose at least one service (so a model can attach).
    private var usableProviders: [Provider] {
        store.settings.providers.filter { !$0.services.isEmpty }
    }

    private var selectedModel: ModelConfig? {
        guard let id = selectedID else { return nil }
        return store.settings.models.first { $0.id == id }
    }

    var body: some View {
        PageScaffold(title: "模型", maxWidth: .infinity) {
            HStack(spacing: 8) {
                Button {
                    if let m = selectedModel { editingModel = m }
                } label: {
                    Label("编辑", systemImage: "pencil")
                }
                .disabled(selectedModel == nil)

                Button {
                    if let id = selectedID {
                        store.removeModel(id: id)
                        selectedID = nil
                    }
                } label: {
                    Label("删除", systemImage: "trash")
                }
                .disabled(selectedID == nil)

                Button { showingBatch = true } label: {
                    Label("批量添加", systemImage: "square.stack.3d.up")
                }
                .disabled(store.settings.providers.allSatisfy { $0.baseURL.trimmed.isEmpty })

                Button { showingAdd = true } label: {
                    Label("添加模型", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
                .disabled(usableProviders.isEmpty)
            }
        } content: {
            Table(store.settings.models, selection: $selectedID) {
                TableColumn("名称", value: \.name)
                TableColumn("厂商") { model in
                    Text(providerName(model)).foregroundStyle(.secondary)
                }
                TableColumn("协议") { model in
                    Text(protocolName(model)).foregroundStyle(.secondary)
                }
                TableColumn("LLM 能力") { model in
                    if store.settings.capability(of: model) == .chat {
                        LLMCapabilityBadges(capabilities: model.llmCapabilities, compact: true)
                    } else {
                        Text("—").foregroundStyle(.tertiary)
                    }
                }
                TableColumn("模型") { model in
                    Text(model.model.isEmpty ? "—" : model.model)
                        .font(.callout.monospaced())
                        .foregroundStyle(.secondary)
                }
                TableColumn("接口地址") { model in
                    Text(endpoint(model))
                        .font(.caption.monospaced())
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            .tableStyle(.bordered(alternatesRowBackgrounds: false))
            .contextMenu(forSelectionType: ModelConfig.ID.self) { ids in
                if let id = ids.first,
                   let model = store.settings.models.first(where: { $0.id == id }) {
                    Button("编辑") { editingModel = model }
                    Button("删除", role: .destructive) {
                        store.removeModel(id: id)
                        if selectedID == id { selectedID = nil }
                    }
                }
            } primaryAction: { ids in
                if let id = ids.first,
                   let model = store.settings.models.first(where: { $0.id == id }) {
                    editingModel = model
                }
            }
            .overlay {
                if store.settings.providers.isEmpty {
                    Text("请先在「服务商」添加一个。").foregroundStyle(.secondary)
                } else if store.settings.models.isEmpty {
                    Text("还没有模型,点右上角「添加模型」开始。").foregroundStyle(.secondary)
                }
            }
            .padding(.bottom, 16)
        }
        .sheet(isPresented: $showingAdd) {
            ModelEditorSheet(providers: usableProviders) { store.addModel($0) }
        }
        .sheet(isPresented: $showingBatch) {
            BatchAddModelsSheet()
        }
        .sheet(item: $editingModel) { model in
            ModelEditorSheet(editing: model, providers: usableProviders) { updated in
                store.updateModel(id: model.id) { existing in
                    existing.providerID = updated.providerID
                    existing.serviceID = updated.serviceID
                    existing.name = updated.name
                    existing.model = updated.model
                    existing.language = updated.language
                    existing.params = updated.params
                    existing.llmCapabilities = updated.llmCapabilities
                }
            }
        }
    }

    // MARK: - Row lookups

    private func providerName(_ model: ModelConfig) -> String {
        store.settings.provider(id: model.providerID)?.name ?? "—"
    }

    private func protocolName(_ model: ModelConfig) -> String {
        store.settings.service(for: model)?.wire.displayName ?? "—"
    }

    private func endpoint(_ model: ModelConfig) -> String {
        store.settings.resolve(model)?.url?.absoluteString ?? "—"
    }
}

// MARK: - Model editor

struct ModelEditorSheet: View {
    var editing: ModelConfig?
    let providers: [Provider]
    var onSave: (ModelConfig) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var draft: ModelConfig
    @State private var fetched: [String] = []
    @State private var loading = false

    private let labelWidth: CGFloat = 72

    init(editing: ModelConfig? = nil, providers: [Provider], onSave: @escaping (ModelConfig) -> Void) {
        self.editing = editing
        self.providers = providers
        self.onSave = onSave
        let initial = editing ?? ModelConfig(
            providerID: providers.first?.id ?? "",
            serviceID: providers.first?.services.first?.id,
            name: "新模型",
            model: ""
        )
        _draft = State(initialValue: initial)
    }

    private var provider: Provider? { providers.first { $0.id == draft.providerID } }
    private var services: [Service] { provider?.services ?? [] }
    private var selectedService: Service? { services.first { $0.id == draft.serviceID } }
    private var isASR: Bool { selectedService?.capability == .asr }
    private var isChat: Bool { selectedService?.capability == .chat }
    private var isEditing: Bool { editing != nil }

    private var sheetHeight: CGFloat {
        if isChat { return 500 }
        if isASR { return 430 }
        return 380
    }

    private var endpointPreview: String {
        guard let provider, let svc = selectedService else { return "（选择协议后显示）" }
        return svc.endpoint(base: provider.baseURL)?.absoluteString ?? "（Base URL 无效）"
    }

    private var canSave: Bool {
        !draft.name.trimmed.isEmpty && draft.serviceID != nil && !draft.model.trimmed.isEmpty
    }

    private var languageBinding: Binding<String> {
        Binding(get: { draft.language ?? "" },
                set: { draft.language = $0.isEmpty ? nil : $0 })
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(isEditing ? "编辑模型" : "添加模型").font(.headline)
                Spacer()
            }
            .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 14)

            Divider()

            VStack(alignment: .leading, spacing: 14) {
                labeledRow("名称") {
                    TextField("便于识别的名字", text: $draft.name)
                        .textFieldStyle(.roundedBorder)
                }

                labeledRow("厂商") {
                    Picker("", selection: $draft.providerID) {
                        ForEach(providers) { p in Text(p.name).tag(p.id) }
                    }
                    .labelsHidden()
                    .onChange(of: draft.providerID) { _, _ in syncService(); fetched = [] }
                }

                labeledRow("协议") {
                    VStack(alignment: .leading, spacing: 5) {
                        Picker("", selection: $draft.serviceID) {
                            if services.isEmpty {
                                Text("— 无可用服务 —").tag(String?.none)
                            }
                            ForEach(services) { svc in
                                Text("\(svc.capability.displayName) · \(svc.wire.displayName)").tag(Optional(svc.id))
                            }
                        }
                        .labelsHidden()
                        .onChange(of: draft.serviceID) { _, _ in syncServiceState() }
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.turn.down.right")
                            Text(endpointPreview).textSelection(.enabled)
                        }
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    }
                }

                labeledRow("模型 id") {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            TextField("如 gpt-4o-mini", text: $draft.model)
                                .textFieldStyle(.roundedBorder)
                                .font(.callout.monospaced())
                            Button(loading ? "获取中…" : "获取列表") { loadModels() }
                                .disabled(loading || provider == nil)
                        }
                        if !fetched.isEmpty {
                            Menu("从 \(fetched.count) 个结果选择") {
                                ForEach(fetched, id: \.self) { id in
                                    Button(id) { draft.model = id }
                                }
                            }
                            .fixedSize()
                        }
                    }
                }

                if isASR {
                    labeledRow("语言") {
                        TextField("zh / en，可空", text: languageBinding)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                if isChat {
                    labeledRow("能力") {
                        VStack(alignment: .leading, spacing: 8) {
                            Toggle("支持多模态（图像 / 文件等输入）",
                                   isOn: capabilityBinding(\.multimodal))
                            Toggle("支持思考能力（Reasoning / Thinking）",
                                   isOn: capabilityBinding(\.thinking))
                            Toggle("支持调用工具（Tool Calling / Function Calling）",
                                   isOn: capabilityBinding(\.toolCalling))
                            LLMCapabilityBadges(capabilities: draft.llmCapabilities)
                            Text("请按该模型真实能力标记；首页对话框和模型列表会明确展示这些能力。")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 18)

            Spacer(minLength: 0)
            Divider()

            HStack {
                Spacer()
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("保存") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(!canSave)
            }
            .padding(.horizontal, 20).padding(.vertical, 14)
        }
        .frame(width: 540, height: sheetHeight)
        .onAppear { syncService() }
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

    /// Keep `serviceID` pointing at a service of the current provider.
    private func syncService() {
        if let id = draft.serviceID, services.contains(where: { $0.id == id }) { return }
        draft.serviceID = services.first?.id
        syncServiceState()
    }

    private func syncServiceState() {
        // Clear capability-specific state when the selected protocol changes.
        if !isASR { draft.language = nil }
        if !isChat { draft.llmCapabilities = .none }
    }

    private func capabilityBinding(_ keyPath: WritableKeyPath<LLMCapabilities, Bool>) -> Binding<Bool> {
        Binding(
            get: { draft.llmCapabilities[keyPath: keyPath] },
            set: { draft.llmCapabilities[keyPath: keyPath] = $0 }
        )
    }

    private func loadModels() {
        guard let provider else { return }
        loading = true
        Task { @MainActor in
            defer { loading = false }
            do { fetched = try await ProviderAPI.fetchModels(provider) }
            catch { fetched = [] }
        }
    }

    private func save() {
        var model = draft
        model.name = model.name.trimmed
        model.model = model.model.trimmed
        if !isASR { model.language = nil }
        if !isChat { model.llmCapabilities = .none }
        onSave(model)
        dismiss()
    }
}
