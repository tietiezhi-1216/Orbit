import 'dart:typed_data';

// Web / no-dart:io fallback: screen capture is not available.
bool get captureSupported => false;

Future<Uint8List?> captureRegion() async => null;

Future<Uint8List?> captureFull() async => null;

Future<String?> savePng(Uint8List bytes) async => null;
