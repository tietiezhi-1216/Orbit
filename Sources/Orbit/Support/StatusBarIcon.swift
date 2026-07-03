//  StatusBarIcon.swift
//  The menu-bar mark, drawn in code from the brand geometry (planet + tilted
//  orbit ring + satellite — same composition as Orbit.icns) instead of a stock
//  SF Symbol. Rendered as a template image so macOS tints it correctly for
//  light/dark menu bars and the selected state.

import AppKit

enum StatusBarIcon {

    /// 18×18 pt template image sized for the menu bar.
    static func make() -> NSImage {
        let side: CGFloat = 18
        let image = NSImage(size: NSSize(width: side, height: side), flipped: false) { _ in
            draw(side: side, scale: 1)
            return true
        }
        image.isTemplate = true   // let the menu bar tint it (white on dark, etc.)
        return image
    }

    /// Shared drawing so previews render the exact production geometry.
    static func draw(side: CGFloat, scale: CGFloat) {
        let center = NSPoint(x: side / 2, y: side / 2)
        let planetRadius = 3.7 * scale
        let ringRX = 7.8 * scale
        let ringRY = 3.0 * scale
        let tilt: CGFloat = 24                    // degrees, matches the icns ring
        let satelliteRadius = 1.4 * scale
        NSColor.black.setFill()
        NSColor.black.setStroke()

        // The ring's rotation, reused to place the satellite exactly on it.
        let rotate = NSAffineTransform()
        rotate.translateX(by: center.x, yBy: center.y)
        rotate.rotate(byDegrees: tilt)
        rotate.translateX(by: -center.x, yBy: -center.y)

        // Satellite: on the ring, up-right of the planet (ellipse parameter
        // picked so it sits clear of both the planet gap and the canvas edge).
        let t: CGFloat = 0.12 * .pi
        let rawPoint = NSPoint(x: center.x + ringRX * cos(t), y: center.y + ringRY * sin(t))
        let satellite = rotate.transform(rawPoint)

        // Planet core.
        NSBezierPath(ovalIn: NSRect(
            x: center.x - planetRadius, y: center.y - planetRadius,
            width: planetRadius * 2, height: planetRadius * 2)).fill()

        // Orbit ring, clipped to keep a clean breathing gap around both the
        // planet and the satellite (reads as depth, like line-style 🪐 marks).
        NSGraphicsContext.saveGraphicsState()
        let keepOut = NSBezierPath(rect: NSRect(x: 0, y: 0, width: side, height: side))
        let planetGap = planetRadius + 1.1 * scale
        keepOut.appendOval(in: NSRect(
            x: center.x - planetGap, y: center.y - planetGap,
            width: planetGap * 2, height: planetGap * 2))
        let satelliteGap = satelliteRadius + 0.9 * scale
        keepOut.appendOval(in: NSRect(
            x: satellite.x - satelliteGap, y: satellite.y - satelliteGap,
            width: satelliteGap * 2, height: satelliteGap * 2))
        keepOut.windingRule = .evenOdd
        keepOut.addClip()

        let ring = NSBezierPath(ovalIn: NSRect(
            x: center.x - ringRX, y: center.y - ringRY,
            width: ringRX * 2, height: ringRY * 2))
        ring.transform(using: rotate as AffineTransform)
        ring.lineWidth = 1.2 * scale
        ring.stroke()
        NSGraphicsContext.restoreGraphicsState()

        // The satellite itself.
        NSBezierPath(ovalIn: NSRect(
            x: satellite.x - satelliteRadius, y: satellite.y - satelliteRadius,
            width: satelliteRadius * 2, height: satelliteRadius * 2)).fill()
    }
}
