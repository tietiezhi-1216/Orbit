//  SettingsSection.swift
//  Stable identifiers for Orbit's in-window settings workspace.

import Foundation

enum SettingsSection: String, CaseIterable, Identifiable {
    case providers
    case models
    case dictation
    case templates
    case about

    var id: Self { self }

    var title: String {
        switch self {
        case .providers: return "服务商"
        case .models: return "模型"
        case .dictation: return "听写"
        case .templates: return "模板"
        case .about: return "权限 & 关于"
        }
    }

    var symbol: String {
        switch self {
        case .providers: return "server.rack"
        case .models: return "cube.box"
        case .dictation: return "mic"
        case .templates: return "text.quote"
        case .about: return "lock.shield"
        }
    }
}
