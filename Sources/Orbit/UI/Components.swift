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
