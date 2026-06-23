//  PageScaffold.swift
//  A consistent page shell: a large title on the left, optional trailing actions
//  on the right, then the page content below. Every settings page uses this so
//  the top chrome never shifts between pages.

import SwiftUI

/// Shared layout metrics so every page lines up.
enum Layout {
    /// Top inset that keeps content clear of the (transparent-titlebar) traffic lights.
    static let topInset: CGFloat = 30
    static let horizontalPadding: CGFloat = 24
}

struct PageScaffold<Toolbar: View, Content: View>: View {
    let title: String
    let toolbar: Toolbar
    let content: Content

    init(title: String,
         @ViewBuilder toolbar: () -> Toolbar,
         @ViewBuilder content: () -> Content) {
        self.title = title
        self.toolbar = toolbar()
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 12) {
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                Spacer(minLength: 0)
                toolbar
            }
            .padding(.horizontal, Layout.horizontalPadding)
            .padding(.top, Layout.topInset)
            .padding(.bottom, 14)

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

extension PageScaffold where Toolbar == EmptyView {
    init(title: String, @ViewBuilder content: () -> Content) {
        self.init(title: title, toolbar: { EmptyView() }, content: content)
    }
}
