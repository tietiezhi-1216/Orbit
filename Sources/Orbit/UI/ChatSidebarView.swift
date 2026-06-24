//  ChatSidebarView.swift
//  Codex-style sidebar: compact chrome, new chat, real conversation history,
//  and a bottom settings entry. No placeholder project/search data.

import SwiftUI

struct ChatSidebarView: View {
    @EnvironmentObject var chat: ChatStore
    @EnvironmentObject private var app: AppController

    let openSettings: () -> Void

    var body: some View {
        ZStack {
            VisualEffectView(material: .sidebar)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Color.clear.frame(height: 44)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        newConversationAction
                        conversationsSection
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 6)
                    .padding(.bottom, 16)
                }

                settingsFooter
            }
        }
        .frame(maxWidth: .infinity)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private var newConversationAction: some View {
        VStack(alignment: .leading, spacing: 2) {
            SidebarItemRow(title: "新对话", systemImage: "square.and.pencil") {
                chat.newConversation()
                app.openChatWorkspace()
            }
        }
    }

    private var conversationsSection: some View {
        VStack(alignment: .leading, spacing: 5) {
            SidebarSectionTitle("对话")

            VStack(alignment: .leading, spacing: 2) {
                if chat.conversations.isEmpty {
                    SidebarItemRow(title: "暂无对话",
                                   systemImage: nil,
                                   isDisabled: true)
                } else {
                    ForEach(Array(chat.conversations.prefix(12))) { convo in
                        SidebarItemRow(title: convo.title.isEmpty ? "新对话" : convo.title,
                                       systemImage: nil,
                                       trailing: SidebarDateFormatter.relative(convo.createdAt),
                                       isSelected: app.workspace == .chat && chat.selectedID == convo.id) {
                            chat.selectedID = convo.id
                            app.openChatWorkspace()
                        }
                        .contextMenu {
                            Button("删除", role: .destructive) {
                                chat.deleteConversation(id: convo.id)
                            }
                        }
                    }
                }
            }
        }
    }

    private var settingsFooter: some View {
        VStack(spacing: 0) {
            SidebarItemRow(title: "设置",
                           systemImage: "gearshape",
                           isSelected: app.workspace == .settings) {
                openSettings()
            }
            .padding(.horizontal, 14)
            .padding(.top, 8)
            .padding(.bottom, 13)
        }
    }
}

private struct SidebarSectionTitle: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(.secondary.opacity(0.78))
            .padding(.horizontal, 2)
            .padding(.bottom, 2)
    }
}

private struct SidebarItemRow: View {
    let title: String
    let systemImage: String?
    var trailing: String?
    var isSelected = false
    var isIndented = false
    var isDisabled = false
    var action: () -> Void = {}

    @State private var isHovering = false

    var body: some View {
        Button {
            guard !isDisabled else { return }
            action()
        } label: {
            HStack(spacing: 8) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(iconColor)
                        .frame(width: 18)
                } else if !isIndented {
                    Spacer()
                        .frame(width: 4)
                }

                Text(title)
                    .font(.system(size: 14, weight: .regular))
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer(minLength: 8)

                if let trailing {
                    Text(trailing)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary.opacity(0.78))
                        .lineLimit(1)
                }
            }
            .padding(.leading, isIndented ? 26 : 8)
            .padding(.trailing, 8)
            .frame(height: 30)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(rowBackground, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .foregroundStyle(foreground)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
    }

    private var rowBackground: Color {
        if isSelected { return Color.white.opacity(0.16) }
        if isHovering && !isDisabled { return Color.white.opacity(0.12) }
        return .clear
    }

    private var foreground: Color {
        if isDisabled { return Color.secondary.opacity(0.55) }
        return Color.primary.opacity(isSelected ? 1 : 0.92)
    }

    private var iconColor: Color {
        if isDisabled { return Color.secondary.opacity(0.45) }
        return Color.primary.opacity(isSelected ? 0.94 : 0.78)
    }
}

private enum SidebarDateFormatter {
    static func relative(_ date: Date, now: Date = Date()) -> String {
        let seconds = max(0, now.timeIntervalSince(date))
        let days = Int(seconds / 86_400)

        switch days {
        case 0:
            return "今天"
        case 1:
            return "昨天"
        case 2...6:
            return "\(days) 天"
        default:
            let weeks = max(1, days / 7)
            return "\(weeks) 周"
        }
    }
}
