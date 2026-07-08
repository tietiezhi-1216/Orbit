//  Components.swift
//  Small shared SwiftUI pieces used across the settings sections.

import SwiftUI

/// A secure text field with an eye toggle to reveal the value (for API keys).
/// The toggle is a dedicated trailing control sitting just outside the field —
/// so it never overlaps the field's border or the typed text.
struct RevealableSecureField: View {
    let title: String
    @Binding var text: String
    @State private var reveal = false

    var body: some View {
        HStack(spacing: 6) {
            Group {
                if reveal {
                    TextField(title, text: $text)
                } else {
                    SecureField(title, text: $text)
                }
            }
            .textFieldStyle(.roundedBorder)

            Button {
                reveal.toggle()
            } label: {
                Image(systemName: reveal ? "eye.slash" : "eye")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .frame(width: 24, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(reveal ? "隐藏" : "显示")
        }
    }
}

struct LLMCapabilityBadges: View {
    let capabilities: LLMCapabilities
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 4 : 6) {
            LLMCapabilityBadge(
                title: "多模态",
                supported: capabilities.multimodal,
                compact: compact
            )
            LLMCapabilityBadge(
                title: "思考",
                supported: capabilities.thinking,
                compact: compact
            )
            LLMCapabilityBadge(
                title: "工具",
                supported: capabilities.toolCalling,
                compact: compact
            )
        }
        .lineLimit(1)
    }
}

private struct LLMCapabilityBadge: View {
    let title: String
    let supported: Bool
    let compact: Bool

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: supported ? "checkmark.circle.fill" : "xmark.circle")
                .imageScale(.small)
            if compact {
                Text(title)
                Text(supported ? "是" : "否")
                    .fontWeight(.semibold)
            } else {
                Text("\(title)：\(supported ? "是" : "否")")
            }
        }
        .font(compact ? .caption2 : .caption)
        .foregroundStyle(supported ? Color.green : Color.secondary)
        .padding(.horizontal, compact ? 5 : 7)
        .padding(.vertical, compact ? 2 : 4)
        .background(
            Capsule(style: .continuous)
                .fill(supported ? Color.green.opacity(0.12) : Color.secondary.opacity(0.10))
        )
        .help("\(title)：\(supported ? "支持" : "不支持")")
    }
}
