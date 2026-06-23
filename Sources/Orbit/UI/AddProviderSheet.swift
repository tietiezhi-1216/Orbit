//  AddProviderSheet.swift
//  A modal form for creating a provider: name, protocol, and the credential
//  fields for that protocol. The user can test the connection before saving.
//  Replaces the old "pick a protocol from a dropdown" flow.

import SwiftUI

struct AddProviderSheet: View {
    var onSave: (Provider) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var draft = Provider(name: "OpenAI", kind: .openai)
    @State private var testStatus = ""
    @State private var testOK: Bool? = nil
    @State private var testing = false

    private var canSave: Bool { !draft.name.trimmed.isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("添加服务商").font(.headline)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 6)

            Form {
                Picker("协议", selection: $draft.kind) {
                    Text("OpenAI 兼容").tag(ProviderKind.openai)
                    Text("火山引擎 / 豆包语音").tag(ProviderKind.volcano)
                }
                .onChange(of: draft.kind) { _, newKind in applyKindDefaults(newKind) }

                TextField("名称", text: $draft.name)
                    .textFieldStyle(.roundedBorder)

                if draft.kind == .volcano {
                    TextField("AppID", text: $draft.appID)
                        .textFieldStyle(.roundedBorder)
                    RevealableSecureField(title: "Access Token", text: $draft.apiKey)
                    TextField("Resource ID", text: $draft.resourceID)
                        .textFieldStyle(.roundedBorder)
                } else {
                    TextField("Base URL", text: $draft.baseURL)
                        .textFieldStyle(.roundedBorder)
                    RevealableSecureField(title: "API Key（sk-…）", text: $draft.apiKey)
                }
            }
            .formStyle(.grouped)

            Divider()

            HStack(spacing: 10) {
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
        .frame(width: 480, height: 420)
    }

    // MARK: - Actions

    private func applyKindDefaults(_ kind: ProviderKind) {
        switch kind {
        case .openai:
            if draft.baseURL.trimmed.isEmpty { draft.baseURL = Provider.openAIBase }
            if draft.name.trimmed.isEmpty || draft.name == "火山引擎" { draft.name = "OpenAI" }
        case .volcano:
            if draft.resourceID.trimmed.isEmpty { draft.resourceID = Provider.volcanoResource }
            if draft.name.trimmed.isEmpty || draft.name == "OpenAI" { draft.name = "火山引擎" }
        }
        testStatus = ""; testOK = nil
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

    private func save() {
        var provider = draft
        provider.name = provider.name.trimmed
        onSave(provider)
        dismiss()
    }
}
