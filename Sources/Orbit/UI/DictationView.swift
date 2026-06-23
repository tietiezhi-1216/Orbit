//  DictationView.swift
//  Hotkey binding, behavior toggles, and the detected microphone list.

import SwiftUI

struct DictationView: View {
    @EnvironmentObject var store: SettingsStore
    @EnvironmentObject var app: AppController

    var body: some View {
        PageScaffold(title: "听写") {
            Form {
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

                Section("行为") {
                    Toggle("自动输入结果", isOn: $store.settings.autoInsert)
                    Text("识别完成后把文本粘贴进当前聚焦的 App（需要辅助功能权限）。")
                        .font(.caption).foregroundStyle(.secondary)
                    Toggle("用大模型润色", isOn: $store.settings.llmPolishEnabled)
                    Text("在输入前，用当前大模型把识别文本润色一遍。可关闭。")
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
}
