//  DictationVocabView.swift
//  听写 › 词汇: the user's hotwords. The system folds them into the polish prompt's
//  hotword / ASR-correction block (via PromptComposer), so the model fixes ASR
//  mishears toward the right spelling (e.g. 转写出 "VIP" 但词表里有 "ZIP" → 输出
//  "ZIP"). A template needs no placeholder to receive them. Includes a live preview
//  of that block (preview == actual).

import SwiftUI

struct DictationVocabView: View {
    @EnvironmentObject var store: SettingsStore

    @State private var newTerm = ""
    @State private var showPreview = false

    private var hotwords: [String] { store.settings.hotwords }

    var body: some View {
        PageScaffold(title: "听写 · 词汇") {
            Form {
                Section("添加热词") {
                    HStack(spacing: 8) {
                        TextField("产品名、术语、缩写…", text: $newTerm)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit(addTerm)
                        Button(action: addTerm) { Image(systemName: "plus") }
                            .disabled(newTerm.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    Text("转写里出现这些词的同音 / 形近误识别时，模型会优先按你写的写法输出。")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section {
                    if hotwords.isEmpty {
                        Text("还没有热词。加几个常说但容易识别错的词（如 Token、Tauri、SwiftUI）。")
                            .font(.caption).foregroundStyle(.secondary)
                    } else {
                        ForEach(hotwords, id: \.self) { term in
                            HStack {
                                Text(term)
                                Spacer()
                                Button(role: .destructive) { remove(term) } label: {
                                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                } header: {
                    HStack {
                        Text("我的热词（\(hotwords.count)）")
                        Spacer()
                        if !hotwords.isEmpty {
                            Button(role: .destructive) { store.settings.hotwords = [] } label: {
                                Label("清空", systemImage: "trash")
                            }
                            .buttonStyle(.borderless).controlSize(.small)
                        }
                    }
                }

                Section {
                    DisclosureGroup("预览发送给模型的「热词与纠错」块", isExpanded: $showPreview) {
                        Text(PromptComposer.hotwordBlock(hotwords))
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 4)
                    }
                }
            }
            .formStyle(.grouped)
        }
    }

    private func addTerm() {
        let t = newTerm.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        add([t])
        newTerm = ""
    }

    /// Append terms, skipping case-insensitive duplicates, preserving order.
    private func add(_ terms: [String]) {
        var current = store.settings.hotwords
        let existing = Set(current.map { $0.lowercased() })
        for term in terms {
            let t = term.trimmingCharacters(in: .whitespacesAndNewlines)
            if !t.isEmpty, !existing.contains(t.lowercased()), !current.contains(t) {
                current.append(t)
            }
        }
        store.settings.hotwords = current
    }

    private func remove(_ term: String) {
        store.settings.hotwords.removeAll { $0 == term }
    }
}
