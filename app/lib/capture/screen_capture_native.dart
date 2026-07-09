import 'dart:io';
import 'dart:typed_data';

import 'package:screen_capturer/screen_capturer.dart';

/// Native (desktop) screen capture via the `screen_capturer` plugin. macOS needs
/// Screen Recording permission; region mode gives the OS's interactive selection.
bool get captureSupported =>
    Platform.isMacOS || Platform.isWindows || Platform.isLinux;

Future<Uint8List?> _capture(CaptureMode mode) async {
  if (!captureSupported) return null;
  final path =
      '${Directory.systemTemp.path}/tietiezhi_shot_${DateTime.now().millisecondsSinceEpoch}.png';
  final data = await ScreenCapturer.instance.capture(
    mode: mode,
    imagePath: path,
    copyToClipboard: false,
    silent: true,
  );
  if (data?.imageBytes != null) return data!.imageBytes;
  final f = File(path);
  return f.existsSync() ? f.readAsBytesSync() : null;
}

Future<Uint8List?> captureRegion() => _capture(CaptureMode.region);

Future<Uint8List?> captureFull() => _capture(CaptureMode.screen);

Future<String?> savePng(Uint8List bytes) async {
  try {
    final path =
        '${Directory.systemTemp.path}/tietiezhi_annotated_${DateTime.now().millisecondsSinceEpoch}.png';
    await File(path).writeAsBytes(bytes);
    return path;
  } catch (_) {
    return null;
  }
}
