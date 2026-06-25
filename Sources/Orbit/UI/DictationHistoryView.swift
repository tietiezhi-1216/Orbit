//  DictationHistoryView.swift
//  听写 › 历史: every finished dictation, newest first — so a transcript is never
//  lost once the pill disappears. Copy or delete individual entries, or clear all.

import SwiftUI
import AppKit

struct DictationHistoryView: View {
    @EnvironmentObject var history: DictationHistoryStore

    var body: some View {
        PageScaffold(title: "听写 · 历史") {
            Form {
                Section {
                    if history.entries.isEmpty {
                        Text("还没有听写记录。识别完成的文本会出现在这里，方便回看和复制。")
                            .font(.caption).foregroundStyle(.secondary)
                    } else {
                        ForEach(history.entries.prefix(200)) { entry in
                            HistoryRow(
                                entry: entry,
                                onCopy: { copy(entry.finalText) },
                                onDelete: { history.remove(id: entry.id) }
                            )
                        }
                    }
                } header: {
                    HStack {
                        Text("共 \(history.entries.count) 条")
                        Spacer()
                        if !history.entries.isEmpty {
                            Button(role: .destructive) { history.clear() } label: {
                                Label("清空", systemImage: "trash")
                            }
                            .buttonStyle(.borderless).controlSize(.small)
                        }
                    }
                }
            }
            .formStyle(.grouped)
        }
    }

    private func copy(_ text: String) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)
    }
}

private struct HistoryRow: View {
    let entry: DictationEntry
    let onCopy: () -> Void
    let onDelete: () -> Void

    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.finalText)
                .font(.callout)
                .foregroundStyle(.primary)
                .lineLimit(4)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)

            HStack(spacing: 8) {
                Text(Self.dateFormatter.string(from: entry.date))
                    .font(.caption2).foregroundStyle(.secondary)

                if let label = modeLabel { badge(label) }
                if entry.inserted { badge("已输入") }

                Spacer()

                Button {
                    onCopy()
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { copied = false }
                } label: {
                    Label(copied ? "已复制" : "复制",
                          systemImage: copied ? "checkmark" : "doc.on.doc")
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(.borderless).controlSize(.small)

                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless).controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }

    /// The template name this entry was polished with; nil for transcribe-only.
    private var modeLabel: String? {
        if let m = entry.mode {
            return m == "raw" ? nil : m
        }
        return entry.polished != nil ? "润色" : nil
    }

    private func badge(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(.quaternary, in: Capsule())
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MM-dd HH:mm"
        return f
    }()
}
