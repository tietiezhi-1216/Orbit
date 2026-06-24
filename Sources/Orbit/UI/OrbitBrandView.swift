//  OrbitBrandView.swift
//  Shared brand header pieces that use the real bundled app icon instead of an
//  emoji placeholder.

import SwiftUI
import AppKit

struct OrbitAppIconView: View {
    var size: CGFloat = 20

    private var icon: NSImage? { OrbitAppIconView.loadIcon() }

    var body: some View {
        Group {
            if let icon {
                Image(nsImage: icon)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
            } else {
                Image(systemName: "circle")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .stroke(.white.opacity(0.18), lineWidth: 0.5)
        )
        .accessibilityHidden(true)
    }

    private static func loadIcon() -> NSImage? {
        if let url = Bundle.main.url(forResource: "Orbit", withExtension: "icns"),
           let image = NSImage(contentsOf: url) {
            return image
        }
        return NSImage(named: NSImage.applicationIconName)
    }
}

struct OrbitBrandTitle: View {
    var iconSize: CGFloat = 20
    var fontSize: CGFloat = 15

    var body: some View {
        HStack(spacing: 8) {
            OrbitAppIconView(size: iconSize)
            Text("Orbit")
                .font(.system(size: fontSize, weight: .semibold, design: .rounded))
                .kerning(0.1)
                .foregroundStyle(.primary)
        }
    }
}
