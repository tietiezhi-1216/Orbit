// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "Orbit",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "Orbit",
            path: "Sources/Orbit"
        )
    ],
    // Use the Swift 5 language mode: this is a UI app full of AppKit / SwiftUI
    // callbacks, and the strict Swift 6 concurrency checking buys us little here
    // while costing a lot of annotation noise. We can tighten this later.
    swiftLanguageModes: [.v5]
)
