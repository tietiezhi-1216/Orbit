//  OrbitError.swift
//  A tiny LocalizedError carrying a human-facing message, used across the
//  audio / ASR / LLM / insert layers so failures surface readable Chinese text
//  in the recording pill.

import Foundation

struct OrbitError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}
