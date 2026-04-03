use std::path::Path;
use std::process::Stdio;

use regex::Regex;
use ssimulacra2::{ColorPrimaries, Rgb, TransferCharacteristic, compute_frame_ssimulacra2};
use tokio::io::AsyncReadExt;
use tokio::process::Command;

use crate::error::AppError;
use crate::models::QualityMetricsConfig;

#[derive(Debug, Clone, Default)]
pub struct QualityMetrics {
    pub vmaf: Option<f64>,
    pub ssim: Option<f64>,
    pub psnr: Option<f64>,
    pub xpsnr: Option<f64>,
    pub ssimu2: Option<f64>,
}

/// Calculate selected quality metrics between a reference and encoded file.
/// `has_libvmaf` gates VMAF even if config.vmaf is true.
/// `width` and `height` are the video dimensions (needed for SSIMULACRA2 frame reading).
pub async fn calculate_quality_metrics(
    ffmpeg_path: &Path,
    reference_path: &Path,
    encoded_path: &Path,
    has_libvmaf: bool,
    config: &QualityMetricsConfig,
    width: u32,
    height: u32,
) -> Result<QualityMetrics, AppError> {
    let mut metrics = QualityMetrics::default();

    if config.ssim {
        metrics.ssim = measure_ssim(ffmpeg_path, reference_path, encoded_path).await;
    }
    if config.psnr {
        metrics.psnr = measure_psnr(ffmpeg_path, reference_path, encoded_path).await;
    }
    if config.vmaf && has_libvmaf {
        metrics.vmaf = measure_vmaf(ffmpeg_path, reference_path, encoded_path).await;
    }
    if config.xpsnr {
        metrics.xpsnr = measure_xpsnr(ffmpeg_path, reference_path, encoded_path).await;
    }
    if config.ssimu2 {
        metrics.ssimu2 = measure_ssimu2(ffmpeg_path, reference_path, encoded_path, width, height).await;
    }

    Ok(metrics)
}

async fn measure_ssim(ffmpeg_path: &Path, reference_path: &Path, encoded_path: &Path) -> Option<f64> {
    let output = Command::new(ffmpeg_path)
        .args(["-i"]).arg(encoded_path)
        .args(["-i"]).arg(reference_path)
        .args(["-filter_complex", "[0:v][1:v]ssim", "-f", "null", "-"])
        .stdout(Stdio::piped()).stderr(Stdio::piped())
        .output().await.ok()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let re = Regex::new(r"All:(\d+\.\d+)").unwrap();
    re.captures(&stderr).and_then(|c| c.get(1)).and_then(|m| m.as_str().parse().ok())
}

async fn measure_psnr(ffmpeg_path: &Path, reference_path: &Path, encoded_path: &Path) -> Option<f64> {
    let output = Command::new(ffmpeg_path)
        .args(["-i"]).arg(encoded_path)
        .args(["-i"]).arg(reference_path)
        .args(["-filter_complex", "[0:v][1:v]psnr", "-f", "null", "-"])
        .stdout(Stdio::piped()).stderr(Stdio::piped())
        .output().await.ok()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let re = Regex::new(r"average:(\d+\.\d+)").unwrap();
    re.captures(&stderr).and_then(|c| c.get(1)).and_then(|m| m.as_str().parse().ok())
}

async fn measure_vmaf(ffmpeg_path: &Path, reference_path: &Path, encoded_path: &Path) -> Option<f64> {
    let output = Command::new(ffmpeg_path)
        .args(["-i"]).arg(encoded_path)
        .args(["-i"]).arg(reference_path)
        .args(["-filter_complex", "[0:v][1:v]libvmaf", "-f", "null", "-"])
        .stdout(Stdio::piped()).stderr(Stdio::piped())
        .output().await.ok()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let re = Regex::new(r"(?:VMAF score[=:]\s*|VMAF Mean:\s*)(\d+\.?\d*)").unwrap();
    re.captures(&stderr).and_then(|c| c.get(1)).and_then(|m| m.as_str().parse().ok())
}

/// XPSNR — Extended PSNR via ffmpeg's built-in xpsnr filter (available since ffmpeg 5.1).
/// Returns the luma-weighted average XPSNR in dB.
async fn measure_xpsnr(ffmpeg_path: &Path, reference_path: &Path, encoded_path: &Path) -> Option<f64> {
    let output = Command::new(ffmpeg_path)
        .args(["-i"]).arg(encoded_path)
        .args(["-i"]).arg(reference_path)
        .args(["-filter_complex", "[0:v][1:v]xpsnr", "-f", "null", "-"])
        .stdout(Stdio::piped()).stderr(Stdio::piped())
        .output().await.ok()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    // Example: "XPSNR y:41.12 u:49.22 v:50.01  (w. avg.: 41.97 dB)"
    let re = Regex::new(r"w\.\s*avg\.\s*:\s*([\d.]+)\s*dB").unwrap();
    re.captures(&stderr).and_then(|c| c.get(1)).and_then(|m| m.as_str().parse().ok())
}

/// SSIMULACRA2 — perceptual quality metric from the libjxl project.
/// Streams frames at 1 fps from both videos, computes per-frame scores, and returns the average.
/// Score range: roughly 0 (very bad) to ~100 (near-lossless). Good encodes typically score 60–80+.
async fn measure_ssimu2(
    ffmpeg_path: &Path,
    reference_path: &Path,
    encoded_path: &Path,
    width: u32,
    height: u32,
) -> Option<f64> {
    let frame_bytes = (width as usize) * (height as usize) * 3;

    // Decode at 1 fps to keep processing time reasonable
    let mut ref_proc = Command::new(ffmpeg_path)
        .args(["-i"]).arg(reference_path)
        .args(["-vf", "fps=1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"])
        .stdout(Stdio::piped()).stderr(Stdio::null())
        .spawn().ok()?;

    let mut enc_proc = Command::new(ffmpeg_path)
        .args(["-i"]).arg(encoded_path)
        .args(["-vf", "fps=1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"])
        .stdout(Stdio::piped()).stderr(Stdio::null())
        .spawn().ok()?;

    let mut ref_stdout = ref_proc.stdout.take()?;
    let mut enc_stdout = enc_proc.stdout.take()?;

    let mut scores: Vec<f64> = Vec::new();
    let mut ref_buf = vec![0u8; frame_bytes];
    let mut enc_buf = vec![0u8; frame_bytes];

    loop {
        let ref_ok = read_exact_or_eof(&mut ref_stdout, &mut ref_buf).await.unwrap_or(false);
        let enc_ok = read_exact_or_eof(&mut enc_stdout, &mut enc_buf).await.unwrap_or(false);

        if !ref_ok || !enc_ok {
            break;
        }

        let ref_data: Vec<[f32; 3]> = ref_buf
            .chunks(3)
            .map(|p| [p[0] as f32 / 255.0, p[1] as f32 / 255.0, p[2] as f32 / 255.0])
            .collect();
        let enc_data: Vec<[f32; 3]> = enc_buf
            .chunks(3)
            .map(|p| [p[0] as f32 / 255.0, p[1] as f32 / 255.0, p[2] as f32 / 255.0])
            .collect();

        let w = width as usize;
        let h = height as usize;

        let score = tokio::task::spawn_blocking(move || -> Option<f64> {
            let src = Rgb::new(
                ref_data, w, h,
                TransferCharacteristic::SRGB,
                ColorPrimaries::BT709,
            ).ok()?;
            let dst = Rgb::new(
                enc_data, w, h,
                TransferCharacteristic::SRGB,
                ColorPrimaries::BT709,
            ).ok()?;
            compute_frame_ssimulacra2(src, dst).ok()
        }).await.ok().flatten();

        if let Some(s) = score {
            scores.push(s);
        }
    }

    let _ = ref_proc.kill().await;
    let _ = enc_proc.kill().await;

    if scores.is_empty() {
        return None;
    }
    Some(scores.iter().sum::<f64>() / scores.len() as f64)
}

/// Read exactly `buf.len()` bytes; returns false on EOF, error on I/O failure.
async fn read_exact_or_eof(
    reader: &mut (impl AsyncReadExt + Unpin),
    buf: &mut [u8],
) -> std::io::Result<bool> {
    match reader.read_exact(buf).await {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => Ok(false),
        Err(e) => Err(e),
    }
}

/// Parse encoding fps from an ffmpeg stderr progress line
pub fn parse_fps_from_line(line: &str) -> Option<f64> {
    let re = Regex::new(r"fps=\s*(\d+\.?\d*)").unwrap();
    re.captures(line)
        .and_then(|caps| caps.get(1))
        .and_then(|m| m.as_str().parse().ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_fps() {
        let line = "frame=  150 fps= 45.3 q=23.0 size=    1536kB time=00:00:05.00 bitrate=2514.2kbits/s speed=1.5x";
        assert_eq!(parse_fps_from_line(line), Some(45.3));
    }

    #[test]
    fn test_parse_fps_integer() {
        let line = "frame=  300 fps=120 q=-1.0 Lsize=    2048kB";
        assert_eq!(parse_fps_from_line(line), Some(120.0));
    }

    #[test]
    fn test_parse_fps_none() {
        assert_eq!(parse_fps_from_line("some random line"), None);
    }
}
