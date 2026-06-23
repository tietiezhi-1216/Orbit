//  Pill.swift
//  The floating recording indicator: a borderless, non-activating panel pinned
//  bottom-center, always on top, hosting a SwiftUI view that shows the live
//  level / partial text and ✗ cancel · ✓ done controls.

import AppKit
import SwiftUI
import Combine

/// Dictation phases surfaced in the pill.
enum DictStatus: String {
    case recording, transcribing, polishing, inserting, idle, error

    var label: String {
        switch self {
        case .recording:    return "录音中"
        case .transcribing: return "识别中"
        case .polishing:    return "润色中"
        case .inserting:    return "输入中"
        case .idle:         return "完成"
        case .error:        return "出错"
        }
    }
}

/// Observable state shared between the engine and the pill view.
@MainActor
final class PillState: ObservableObject {
    @Published var status: DictStatus = .recording
    @Published var text: String = ""
    @Published var level: Float = 0
    var onCancel: (() -> Void)?
    var onCommit: (() -> Void)?
}

@MainActor
final class PillController {
    let state = PillState()
    private var panel: NSPanel?

    var onCancel: (() -> Void)? {
        didSet { state.onCancel = onCancel }
    }
    var onCommit: (() -> Void)? {
        didSet { state.onCommit = onCommit }
    }

    func update(status: DictStatus, text: String, level: Float) {
        state.status = status
        state.text = text
        state.level = level
    }

    func show() {
        if panel == nil { build() }
        position()
        panel?.orderFrontRegardless()
    }

    func hide() {
        panel?.orderOut(nil)
    }

    // MARK: - Panel

    private func build() {
        let hosting = NSHostingView(rootView: PillView(state: state))
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 56),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isFloatingPanel = true
        panel.level = .statusBar
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.contentView = hosting
        self.panel = panel
    }

    private func position() {
        guard let panel, let screen = NSScreen.main else { return }
        let visible = screen.visibleFrame
        let size = panel.frame.size
        let x = visible.midX - size.width / 2
        let y = visible.minY + 120
        panel.setFrameOrigin(NSPoint(x: x, y: y))
    }
}

// MARK: - SwiftUI content

struct PillView: View {
    @ObservedObject var state: PillState

    private let barCount = 5

    var body: some View {
        HStack(spacing: 8) {
            circleButton(system: "xmark", tint: .red) { state.onCancel?() }

            HStack(spacing: 6) {
                if state.text.isEmpty {
                    levelBars
                } else {
                    Text(state.text)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.92))
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                Text(state.status.label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.55))
            }
            .frame(maxWidth: .infinity)

            circleButton(system: "checkmark", tint: .green) { state.onCommit?() }
        }
        .padding(.horizontal, 8)
        .frame(width: 300, height: 56)
        .background(
            Capsule(style: .continuous)
                .fill(Color.black.opacity(0.85))
                .overlay(Capsule(style: .continuous).strokeBorder(.white.opacity(0.10)))
        )
    }

    private var levelBars: some View {
        HStack(spacing: 3) {
            ForEach(0..<barCount, id: \.self) { i in
                let center = Double(barCount - 1) / 2
                let falloff = 1 - abs(Double(i) - center) / Double(barCount)
                let h = max(4, 4 + CGFloat(Double(state.level) * 18 * falloff))
                Capsule()
                    .fill(Color.green.opacity(0.9))
                    .frame(width: 3, height: h)
                    .animation(.easeOut(duration: 0.08), value: state.level)
            }
        }
        .frame(height: 22)
    }

    private func circleButton(system: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(Circle().fill(tint.opacity(0.85)))
        }
        .buttonStyle(.plain)
    }
}
