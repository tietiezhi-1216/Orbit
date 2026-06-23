//  ProvidersView.swift
//  Manage model vendors (OpenAI-compatible or 火山引擎): credentials + a "Test"
//  probe against /models.

import SwiftUI

struct ProvidersView: View {
    @EnvironmentObject var store: SettingsStore
    @State private var showingAdd = false

    var body: some View {
        PageScaffold(title: "服务商") {
            Button {
                showingAdd = true
            } label: {
                Label("添加服务商", systemImage: "plus")
            }
            .buttonStyle(.bordered)
        } content: {
            Form {
                if store.settings.providers.isEmpty {
                    Section {
                        Text("还没有服务商，点右上角添加一个开始。")
                            .foregroundStyle(.secondary)
                    }
                }
                ForEach($store.settings.providers) { $provider in
                    ProviderSection(provider: $provider) {
                        store.removeProvider(id: provider.id)
                    }
                }
            }
            .formStyle(.grouped)
        }
        .sheet(isPresented: $showingAdd) {
            AddProviderSheet { newProvider in
                store.addProvider(newProvider)
            }
        }
    }
}

private struct ProviderSection: View {
    @Binding var provider: Provider
    var onRemove: () -> Void

    @State private var status = ""
    @State private var testing = false

    var body: some View {
        Section {
            TextField("名称", text: $provider.name)
                .textFieldStyle(.roundedBorder)

            if provider.kind == .volcano {
                TextField("AppID", text: $provider.appID)
                    .textFieldStyle(.roundedBorder)
                RevealableSecureField(title: "Access Token", text: $provider.apiKey)
                TextField("Resource ID", text: $provider.resourceID)
                    .textFieldStyle(.roundedBorder)
            } else {
                TextField("Base URL", text: $provider.baseURL)
                    .textFieldStyle(.roundedBorder)
                RevealableSecureField(title: "API Key（sk-…）", text: $provider.apiKey)
            }

            HStack {
                Button(testing ? "测试中…" : "测试连接") { runTest() }
                    .disabled(testing)
                if !status.isEmpty {
                    Text(status).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button(role: .destructive, action: onRemove) {
                    Label("删除", systemImage: "trash")
                }
            }
        } header: {
            Text(provider.kind == .volcano ? "火山引擎 / 豆包语音" : "OpenAI 兼容")
        }
    }

    private func runTest() {
        testing = true
        status = ""
        let snapshot = provider
        Task { @MainActor in
            defer { testing = false }
            do {
                status = try await ProviderAPI.test(snapshot)
            } catch {
                status = (error as? ProviderAPIError)?.errorDescription
                    ?? error.localizedDescription
            }
        }
    }
}
