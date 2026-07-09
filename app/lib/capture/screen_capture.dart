import 'dart:typed_data';

// screen_capturer uses dart:io, so it must never reach the web compile. Pick the
// native implementation only when dart:io exists; web/others get the stub.
import 'screen_capture_stub.dart'
    if (dart.library.io) 'screen_capture_native.dart' as impl;

/// Whether interactive screen capture is available on this platform (desktop).
bool get captureSupported => impl.captureSupported;

/// Interactive region capture (user drags a rectangle). Returns PNG bytes.
Future<Uint8List?> captureRegion() => impl.captureRegion();

/// Full-screen capture. Returns PNG bytes.
Future<Uint8List?> captureFull() => impl.captureFull();

/// Save PNG [bytes] to a file; returns the path (or null on failure/unsupported).
Future<String?> savePng(Uint8List bytes) => impl.savePng(bytes);
