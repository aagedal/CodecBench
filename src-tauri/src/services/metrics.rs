use std::path::Path;
use std::process::Stdio;

use regex::Regex;
use tokio::process::Command;

use crate::error::AppError;

#[derive(Debug, Clone, Default)]
pub struct QualityMetrics {
    pub vmaf: Option<f64>,
    pub ssim: Option<f64>,
    pub psnr: Option<f64>,
}

/// Calculate VMAF, SSIM, and PSNR between a reference and encoded file.
/// Requires ffmpeg built with libvmaf for VMAF scores.
pub async fn calculate_quality_metrics(
    ffmpeg_path: &Path,
    reference_path: &Path,
    encoded_path: &Path,
    has_libvmaf: bool,
) -> Result<QualityMetrics, AppError> {
    let mut metrics = QualityMetrics::default();

    // PSNR + SSIM in one pass
    let output = Command::new(ffmpeg_path)
        .args(["-i"])
        .arg(encoded_path)
        .args(["-i"])
        .arg(reference_path)
        .args([
            "-lavfi",
            "ssim;[0:v][1:v]psnr",
            "-f",
            "null",
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| AppError::FfmpegExecution(format!("Quality metrics failed: {}", e)))?;

    let stderr = String::from_utf8_lossy(&output.stderr);

    // Parse SSIM: "SSIM Y:0.987654 ..."  or "All:0.987654"
    let ssim_re = Regex::new(r"SSIM.*All:(\d+\.\d+)").unwrap();
    if let Some(caps) = ssim_re.captures(&stderr) {
        if let Some(m) = caps.get(1) {
            metrics.ssim = m.as_str().parse().ok();
        }
    }

    // Parse PSNR: "PSNR ... average:46.123"
    let psnr_re = Regex::new(r"PSNR.*average:(\d+\.\d+)").unwrap();
    if let Some(caps) = psnr_re.captures(&stderr) {
        if let Some(m) = caps.get(1) {
            metrics.psnr = m.as_str().parse().ok();
        }
    }

    // VMAF in a separate pass (requires libvmaf)
    if has_libvmaf {
        let vmaf_output = Command::new(ffmpeg_path)
            .args(["-i"])
            .arg(encoded_path)
            .args(["-i"])
            .arg(reference_path)
            .args([
                "-lavfi",
                "libvmaf",
                "-f",
                "null",
                "-",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| AppError::FfmpegExecution(format!("VMAF calculation failed: {}", e)))?;

        let vmaf_stderr = String::from_utf8_lossy(&vmaf_output.stderr);

        // Parse VMAF score: "VMAF score: 95.123" or "VMAF score = 95.123"
        let vmaf_re = Regex::new(r"VMAF score[=:]\s*(\d+\.?\d*)").unwrap();
        if let Some(caps) = vmaf_re.captures(&vmaf_stderr) {
            if let Some(m) = caps.get(1) {
                metrics.vmaf = m.as_str().parse().ok();
            }
        }
    }

    Ok(metrics)
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
