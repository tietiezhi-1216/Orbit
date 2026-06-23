//  TemplatesView.swift
//  Reusable LLM polish prompts. The placeholder (default `{{transcript}}`) marks
//  where the recognized text is injected.

import SwiftUI

struct TemplatesView: View {
    @EnvironmentObject var store: SettingsStore

    private var placeholder: String { "{{\(store.settings.insertPosition)}}" }

    var body: some View {
        PageScaffold(title: "模板") {
            Button {
                store.addTemplate(PromptTemplate(name: "新模板", template: placeholder))
            } label: {
                Label("添加模板", systemImage: "plus")
            }
            .buttonStyle(.bordered)
        } content: {
            Form {
                Section("当前模板") {
                    Picker("选择", selection: $store.settings.activeTemplateID) {
                        Text("— 无 —").tag(String?.none)
                        ForEach(store.settings.templates) { t in
                            Text(t.name).tag(Optional(t.id))
                        }
                    }
                    Text("用 \(placeholder) 标记识别文本插入的位置。")
                        .font(.caption).foregroundStyle(.secondary)
                }

                ForEach($store.settings.templates) { $template in
                    Section {
                        TextField("名称", text: $template.name)
                            .textFieldStyle(.roundedBorder)
                        TextEditor(text: $template.template)
                            .frame(minHeight: 96)
                            .font(.system(.callout, design: .monospaced))
                        HStack {
                            Spacer()
                            Button(role: .destructive) {
                                store.removeTemplate(id: template.id)
                            } label: {
                                Label("删除", systemImage: "trash")
                            }
                        }
                    }
                }
            }
            .formStyle(.grouped)
        }
    }
}
