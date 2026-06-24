//  DictationView.swift
//  The 听写 feature, end to end: pick the ASR model that does speech→text,
//  optionally polish the transcript with an LLM (model + prompt template), then
//  behavior (auto-insert) and the detected microphones. Templates live here too
//  — they're the polish prompts this feature uses, not a separate screen.

import SwiftUI

struct DictationView: View {
    @EnvironmentObject var store: SettingsStore
    @EnvironmentObject var app: AppController

    private var placeholder: String { "{{\(store.settings.insertPosition)}}" }

    /// Models whose protocol is an ASR / chat capability, for the two pickers.
    private var asrModels: [ModelConfig] {
        store.settings.models.filter { store.settings.capability(of: $0) == .asr }
    }
    private var chatModels: [ModelConfig] {
        store.settings.models.filter { store.settings.capability(of: $0) == .chat }
    }

    var body: some View {
        PageScaffold(title: "听写") {
            Form {
                Section("语音识别模型") {
                    Picker("识别模型", selection: $store.settings.asrModelID) {
                        Text("— 无 —").tag(String?.none)
                        ForEach(asrModels) { Text($0.name).tag(Optional($0.id)) }
                    }
                    if asrModels.isEmpty {
                        Text("还没有语音识别模型。去「模型」添加一个，协议选「语音识别」类（如 OpenAI Transcription、MiMo 音频识别）。")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }

                Section("快捷键") {
                    HStack(spacing: 10) {
                        Text(Keycodes.label(for: store.settings.hotkey))
                            .font(.system(.body, design: .monospaced))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 6))

                        if app.capturingHotkey {
                            Text("请按下任意一个键…").foregroundStyle(.secondary)
                            Button("取消") { app.cancelHotkeyCapture() }
                        } else {
                            Button("录制快捷键") { app.beginHotkeyCapture() }
                        }
                        Spacer()
                    }
                    Text("按一下开始录音，再按一下识别。推荐绑定单个修饰键（如右 ⌘）。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                polishSection

                Section("行为") {
                    Toggle("自动输入结果", isOn: $store.settings.autoInsert)
                    Text("识别完成后把文本粘贴进当前聚焦的 App（需要辅助功能权限）。")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("麦克风") {
                    if app.audioInputs.isEmpty {
                        Text("未检测到输入设备。").foregroundStyle(.secondary)
                    } else {
                        ForEach(app.audioInputs, id: \.self) { name in
                            Label(name, systemImage: "mic")
                        }
                    }
                }
            }
            .formStyle(.grouped)
        }
    }

    // MARK: - Polish (LLM model + templates)

    @ViewBuilder
    private var polishSection: some View {
        Section("润色") {
            Toggle("用大模型润色", isOn: $store.settings.llmPolishEnabled)
            Text("识别后、输入前，用一个大模型按下面的模板把文本润色一遍。可关闭。")
                .font(.caption).foregroundStyle(.secondary)

            if store.settings.llmPolishEnabled {
                Picker("润色模型", selection: $store.settings.llmModelID) {
                    Text("— 无 —").tag(String?.none)
                    ForEach(chatModels) { Text($0.name).tag(Optional($0.id)) }
                }
                if chatModels.isEmpty {
                    Text("还没有大模型。去「模型」添加一个（协议选「聊天 / 大模型」类）。")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Picker("模板", selection: $store.settings.activeTemplateID) {
                    Text("— 无 —").tag(String?.none)
                    ForEach(store.settings.templates) { t in
                        Text(t.name).tag(Optional(t.id))
                    }
                }
                Text("用 \(placeholder) 标记识别文本插入的位置。")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }

        if store.settings.llmPolishEnabled {
            Section {
                ForEach($store.settings.templates) { $template in
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("名称", text: $template.name)
                            .textFieldStyle(.roundedBorder)
                        TextEditor(text: $template.template)
                            .frame(minHeight: 80)
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
                    .padding(.vertical, 4)
                }
            } header: {
                HStack {
                    Text("模板")
                    Spacer()
                    Button {
                        store.addTemplate(PromptTemplate(name: "新模板", template: placeholder))
                    } label: {
                        Label("添加模板", systemImage: "plus")
                    }
                    .buttonStyle(.borderless)
                    .controlSize(.small)
                }
            }
        }
    }
}
