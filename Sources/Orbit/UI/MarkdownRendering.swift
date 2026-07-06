//  MarkdownRendering.swift
//  Renders assistant replies with MarkdownUI (mainstream SwiftUI Markdown: code
//  blocks, tables, lists, GFM). Code blocks get a header (language + copy) and a
//  bordered, scrollable body.
//
//  NOTE: syntax coloring (Highlightr / highlight.js) is intentionally NOT wired
//  here. Highlightr loads its highlight.js via SwiftPM's generated `Bundle.module`
//  accessor, which resolves resources at `Bundle.main.bundleURL/<pkg>.bundle`
//  (the .app ROOT) or a hardcoded build-machine path — neither of which exists in
//  a signed/notarized .app assembled by build.sh (code signing forbids anything
//  but `Contents/` at the bundle root). Instantiating `Highlightr()` therefore
//  hits an uncatchable `fatalError` at runtime on any machine other than the build
//  host (it crashed 0.0.6 on launch the first time chat rendered a code block).
//  Code renders as clean monospaced text until highlighting is restored through a
//  resource path that survives signing.

import SwiftUI
import AppKit
import MarkdownUI

/// A chat Markdown block with bordered, copyable code blocks.
struct ChatMarkdown: View {
    let content: String

    var body: some View {
        Markdown(content)
            .markdownBlockStyle(\.codeBlock) { configuration in
                CodeBlock(configuration: configuration)
            }
            .textSelection(.enabled)
    }
}

/// A code block with a header (language + copy button) and a bordered, scrollable
/// body — the pattern users expect from other apps.
private struct CodeBlock: View {
    let configuration: CodeBlockConfiguration
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text((configuration.language?.isEmpty == false ? configuration.language! : "code"))
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                Spacer()
                Button(action: copy) {
                    Label(copied ? "已复制" : "复制", systemImage: copied ? "checkmark" : "doc.on.doc")
                        .font(.caption)
                        .foregroundStyle(copied ? Color.green : Color.secondary)
                }
                .buttonStyle(.plain)
                .help("复制代码")
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)

            Divider()

            ScrollView(.horizontal, showsIndicators: false) {
                configuration.label
                    .font(.system(.callout, design: .monospaced))
                    .padding(10)
            }
        }
        .background(Color.primary.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(.quaternary))
        .padding(.top, 2)      // back to the original small top margin
        .padding(.bottom, 12)  // clear gap below, so it isn't glued to the next text
    }

    private func copy() {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(configuration.content, forType: .string)
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
    }
}
