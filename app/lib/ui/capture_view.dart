import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../capture/screen_capture.dart';
import 'theme.dart';

enum _Tool { pen, rect, arrow }

class _Stroke {
  _Stroke(this.tool, this.color);
  final _Tool tool;
  final Color color;
  final List<Offset> points = [];
}

/// 截图卫星（第一版）：区域/全屏截图 → 画布标注（画笔/矩形/箭头）→ 导出。
/// 参照 Swift Capture 那套；元素级框选 / OCR / AI 标注 / 贴图窗为后续细化。
class CaptureView extends StatefulWidget {
  const CaptureView({super.key});

  @override
  State<CaptureView> createState() => _CaptureViewState();
}

class _CaptureViewState extends State<CaptureView> {
  final GlobalKey _boundaryKey = GlobalKey();
  Uint8List? _image;
  final List<_Stroke> _strokes = [];
  _Tool _tool = _Tool.pen;
  Color _color = const Color(0xFFEF4444);
  bool _capturing = false;
  String? _status;

  static const _palette = [
    Color(0xFFEF4444), // red
    Color(0xFFF59E0B), // amber
    Color(0xFF22C55E), // green
    Color(0xFF3B82F6), // blue
    Color(0xFF111827), // near-black
    Color(0xFFFFFFFF), // white
  ];

  Future<void> _capture(Future<Uint8List?> Function() fn) async {
    if (!captureSupported) {
      setState(() => _status = '截图仅桌面端（macOS/Windows/Linux）支持');
      return;
    }
    setState(() {
      _capturing = true;
      _status = null;
    });
    try {
      final bytes = await fn();
      setState(() {
        if (bytes != null) {
          _image = bytes;
          _strokes.clear();
          _status = null;
        } else {
          _status = '未获取到截图（可能取消，或缺少屏幕录制权限）';
        }
      });
    } catch (e) {
      setState(() => _status = '截图失败：$e');
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _export() async {
    try {
      final boundary = _boundaryKey.currentContext!.findRenderObject()
          as RenderRepaintBoundary;
      final img = await boundary.toImage(pixelRatio: 2.0);
      final data = await img.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) return;
      final path = await savePng(data.buffer.asUint8List());
      setState(() => _status = path != null ? '已保存：$path' : '保存失败（该端不支持）');
    } catch (e) {
      setState(() => _status = '导出失败：$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: TietiezhiColors.bg,
      child: Column(
        children: [
          _toolbar(),
          const Divider(height: 1, color: TietiezhiColors.border),
          Expanded(child: _canvasArea()),
          if (_status != null)
            Padding(
              padding: const EdgeInsets.all(10),
              child: Text(_status!,
                  style: const TextStyle(color: TietiezhiColors.textDim, fontSize: 12)),
            ),
        ],
      ),
    );
  }

  Widget _toolbar() {
    final hasImage = _image != null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          const Text('📸  截图',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700, color: TietiezhiColors.text)),
          const SizedBox(width: 16),
          FilledButton.icon(
            onPressed: _capturing ? null : () => _capture(captureRegion),
            icon: const Icon(Icons.crop, size: 16),
            label: const Text('区域'),
          ),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            onPressed: _capturing ? null : () => _capture(captureFull),
            icon: const Icon(Icons.fullscreen, size: 16),
            label: const Text('全屏'),
          ),
          const Spacer(),
          if (hasImage) ..._annotTools(),
        ],
      ),
    );
  }

  List<Widget> _annotTools() => [
        _toolBtn(Icons.edit, _Tool.pen),
        _toolBtn(Icons.crop_square, _Tool.rect),
        _toolBtn(Icons.north_east, _Tool.arrow),
        const SizedBox(width: 8),
        ..._palette.map((c) => GestureDetector(
              onTap: () => setState(() => _color = c),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 2),
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: c,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: _color == c ? TietiezhiColors.accent : TietiezhiColors.border,
                    width: _color == c ? 2 : 1,
                  ),
                ),
              ),
            )),
        const SizedBox(width: 8),
        IconButton(
          icon: const Icon(Icons.undo, size: 18, color: TietiezhiColors.textDim),
          tooltip: '撤销',
          onPressed: _strokes.isEmpty ? null : () => setState(() => _strokes.removeLast()),
        ),
        IconButton(
          icon: const Icon(Icons.delete_outline, size: 18, color: TietiezhiColors.textDim),
          tooltip: '清空标注',
          onPressed: _strokes.isEmpty ? null : () => setState(_strokes.clear),
        ),
        const SizedBox(width: 4),
        FilledButton.icon(
          onPressed: _export,
          icon: const Icon(Icons.save_alt, size: 16),
          label: const Text('保存'),
        ),
      ];

  Widget _toolBtn(IconData icon, _Tool tool) => IconButton(
        icon: Icon(icon, size: 18),
        color: _tool == tool ? TietiezhiColors.accent : TietiezhiColors.textDim,
        onPressed: () => setState(() => _tool = tool),
      );

  Widget _canvasArea() {
    if (_image == null) {
      return Center(
        child: Text(
          captureSupported ? '点「区域」或「全屏」开始截图' : '截图仅桌面端支持；当前平台可用其它功能',
          style: const TextStyle(color: TietiezhiColors.textDim),
        ),
      );
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: RepaintBoundary(
          key: _boundaryKey,
          child: GestureDetector(
            onPanStart: (d) => setState(() {
              final s = _Stroke(_tool, _color)..points.add(d.localPosition);
              _strokes.add(s);
            }),
            onPanUpdate: (d) => setState(() {
              final s = _strokes.last;
              if (s.tool == _Tool.pen) {
                s.points.add(d.localPosition);
              } else {
                // rect/arrow: keep just start + current end
                if (s.points.length < 2) {
                  s.points.add(d.localPosition);
                } else {
                  s.points[1] = d.localPosition;
                }
              }
            }),
            child: Stack(
              children: [
                Image.memory(_image!, fit: BoxFit.contain),
                Positioned.fill(
                  child: CustomPaint(painter: _AnnotationPainter(_strokes)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AnnotationPainter extends CustomPainter {
  _AnnotationPainter(this.strokes);
  final List<_Stroke> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    for (final s in strokes) {
      final p = Paint()
        ..color = s.color
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;
      if (s.points.isEmpty) continue;
      switch (s.tool) {
        case _Tool.pen:
          final path = Path()..moveTo(s.points.first.dx, s.points.first.dy);
          for (final pt in s.points.skip(1)) {
            path.lineTo(pt.dx, pt.dy);
          }
          canvas.drawPath(path, p);
          break;
        case _Tool.rect:
          if (s.points.length >= 2) {
            canvas.drawRect(Rect.fromPoints(s.points[0], s.points[1]), p);
          }
          break;
        case _Tool.arrow:
          if (s.points.length >= 2) {
            _drawArrow(canvas, s.points[0], s.points[1], p);
          }
          break;
      }
    }
  }

  void _drawArrow(Canvas canvas, Offset a, Offset b, Paint p) {
    canvas.drawLine(a, b, p);
    final angle = (b - a).direction;
    const len = 14.0;
    const spread = 0.5;
    final h1 = b - Offset.fromDirection(angle - spread, len);
    final h2 = b - Offset.fromDirection(angle + spread, len);
    canvas.drawLine(b, h1, p);
    canvas.drawLine(b, h2, p);
  }

  @override
  bool shouldRepaint(covariant _AnnotationPainter old) => true;
}
