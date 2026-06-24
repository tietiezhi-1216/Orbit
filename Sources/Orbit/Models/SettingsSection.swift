//  SettingsSection.swift
//  Stable identifiers for Orbit's in-window settings workspace, grouped into a
//  two-level sidebar: top-level groups (模型服务 / 功能 / 系统) each containing
//  their sections. "功能" holds whole features (听写 today; screenshot
//  annotation and others later), so adding a feature is just a new case here.

import Foundation

/// A top-level sidebar group (parent menu).
enum SettingsGroup: Int, CaseIterable, Identifiable {
    case access    // 服务商 + 模型 — where models come from
    case feature   // 完整功能：听写、（后续）截图标注 …
    case system    // 权限 & 关于

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .access:  return "模型服务"
        case .feature: return "功能"
        case .system:  return "系统"
        }
    }
}

enum SettingsSection: String, CaseIterable, Identifiable {
    case providers
    case models
    case dictation
    case about

    var id: Self { self }

    /// The parent group this section lives under.
    var group: SettingsGroup {
        switch self {
        case .providers, .models: return .access
        case .dictation:          return .feature
        case .about:              return .system
        }
    }

    var title: String {
        switch self {
        case .providers: return "服务商"
        case .models: return "模型"
        case .dictation: return "听写"
        case .about: return "权限 & 关于"
        }
    }

    var symbol: String {
        switch self {
        case .providers: return "server.rack"
        case .models: return "cube.box"
        case .dictation: return "mic"
        case .about: return "lock.shield"
        }
    }

    /// Sections belonging to a group, in declaration order.
    static func sections(in group: SettingsGroup) -> [SettingsSection] {
        allCases.filter { $0.group == group }
    }
}
