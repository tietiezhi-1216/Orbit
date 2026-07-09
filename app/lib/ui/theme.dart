import 'package:flutter/material.dart';

/// Tietiezhi brand palette (dark, matches the macOS app's overlay chrome).
class TietiezhiColors {
  static const accent = Color(0xFF6E7BF2);
  static const accent2 = Color(0xFFB266F2);
  static const bg = Color(0xFF141418);
  static const panel = Color(0xFF1E1E24);
  static const panelAlt = Color(0xFF26262E);
  static const border = Color(0xFF33333C);
  static const text = Color(0xFFECECF1);
  static const textDim = Color(0xFF9A9AA6);
}

ThemeData tietiezhiTheme() {
  final base = ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    scaffoldBackgroundColor: TietiezhiColors.bg,
    colorScheme: const ColorScheme.dark(
      primary: TietiezhiColors.accent,
      secondary: TietiezhiColors.accent2,
      surface: TietiezhiColors.panel,
      onSurface: TietiezhiColors.text,
    ),
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: TietiezhiColors.text,
      displayColor: TietiezhiColors.text,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: TietiezhiColors.panel,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: TietiezhiColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: TietiezhiColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: TietiezhiColors.accent, width: 1.5),
      ),
    ),
  );
}
