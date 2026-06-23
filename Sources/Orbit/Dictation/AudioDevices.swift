//  AudioDevices.swift
//  Enumerate available audio input devices for display in Settings.

import AVFoundation

enum AudioDevices {
    static func inputNames() -> [String] {
        let types: [AVCaptureDevice.DeviceType] = [.microphone, .external]
        let session = AVCaptureDevice.DiscoverySession(
            deviceTypes: types,
            mediaType: .audio,
            position: .unspecified
        )
        return session.devices.map { $0.localizedName }
    }
}
