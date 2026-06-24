//  Pill.swift
//  The floating recording indicator: a borderless, non-activating panel pinned
//  bottom-center, always on top, hosting a SwiftUI view that shows the live
//  level and ✗ cancel · ✓ done controls.

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
    @Published var level: Float = 0
    var onCancel: (() -> Void)?
    var onCommit: (() -> Void)?
}

@MainActor
final class NoticeState: ObservableObject {
    @Published var title: String = ""
    @Published var message: String = ""
    @Published var actionTitle: String = "取消"

    var onClose: (() -> Void)?
    var onAction: (() -> Void)?
}

@MainActor
final class PillController {
    let state = PillState()
    private var panel: NSPanel?
    private let noticeState = NoticeState()
    private var noticePanel: NSPanel?
    private var noticeDismissTask: Task<Void, Never>?

    var onCancel: (() -> Void)? {
        didSet { state.onCancel = onCancel }
    }
    var onCommit: (() -> Void)? {
        didSet { state.onCommit = onCommit }
    }
    var onNoticeAction: (() -> Void)?

    var isNoticeVisible: Bool {
        noticePanel?.isVisible == true
    }

    func update(status: DictStatus, text: String, level: Float) {
        state.status = status
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

    func showNotice(
        title: String,
        message: String,
        actionTitle: String = "取消",
        autoDismissAfter seconds: TimeInterval? = nil
    ) {
        if noticePanel == nil { buildNotice() }
        noticeDismissTask?.cancel()
        noticeState.title = title
        noticeState.message = message
        noticeState.actionTitle = actionTitle
        positionNotice()
        noticePanel?.orderFrontRegardless()

        if let seconds {
            noticeDismissTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                guard !Task.isCancelled else { return }
                hideNotice()
            }
        }
    }

    func hideNotice() {
        noticeDismissTask?.cancel()
        noticeDismissTask = nil
        noticePanel?.orderOut(nil)
    }

    // MARK: - Panel

    private func build() {
        let hosting = NSHostingView(rootView: PillView(state: state))
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 116, height: 34),
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
        let y = visible.minY + 132
        panel.setFrameOrigin(NSPoint(x: x, y: y))
    }

    private func buildNotice() {
        noticeState.onClose = { [weak self] in self?.hideNotice() }
        noticeState.onAction = { [weak self] in
            self?.hideNotice()
            self?.onNoticeAction?()
        }

        let hosting = NSHostingView(rootView: NoticeView(state: noticeState))
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 304, height: 126),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isFloatingPanel = true
        panel.level = .statusBar
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.contentView = hosting
        noticePanel = panel
    }

    private func positionNotice() {
        guard let noticePanel, let screen = NSScreen.main else { return }
        let visible = screen.visibleFrame
        let size = noticePanel.frame.size
        let x = visible.midX - size.width / 2
        let y = visible.minY + 102
        noticePanel.setFrameOrigin(NSPoint(x: x, y: y))
    }
}

// MARK: - SwiftUI content

struct PillView: View {
    @ObservedObject var state: PillState

    private let barCount = 9

    var body: some View {
        HStack(spacing: 8) {
            circleButton(system: "xmark", style: .cancel) { state.onCancel?() }
            levelBars
                .frame(width: 38)
            circleButton(system: "checkmark", style: .commit) { state.onCommit?() }
        }
        .padding(.horizontal, 5)
        .frame(width: 116, height: 34)
        .background(
            Capsule(style: .continuous)
                .fill(Color.black.opacity(0.88))
                .overlay(Capsule(style: .continuous).strokeBorder(.white.opacity(0.08)))
        )
        .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
    }

    private var levelBars: some View {
        HStack(spacing: 1.6) {
            ForEach(0..<barCount, id: \.self) { i in
                let center = Double(barCount - 1) / 2
                let falloff = 1 - abs(Double(i) - center) / Double(barCount)
                let base = CGFloat([7, 10, 14, 17, 20, 17, 14, 10, 7][i])
                let live = CGFloat(Double(state.level) * 10 * falloff)
                let h = min(22, max(5, base * 0.55 + live))
                Capsule()
                    .fill(Color.white.opacity(0.96))
                    .frame(width: 2, height: h)
                    .animation(.easeOut(duration: 0.08), value: state.level)
            }
        }
        .frame(height: 24)
    }

    private enum ButtonStyleKind {
        case cancel, commit

        var foreground: Color {
            switch self {
            case .cancel: return .white.opacity(0.9)
            case .commit: return .black.opacity(0.88)
            }
        }

        var background: Color {
            switch self {
            case .cancel: return Color.white.opacity(0.18)
            case .commit: return Color.white.opacity(0.94)
            }
        }
    }

    private func circleButton(system: String, style: ButtonStyleKind, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(style.foreground)
                .frame(width: 26, height: 26)
                .background(Circle().fill(style.background))
        }
        .buttonStyle(.plain)
    }
}

private struct NoticeView: View {
    @ObservedObject var state: NoticeState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                Image(systemName: "exclamationmark.circle")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(red: 0.96, green: 0.48, blue: 0.18))

                Text(state.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                Spacer(minLength: 6)

                Button(action: { state.onClose?() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.58))
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(.plain)
            }

            Text(state.message)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(.white.opacity(0.76))
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            HStack {
                Spacer()
                Button(action: { state.onAction?() }) {
                    Text(state.actionTitle)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 13)
                        .frame(height: 31)
                        .background(
                            Capsule(style: .continuous)
                                .fill(Color.white.opacity(0.25))
                        )
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(.top, 2)
        }
        .padding(.top, 16)
        .padding(.horizontal, 18)
        .padding(.bottom, 15)
        .frame(width: 304, height: 126)
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color(red: 0.075, green: 0.07, blue: 0.07))
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .strokeBorder(.white.opacity(0.06))
                )
        )
        .shadow(color: .black.opacity(0.40), radius: 20, x: 0, y: 9)
    }
}
