//  PageScaffold.swift
//  A consistent page shell: a large title on the left, optional trailing actions
//  on the right, then the page content below. Every settings page uses this so
//  the top chrome never shifts between pages.

import SwiftUI

/// Shared layout metrics so every page lines up.
enum Layout {
    /// Top inset for in-window workspace headers.
    static let topInset: CGFloat = 54
    static let horizontalPadding: CGFloat = 40
    static let contentMaxWidth: CGFloat = 760
}

struct PageScaffold<Toolbar: View, Content: View>: View {
    let title: String
    /// Upper bound on content width. Forms stay readable at the default; wide
    /// surfaces (e.g. the providers table) pass a larger value or `.infinity`.
    let maxWidth: CGFloat
    let toolbar: Toolbar
    let content: Content

    init(title: String,
         maxWidth: CGFloat = Layout.contentMaxWidth,
         @ViewBuilder toolbar: () -> Toolbar,
         @ViewBuilder content: () -> Content) {
        self.title = title
        self.maxWidth = maxWidth
        self.toolbar = toolbar()
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 12) {
                Text(title)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                Spacer(minLength: 0)
                toolbar
            }
            .padding(.top, Layout.topInset)
            .padding(.bottom, 16)

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: maxWidth, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, Layout.horizontalPadding)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

extension PageScaffold where Toolbar == EmptyView {
    init(title: String,
         maxWidth: CGFloat = Layout.contentMaxWidth,
         @ViewBuilder content: () -> Content) {
        self.init(title: title, maxWidth: maxWidth, toolbar: { EmptyView() }, content: content)
    }
}
