# Repository Guidelines

## Project Structure & Module Organization
Orbit is a native macOS SwiftUI app packaged with Swift Package Manager. The executable target is under `Sources/Orbit/`:

- `App/`: entry point, app delegate, status item, window/controller wiring.
- `Models/`: settings, providers, services, capabilities, and model config.
- `Persistence/`: JSON settings plus chat/history stores.
- `Networking/`: provider probes, model listing, chat, and ASR adapters.
- `Dictation/`: hotkey, audio capture, transcription, LLM polish, paste insertion, and pill UI.
- `UI/`: SwiftUI chat and settings views.
- `Support/`: permissions, keycodes, and shared errors.

Brand assets live in `Assets/Brand/`, documentation in `docs/`, and bundle metadata in `Info.plist`.

## Build, Test, and Development Commands
Run from the repository root.

- `./build.sh run`: build debug, assemble `Orbit.app`, sign it, restart, and launch. Use for app-level verification.
- `./build.sh build`: build debug and assemble the app bundle.
- `./build.sh release`: build and assemble a release bundle.
- `./build.sh clean`: remove `.build` artifacts.
- `swift build`: fast compile check only; it does not create the signed `.app` required for macOS permissions.
- `scripts/dev-signing-setup.sh`: create the stable local signing identity used by `build.sh` when available.

## Coding Style & Naming Conventions
Follow Swift API Design Guidelines and existing formatting: 4-space indentation, focused types, and descriptive names. Prefer SwiftUI; use thin AppKit bridges only for macOS-specific surfaces such as status items, panels, event taps, and visual effects. Preserve Swift 5 language mode unless intentionally updating concurrency. Match nearby comment language; UI copy is currently Simplified Chinese.

## Testing Guidelines
There is no test target yet. Validate changes with `swift build` and `./build.sh run` when app bundles, signing, permissions, hotkeys, audio, or paste insertion are involved. If adding tests, create `Tests/OrbitTests/`, use XCTest, name files after the unit under test, and add a test target in `Package.swift`.

## Commit & Pull Request Guidelines
Recent commits use Conventional Commit style with optional scopes, such as `feat(settings): ...`, `chore(brand): ...`, `docs: ...`, and `i18n: ...`. Keep commits focused and imperative. PRs should describe the change, list validation commands, link issues, and include screenshots or recordings for UI updates.

## Security & Configuration Tips
Do not commit credentials or generated local config. Runtime settings live at `~/Library/Application Support/com.orbit.app/config.json`, and API keys are currently stored as plain JSON. Verify changes to signing, bundle IDs, microphone access, Accessibility access, or clipboard/paste behavior in the real app.
