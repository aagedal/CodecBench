use std::path::{Path, PathBuf};
use std::process::Stdio;

use regex::Regex;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::error::AppError;
use crate::models::{CodecFamily, EncoderDef, EncoderType, FfmpegInfo};

/// All known encoder definitions we look for
fn known_encoders() -> Vec<EncoderDef> {
    vec![
        // Software encoders
        EncoderDef {
            name: "libx264".into(),
            codec_family: CodecFamily::H264,
            encoder_type: EncoderType::Software,
            display_name: "H.264 (x264)".into(),
        },
        EncoderDef {
            name: "libx265".into(),
            codec_family: CodecFamily::H265,
            encoder_type: EncoderType::Software,
            display_name: "H.265 (x265)".into(),
        },
        EncoderDef {
            name: "libsvtav1".into(),
            codec_family: CodecFamily::AV1,
            encoder_type: EncoderType::Software,
            display_name: "AV1 (SVT-AV1)".into(),
        },
        EncoderDef {
            name: "libaom-av1".into(),
            codec_family: CodecFamily::AV1,
            encoder_type: EncoderType::Software,
            display_name: "AV1 (libaom)".into(),
        },
        EncoderDef {
            name: "prores_ks".into(),
            codec_family: CodecFamily::ProRes,
            encoder_type: EncoderType::Software,
            display_name: "ProRes (prores_ks)".into(),
        },
        // macOS VideoToolbox
        EncoderDef {
            name: "h264_videotoolbox".into(),
            codec_family: CodecFamily::H264,
            encoder_type: EncoderType::Hardware,
            display_name: "H.264 (VideoToolbox)".into(),
        },
        EncoderDef {
            name: "hevc_videotoolbox".into(),
            codec_family: CodecFamily::H265,
            encoder_type: EncoderType::Hardware,
            display_name: "H.265 (VideoToolbox)".into(),
        },
        EncoderDef {
            name: "av1_videotoolbox".into(),
            codec_family: CodecFamily::AV1,
            encoder_type: EncoderType::Hardware,
            display_name: "AV1 (VideoToolbox)".into(),
        },
        EncoderDef {
            name: "prores_videotoolbox".into(),
            codec_family: CodecFamily::ProRes,
            encoder_type: EncoderType::Hardware,
            display_name: "ProRes (VideoToolbox)".into(),
        },
        // NVIDIA NVENC
        EncoderDef {
            name: "h264_nvenc".into(),
            codec_family: CodecFamily::H264,
            encoder_type: EncoderType::Hardware,
            display_name: "H.264 (NVENC)".into(),
        },
        EncoderDef {
            name: "hevc_nvenc".into(),
            codec_family: CodecFamily::H265,
            encoder_type: EncoderType::Hardware,
            display_name: "H.265 (NVENC)".into(),
        },
        EncoderDef {
            name: "av1_nvenc".into(),
            codec_family: CodecFamily::AV1,
            encoder_type: EncoderType::Hardware,
            display_name: "AV1 (NVENC)".into(),
        },
        // Intel QSV
        EncoderDef {
            name: "h264_qsv".into(),
            codec_family: CodecFamily::H264,
            encoder_type: EncoderType::Hardware,
            display_name: "H.264 (QSV)".into(),
        },
        EncoderDef {
            name: "hevc_qsv".into(),
            codec_family: CodecFamily::H265,
            encoder_type: EncoderType::Hardware,
            display_name: "H.265 (QSV)".into(),
        },
        EncoderDef {
            name: "av1_qsv".into(),
            codec_family: CodecFamily::AV1,
            encoder_type: EncoderType::Hardware,
            display_name: "AV1 (QSV)".into(),
        },
        // AMD AMF
        EncoderDef {
            name: "h264_amf".into(),
            codec_family: CodecFamily::H264,
            encoder_type: EncoderType::Hardware,
            display_name: "H.264 (AMF)".into(),
        },
        EncoderDef {
            name: "hevc_amf".into(),
            codec_family: CodecFamily::H265,
            encoder_type: EncoderType::Hardware,
            display_name: "H.265 (AMF)".into(),
        },
        EncoderDef {
            name: "av1_amf".into(),
            codec_family: CodecFamily::AV1,
            encoder_type: EncoderType::Hardware,
            display_name: "AV1 (AMF)".into(),
        },
    ]
}

/// Platform-specific paths to search for ffmpeg
fn candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if cfg!(target_os = "macos") {
        paths.push(PathBuf::from("/opt/homebrew/bin/ffmpeg"));
        paths.push(PathBuf::from("/usr/local/bin/ffmpeg"));
    } else if cfg!(target_os = "linux") {
        paths.push(PathBuf::from("/usr/bin/ffmpeg"));
        paths.push(PathBuf::from("/usr/local/bin/ffmpeg"));
        paths.push(PathBuf::from("/snap/bin/ffmpeg"));
    } else if cfg!(target_os = "windows") {
        paths.push(PathBuf::from(r"C:\ffmpeg\bin\ffmpeg.exe"));
        // Chocolatey
        if let Ok(pd) = std::env::var("ProgramData") {
            paths.push(PathBuf::from(format!(
                r"{}\chocolatey\bin\ffmpeg.exe",
                pd
            )));
        }
        // Scoop
        if let Ok(home) = std::env::var("USERPROFILE") {
            paths.push(PathBuf::from(format!(
                r"{}\scoop\apps\ffmpeg\current\bin\ffmpeg.exe",
                home
            )));
        }
    }

    paths
}

/// Try to find ffmpeg on the system
pub fn detect_ffmpeg_path() -> Option<PathBuf> {
    // Check platform-specific paths first
    for path in candidate_paths() {
        if path.exists() {
            return Some(path);
        }
    }

    // Fall back to PATH lookup
    which::which("ffmpeg").ok()
}

/// Validate an ffmpeg binary and get its version string
pub async fn get_ffmpeg_version(ffmpeg_path: &Path) -> Result<String, AppError> {
    let output = Command::new(ffmpeg_path)
        .arg("-version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| AppError::FfmpegExecution(format!("Failed to run ffmpeg: {}", e)))?;

    if !output.status.success() {
        return Err(AppError::FfmpegExecution(
            "ffmpeg -version returned non-zero exit code".into(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // First line is like: "ffmpeg version 6.1.1 Copyright ..."
    let version = stdout
        .lines()
        .next()
        .unwrap_or("unknown")
        .to_string();

    Ok(version)
}

/// Discover which encoders are available in this ffmpeg build
pub async fn discover_encoders(ffmpeg_path: &Path) -> Result<Vec<EncoderDef>, AppError> {
    let output = Command::new(ffmpeg_path)
        .args(["-hide_banner", "-encoders"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| AppError::FfmpegExecution(format!("Failed to query encoders: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let known = known_encoders();

    let available: Vec<EncoderDef> = known
        .into_iter()
        .filter(|enc| {
            // Each encoder line looks like: " V..... libx264    ..."
            // We check if the encoder name appears as a word in the output
            let pattern = format!(r"\b{}\b", regex::escape(&enc.name));
            Regex::new(&pattern)
                .map(|re| re.is_match(&stdout))
                .unwrap_or(false)
        })
        .collect();

    Ok(available)
}

/// Check if ffmpeg has libvmaf support
pub async fn check_libvmaf_support(ffmpeg_path: &Path) -> bool {
    let output = Command::new(ffmpeg_path)
        .args(["-hide_banner", "-filters"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.contains("libvmaf")
        }
        Err(_) => false,
    }
}

/// Full detection: find path, version, encoders, vmaf support
pub async fn detect_and_validate(ffmpeg_path: &Path) -> Result<FfmpegInfo, AppError> {
    let version = get_ffmpeg_version(ffmpeg_path).await?;
    let encoders = discover_encoders(ffmpeg_path).await?;
    let has_libvmaf = check_libvmaf_support(ffmpeg_path).await;

    Ok(FfmpegInfo {
        path: ffmpeg_path.to_string_lossy().to_string(),
        version,
        encoders,
        has_libvmaf,
    })
}

/// Generate a test source video using ffmpeg's testsrc2 filter
pub async fn generate_test_source(
    ffmpeg_path: &Path,
    output_path: &Path,
    width: u32,
    height: u32,
    duration_sec: u32,
    fps: u32,
) -> Result<(), AppError> {
    if output_path.exists() {
        return Ok(());
    }

    // Ensure parent directory exists
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let filter = format!(
        "testsrc2=duration={}:size={}x{}:rate={}",
        duration_sec, width, height, fps
    );

    let mut child = Command::new(ffmpeg_path)
        .args([
            "-f",
            "lavfi",
            "-i",
            &filter,
            "-c:v",
            "rawvideo",
            "-pix_fmt",
            "yuv420p",
            "-y",
        ])
        .arg(output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::FfmpegExecution(format!("Failed to spawn ffmpeg: {}", e)))?;

    let status = child
        .wait()
        .await
        .map_err(|e| AppError::FfmpegExecution(format!("Failed to wait for ffmpeg: {}", e)))?;

    if !status.success() {
        // Try to read stderr for error details
        let stderr_output = if let Some(stderr) = child.stderr.take() {
            let mut reader = BufReader::new(stderr);
            let mut buf = String::new();
            let _ = reader.read_line(&mut buf).await;
            buf
        } else {
            "Unknown error".to_string()
        };
        return Err(AppError::FfmpegExecution(format!(
            "Test source generation failed: {}",
            stderr_output
        )));
    }

    Ok(())
}

/// Run an encoding job and return (encoding_time_ms, output_size_bytes, last_fps)
pub async fn run_encode(
    ffmpeg_path: &Path,
    input_path: &Path,
    output_path: &Path,
    encoder_args: &[String],
    progress_callback: impl Fn(f64) + Send,
) -> Result<(u64, u64, f64), AppError> {
    // Ensure parent directory exists
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let start = std::time::Instant::now();

    let mut cmd = Command::new(ffmpeg_path);
    cmd.args(["-i"])
        .arg(input_path)
        .args(encoder_args)
        .arg("-y")
        .arg(output_path)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::FfmpegExecution(format!("Failed to spawn ffmpeg: {}", e)))?;

    let fps_re = Regex::new(r"fps=\s*(\d+\.?\d*)").unwrap();
    let mut last_fps: f64 = 0.0;

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        // ffmpeg writes progress to stderr as carriage-return delimited lines
        // We read line by line; tokio handles the async buffering
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(caps) = fps_re.captures(&line) {
                if let Some(fps_match) = caps.get(1) {
                    if let Ok(fps) = fps_match.as_str().parse::<f64>() {
                        last_fps = fps;
                        progress_callback(fps);
                    }
                }
            }
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| AppError::FfmpegExecution(format!("Failed to wait for ffmpeg: {}", e)))?;

    let elapsed_ms = start.elapsed().as_millis() as u64;

    if !status.success() {
        return Err(AppError::FfmpegExecution(format!(
            "Encoding failed with exit code: {:?}",
            status.code()
        )));
    }

    let output_size = std::fs::metadata(output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok((elapsed_ms, output_size, last_fps))
}
