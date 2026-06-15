//! Microphone capture. Opens the default input device, downmixes to mono,
//! linearly resamples to `target_rate`, and pushes `i16` PCM frames to a tokio
//! channel. The cpal stream lives on its own OS thread (it is `!Send`), so the
//! async dictation session just drains the channel.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SizedSample};
use tokio::sync::mpsc::Sender;

pub struct AudioCapture {
    stop: Arc<AtomicBool>,
}

impl AudioCapture {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop();
    }
}

/// List the names of available input devices (for the settings UI).
pub fn list_inputs() -> Vec<String> {
    let host = cpal::default_host();
    match host.input_devices() {
        Ok(devs) => devs.filter_map(|d| d.name().ok()).collect(),
        Err(_) => Vec::new(),
    }
}

/// Begin capturing. Frames are best-effort (`try_send`) so a slow consumer
/// never blocks the realtime audio callback.
pub fn start(target_rate: u32, frames: Sender<Vec<i16>>) -> anyhow::Result<AudioCapture> {
    let stop = Arc::new(AtomicBool::new(false));
    let stop_thread = stop.clone();

    std::thread::spawn(move || {
        if let Err(e) = run(target_rate, frames, stop_thread) {
            eprintln!("[audio] capture failed: {e:?}");
        }
    });

    Ok(AudioCapture { stop })
}

fn run(target_rate: u32, frames: Sender<Vec<i16>>, stop: Arc<AtomicBool>) -> anyhow::Result<()> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| anyhow::anyhow!("no default input device"))?;
    let supported = device.default_input_config()?;
    let src_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.config();

    let err_fn = |e| eprintln!("[audio] stream error: {e}");

    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            build::<f32>(&device, &config, channels, src_rate, target_rate, frames, err_fn)?
        }
        cpal::SampleFormat::I16 => {
            build::<i16>(&device, &config, channels, src_rate, target_rate, frames, err_fn)?
        }
        cpal::SampleFormat::U16 => {
            build::<u16>(&device, &config, channels, src_rate, target_rate, frames, err_fn)?
        }
        other => return Err(anyhow::anyhow!("unsupported sample format {other:?}")),
    };

    stream.play()?;
    while !stop.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(40));
    }
    drop(stream);
    Ok(())
}

fn build<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    channels: usize,
    src_rate: u32,
    target_rate: u32,
    frames: Sender<Vec<i16>>,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
) -> anyhow::Result<cpal::Stream>
where
    T: Sample + SizedSample,
    f32: FromSample<T>,
{
    let stream = device.build_input_stream(
        config,
        move |data: &[T], _: &cpal::InputCallbackInfo| {
            let out = process::<T>(data, channels, src_rate, target_rate);
            if !out.is_empty() {
                let _ = frames.try_send(out);
            }
        },
        err_fn,
        None,
    )?;
    Ok(stream)
}

fn process<T>(data: &[T], channels: usize, src_rate: u32, target_rate: u32) -> Vec<i16>
where
    T: Sample,
    f32: FromSample<T>,
{
    if channels == 0 {
        return Vec::new();
    }
    let n = data.len() / channels;
    let mut mono = Vec::with_capacity(n);
    for i in 0..n {
        let mut acc = 0f32;
        for c in 0..channels {
            acc += f32::from_sample(data[i * channels + c]);
        }
        mono.push(acc / channels as f32);
    }

    if src_rate == target_rate {
        return mono.iter().map(|v| to_i16(*v)).collect();
    }

    // Linear resample mono -> target_rate.
    let ratio = target_rate as f32 / src_rate as f32;
    let out_len = ((mono.len() as f32) * ratio).floor() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src_pos = i as f32 / ratio;
        let idx = src_pos.floor() as usize;
        let frac = src_pos - idx as f32;
        let a = mono.get(idx).copied().unwrap_or(0.0);
        let b = mono.get(idx + 1).copied().unwrap_or(a);
        out.push(to_i16(a + (b - a) * frac));
    }
    out
}

#[inline]
fn to_i16(v: f32) -> i16 {
    (v.clamp(-1.0, 1.0) * 32767.0) as i16
}

/// Root-mean-square level of a frame, mapped to a lively 0..1 for the meter.
pub fn level(frame: &[i16]) -> f32 {
    if frame.is_empty() {
        return 0.0;
    }
    let sum_sq: f64 = frame.iter().map(|s| {
        let f = *s as f64 / 32768.0;
        f * f
    }).sum();
    let rms = (sum_sq / frame.len() as f64).sqrt() as f32;
    // Perceptual-ish boost so quiet speech still moves the meter.
    (rms * 4.0).clamp(0.0, 1.0)
}

pub fn pcm16_to_bytes(frame: &[i16]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(frame.len() * 2);
    for s in frame {
        bytes.extend_from_slice(&s.to_le_bytes());
    }
    bytes
}
