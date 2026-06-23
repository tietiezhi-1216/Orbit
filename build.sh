#!/usr/bin/env bash
#
# Orbit build helper.
#
# `swift build` only produces a bare executable. A macOS GUI app that requests
# Microphone / Accessibility permissions and runs as a menu-bar agent needs a
# real .app bundle: an Info.plist and a (here ad-hoc) code signature so macOS
# gives it a stable identity for TCC. This script builds the executable,
# assembles that bundle, signs it, and — for `run` — launches it.
#
# Usage:
#   ./build.sh build      # compile + assemble Orbit.app (debug)
#   ./build.sh run        # build, then (re)launch the app
#   ./build.sh release    # compile + assemble in release config
#   ./build.sh clean      # remove build artifacts
#
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="Orbit"
CMD="${1:-build}"
APP_PATH=""

assemble() {
    local config="$1"
    echo "▶ swift build -c $config"
    swift build -c "$config"

    local bin app
    bin="$(swift build -c "$config" --show-bin-path)"
    app="$bin/$APP_NAME.app"

    rm -rf "$app"
    mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
    cp "$bin/$APP_NAME" "$app/Contents/MacOS/$APP_NAME"
    cp "Info.plist" "$app/Contents/Info.plist"
    codesign --force --sign - "$app" >/dev/null 2>&1 || true

    echo "✅ $app"
    APP_PATH="$app"
}

case "$CMD" in
    build)   assemble debug ;;
    release) assemble release ;;
    run)
        assemble debug
        pkill -x "$APP_NAME" 2>/dev/null || true
        sleep 0.4
        open "$APP_PATH"
        echo "🚀 launched $APP_NAME"
        ;;
    clean)   rm -rf .build && echo "cleaned" ;;
    *)
        echo "usage: ./build.sh [build|run|release|clean]"
        exit 1
        ;;
esac
