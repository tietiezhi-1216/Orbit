//  DictationModesView.swift
//  听写 › 模板: the user's own polish templates. No presets — you add, edit, and
//  delete your own. The active one is the system prompt sent to the model; the
//  transcript is sent separately as data. Hotwords are folded in by the system
//  (PromptComposer), so a template needs no placeholder; an optional `{{HOTWORDS}}`
//  slot just lets an advanced user choose where that block lands.

import SwiftUI

struct DictationModesView: View {
    @EnvironmentObject var store: SettingsStore

    private var templates: [PromptTemplate] { store.settings.templates }
    private var activeID: String? { store.settings.activeTemplateID }

    var body: some View {
        PageScaffold(title: "听写 · 模板", toolbar: {
            Button { addTemplate() } label: { Label("添加模板", systemImage: "plus") }
                .controlSize(.small)
        }) {
            Form {
                Section {
                    Text("单击模式识别后，用「当前」模板润色一遍；长按只转写、不润色。模板就是发给模型的系统提示词，转写作为数据单独发送。热词由系统自动加入，模板只写润色规则即可；高级用法：在模板里写 `\(hotwordsPlaceholder)` 可指定热词块出现的位置。")
                        .font(.caption).foregroundStyle(.secondary)
                }

                if templates.isEmpty {
                    Section {
                        Text("还没有模板。点右上角「添加模板」，写上你想要的润色风格。")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }

                ForEach($store.settings.templates) { $template in
                    templateSection($template)
                }
            }
            .formStyle(.grouped)
        }
    }

    @ViewBuilder
    private func templateSection(_ template: Binding<PromptTemplate>) -> some View {
        let isActive = activeID == template.wrappedValue.id
        Section {
            TextField("名称", text: template.name)
                .textFieldStyle(.roundedBorder)

            TextEditor(text: template.template)
                .frame(minHeight: 180)
                .font(.system(.callout, design: .monospaced))
                .overlay(alignment: .topLeading) {
                    if template.wrappedValue.template.isEmpty {
                        Text("写下系统提示词，只描述如何润色即可…")
                            .font(.system(.callout, design: .monospaced))
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8).padding(.leading, 5)
                            .allowsHitTesting(false)
                    }
                }

            HStack {
                if isActive {
                    Label("当前使用", systemImage: "checkmark.circle.fill")
                        .font(.caption).foregroundStyle(Color.accentColor)
                } else {
                    Button {
                        store.settings.activeTemplateID = template.wrappedValue.id
                    } label: {
                        Label("设为当前", systemImage: "circle")
                    }
                    .buttonStyle(.borderless).controlSize(.small)
                }
                Spacer()
                Button(role: .destructive) {
                    store.removeTemplate(id: template.wrappedValue.id)
                } label: {
                    Label("删除", systemImage: "trash")
                }
                .buttonStyle(.borderless).controlSize(.small)
            }
        } header: {
            Text(template.wrappedValue.name.isEmpty ? "未命名模板" : template.wrappedValue.name)
        }
    }

    private func addTemplate() {
        let new = PromptTemplate(name: "新模板", template: "")
        store.addTemplate(new)
        store.settings.activeTemplateID = new.id
    }
}
