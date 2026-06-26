//  BatchAddModelsSheet.swift
//  Add many models at once instead of one-by-one: fetch every provider's
//  `/models` in one shot, pick the ones you want from a searchable
//  「厂商 / 模型」 list, choose ONE protocol to apply to the whole batch, and add
//  them together. The chosen protocol's service is created on each provider that
//  lacks it, so the user never hand-wires endpoints.

import SwiftUI

struct BatchAddModelsSheet: View {
    @EnvironmentObject var store: SettingsStore
    @Environment(\.dismiss) private var dismiss

    /// One fetched model id, tagged with the provider it came from.
    private struct Row: Identifiable, Hashable {
        let providerID: String
        let providerName: String
        let model: String
        var id: String { providerID + "|" + model }
        var label: String { "\(providerName) / \(model)" }
    }

    private static let allScope = "__all__"

    @State private var scope = BatchAddModelsSheet.allScope
    @State private var wire: Wire = .openAIChat
    @State private var rows: [Row] = []
    @State private var selection: Set<String> = []
    @State private var search = ""
    @State private var llmCapabilities: LLMCapabilities = .none
    @State private var loading = false
    @State private var failures: [String] = []
    @State private var didFetch = false

    /// Providers we can actually probe (have a base URL).
    private var fetchableProviders: [Provider] {
        store.settings.providers.filter { !$0.baseURL.trimmed.isEmpty }
    }

    private var filteredRows: [Row] {
        let needle = search.trimmed.localizedLowercase
        guard !needle.isEmpty else { return rows }
        return rows.filter {
            $0.model.localizedLowercase.contains(needle) || $0.providerName.localizedLowercase.contains(needle)
        }
    }

    /// Already-configured (provider, wire, model) triples, so we never add a dup.
    private var existingKeys: Set<String> {
        Set(store.settings.models.map { m in
            let svcWire = store.settings.service(for: m)?.wire.rawValue ?? ""
            return "\(m.providerID)|\(svcWire)|\(m.model)"
        })
    }

    private var selectedNew: [Row] {
        rows.filter { selection.contains($0.id) && !isExisting($0) }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            controls
            Divider()
            list
            Divider()
            footer
        }
        .frame(width: 640, height: wire.capability == .chat ? 650 : 580)
    }

    // MARK: Sections

    private var header: some View {
        HStack {
            Text("批量添加模型").font(.headline)
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 14)
    }

    private var controls: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Picker("厂商", selection: $scope) {
                    Text("全部厂商").tag(Self.allScope)
                    ForEach(fetchableProviders) { Text($0.name).tag($0.id) }
                }
                .fixedSize()

                Picker("协议", selection: $wire) {
                    ForEach(Wire.allCases) { w in
                        Text("\(w.capability.displayName) · \(w.displayName)").tag(w)
                    }
                }
                .fixedSize()
                .onChange(of: wire) { _, newWire in
                    if newWire.capability != .chat { llmCapabilities = .none }
                }

                Spacer()

                Button { fetch() } label: {
                    Label(loading ? "获取中…" : "获取模型", systemImage: "arrow.down.circle")
                }
                .disabled(loading || fetchableProviders.isEmpty)
            }

            Text("先选「协议」再获取——所选协议会套用到这一批所有勾选的模型；不同协议（如聊天 / 语音识别）分批添加。")
                .font(.caption).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            if wire.capability == .chat {
                VStack(alignment: .leading, spacing: 8) {
                    Text("这批 LLM 的能力标记")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    HStack(spacing: 12) {
                        Toggle("多模态", isOn: capabilityBinding(\.multimodal))
                        Toggle("思考", isOn: capabilityBinding(\.thinking))
                        Toggle("工具调用", isOn: capabilityBinding(\.toolCalling))
                    }
                    LLMCapabilityBadges(capabilities: llmCapabilities)
                }
                .toggleStyle(.checkbox)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if !failures.isEmpty {
                ForEach(failures, id: \.self) { f in
                    Label(f, systemImage: "exclamationmark.triangle")
                        .font(.caption).foregroundStyle(.orange)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
    }

    private var list: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.tertiary)
                TextField("搜索模型 / 厂商…", text: $search).textFieldStyle(.plain)
                Spacer()
                if !filteredRows.isEmpty {
                    Button(allFilteredSelected ? "全不选" : "全选") { toggleSelectAll() }
                        .controlSize(.small)
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 9)
            Divider()

            if loading {
                centered { ProgressView() }
            } else if rows.isEmpty {
                centered {
                    Text(didFetch ? "没有获取到模型。" : "点「获取模型」拉取列表。")
                        .foregroundStyle(.secondary)
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filteredRows) { row in
                            rowView(row)
                            Divider().padding(.leading, 44)
                        }
                    }
                }
            }
        }
    }

    private func rowView(_ row: Row) -> some View {
        let existing = isExisting(row)
        let on = selection.contains(row.id)
        return Button {
            guard !existing else { return }
            if on { selection.remove(row.id) } else { selection.insert(row.id) }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: existing ? "checkmark.circle" : (on ? "checkmark.circle.fill" : "circle"))
                    .foregroundStyle(existing ? .secondary : (on ? Color.accentColor : .secondary.opacity(0.5)))
                VStack(alignment: .leading, spacing: 1) {
                    Text(row.model).font(.callout.monospaced())
                        .foregroundStyle(existing ? .secondary : .primary)
                    Text(row.providerName).font(.caption2).foregroundStyle(.tertiary)
                }
                Spacer()
                if existing {
                    Text("已添加").font(.caption2).foregroundStyle(.tertiary)
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(existing)
    }

    private var footer: some View {
        HStack {
            Text(selectedNew.isEmpty ? "未选择" : "已选 \(selectedNew.count) 个")
                .font(.caption).foregroundStyle(.secondary)
            Spacer()
            Button("取消") { dismiss() }.keyboardShortcut(.cancelAction)
            Button("添加 \(selectedNew.count) 个") { apply() }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent)
                .disabled(selectedNew.isEmpty)
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
    }

    // MARK: Helpers

    private func centered<V: View>(@ViewBuilder _ content: () -> V) -> some View {
        VStack { Spacer(); content(); Spacer() }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var allFilteredSelected: Bool {
        let selectable = filteredRows.filter { !isExisting($0) }
        return !selectable.isEmpty && selectable.allSatisfy { selection.contains($0.id) }
    }

    private func toggleSelectAll() {
        let selectable = filteredRows.filter { !isExisting($0) }.map(\.id)
        if allFilteredSelected {
            selection.subtract(selectable)
        } else {
            selection.formUnion(selectable)
        }
    }

    private func isExisting(_ row: Row) -> Bool {
        existingKeys.contains("\(row.providerID)|\(wire.rawValue)|\(row.model)")
    }

    private func capabilityBinding(_ keyPath: WritableKeyPath<LLMCapabilities, Bool>) -> Binding<Bool> {
        Binding(
            get: { llmCapabilities[keyPath: keyPath] },
            set: { llmCapabilities[keyPath: keyPath] = $0 }
        )
    }

    private func fetch() {
        loading = true
        didFetch = true
        rows = []
        selection = []
        failures = []
        let targets = scope == Self.allScope ? fetchableProviders : fetchableProviders.filter { $0.id == scope }
        Task { @MainActor in
            defer { loading = false }
            var collected: [Row] = []
            for p in targets {
                do {
                    let ids = try await ProviderAPI.fetchModels(p)
                    collected += ids.map { Row(providerID: p.id, providerName: p.name, model: $0) }
                } catch {
                    failures.append("\(p.name)：\(error.localizedDescription)")
                }
            }
            rows = collected.sorted { ($0.providerName, $0.model) < ($1.providerName, $1.model) }
        }
    }

    /// Resolve (creating if needed) the provider's service for `wire`, returning
    /// its id. Cached per provider so a batch creates at most one new service each.
    private func serviceID(providerID: String, cache: inout [String: String]) -> String? {
        if let s = cache[providerID] { return s }
        guard let provider = store.settings.provider(id: providerID) else { return nil }
        if let existing = provider.services.first(where: { $0.wire == wire }) {
            cache[providerID] = existing.id
            return existing.id
        }
        let svc = Service(wire: wire)
        store.updateProvider(id: providerID) { $0.services.append(svc) }
        cache[providerID] = svc.id
        return svc.id
    }

    private func apply() {
        var cache: [String: String] = [:]
        for row in selectedNew {
            guard let sid = serviceID(providerID: row.providerID, cache: &cache) else { continue }
            store.addModel(ModelConfig(
                providerID: row.providerID,
                serviceID: sid,
                name: row.model,
                model: row.model,
                llmCapabilities: wire.capability == .chat ? llmCapabilities : .none
            ))
        }
        dismiss()
    }
}
