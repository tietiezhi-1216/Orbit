//  ModelsView.swift
//  Add ASR / LLM models under a provider, pick the active one, and (for ASR)
//  choose transport + language. "获取列表" pulls the provider's model ids.

import SwiftUI

struct ModelsView: View {
    @EnvironmentObject var store: SettingsStore
    @State private var tab: ModelKind = .asr

    private var filtered: [ModelConfig] {
        store.settings.models.filter { $0.kind == tab }
    }

    private var activeBinding: Binding<String?> {
        tab == .asr ? $store.settings.asrModelID : $store.settings.llmModelID
    }

    var body: some View {
        PageScaffold(title: "模型") {
            Button(action: addModel) {
                Label("添加模型", systemImage: "plus")
            }
            .buttonStyle(.bordered)
            .disabled(store.settings.providers.isEmpty)
        } content: {
            Form {
                Picker("类型", selection: $tab) {
                    Text("语音识别").tag(ModelKind.asr)
                    Text("大模型").tag(ModelKind.llm)
                }
                .pickerStyle(.segmented)
                .labelsHidden()

                Section(tab == .asr ? "当前语音识别模型" : "当前大模型") {
                    Picker("选择", selection: activeBinding) {
                        Text("— 无 —").tag(String?.none)
                        ForEach(filtered) { model in
                            Text(model.name).tag(Optional(model.id))
                        }
                    }
                }

                if store.settings.providers.isEmpty {
                    Section { Text("请先在「服务商」添加一个。").foregroundStyle(.secondary) }
                } else if filtered.isEmpty {
                    Section { Text("还没有模型，点右上角添加。").foregroundStyle(.secondary) }
                }

                ForEach($store.settings.models) { $model in
                    if model.kind == tab {
                        ModelSection(model: $model, providers: store.settings.providers) {
                            store.removeModel(id: model.id)
                        }
                    }
                }
            }
            .formStyle(.grouped)
        }
    }

    private func addModel() {
        guard let provider = store.settings.providers.first else { return }
        let isVolcano = provider.kind == .volcano
        let model = ModelConfig(
            providerID: provider.id,
            name: tab == .asr ? "语音识别" : "大模型",
            model: tab == .asr ? (isVolcano ? "bigmodel" : "gpt-4o-transcribe") : "gpt-4o-mini",
            kind: tab,
            transport: (tab == .asr && isVolcano) ? .volcanoWS : .http,
            language: nil
        )
        store.addModel(model)
    }
}

private struct ModelSection: View {
    @Binding var model: ModelConfig
    let providers: [Provider]
    var onRemove: () -> Void

    @State private var fetched: [String] = []
    @State private var loading = false

    private var isVolcano: Bool {
        providers.first { $0.id == model.providerID }?.kind == .volcano
    }

    private var modelOptions: [String] {
        if fetched.isEmpty { return model.model.isEmpty ? [] : [model.model] }
        return fetched.contains(model.model) ? fetched : [model.model] + fetched
    }

    private var languageBinding: Binding<String> {
        Binding(get: { model.language ?? "" },
                set: { model.language = $0.isEmpty ? nil : $0 })
    }

    var body: some View {
        Section {
            TextField("名称", text: $model.name)
                .textFieldStyle(.roundedBorder)

            Picker("服务商", selection: $model.providerID) {
                ForEach(providers) { p in Text(p.name).tag(p.id) }
            }
            .onChange(of: model.providerID) { _, _ in adjustTransport() }

            HStack {
                Picker("模型", selection: $model.model) {
                    if modelOptions.isEmpty {
                        Text("— 获取列表 —").tag("")
                    }
                    ForEach(modelOptions, id: \.self) { Text($0).tag($0) }
                }
                Button(loading ? "获取中…" : "获取列表") { loadModels() }
                    .disabled(loading)
            }

            if model.kind == .asr {
                if isVolcano {
                    LabeledContent("传输方式", value: "火山引擎流式")
                } else {
                    Picker("传输方式", selection: $model.transport) {
                        Text("HTTP（停止后上传）").tag(Transport.http)
                        Text("实时 WebSocket").tag(Transport.realtimeWS)
                    }
                }
                TextField("语言（zh / en，可空）", text: languageBinding)
                    .textFieldStyle(.roundedBorder)
            }

            HStack {
                Spacer()
                Button(role: .destructive, action: onRemove) {
                    Label("删除", systemImage: "trash")
                }
            }
        } header: {
            Text(model.name)
        }
    }

    private func adjustTransport() {
        if isVolcano {
            model.transport = .volcanoWS
        } else if model.transport == .volcanoWS {
            model.transport = .http
        }
    }

    private func loadModels() {
        guard let provider = providers.first(where: { $0.id == model.providerID }) else { return }
        loading = true
        Task { @MainActor in
            defer { loading = false }
            do { fetched = try await ProviderAPI.fetchModels(provider) }
            catch { fetched = [] }
        }
    }
}
