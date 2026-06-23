//  Components.swift
//  Small shared SwiftUI pieces used across the settings sections.

import SwiftUI

/// A secure text field with an eye toggle to reveal the value (for API keys).
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
            }
            .buttonStyle(.borderless)
            .help(reveal ? "隐藏" : "显示")
        }
    }
}
