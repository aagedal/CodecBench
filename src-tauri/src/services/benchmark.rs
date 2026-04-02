use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter};

use crate::error::AppError;
use crate::models::*;
use crate::services::{encoder, ffmpeg, metrics};
use crate::state::AppState;

/// Run the full benchmark suite based on the provided config.
pub async fn run_benchmark(
    app: &AppHandle,
    state: &AppState,
    config: BenchmarkConfig,
    data_dir: PathBuf,
) -> Result<BenchmarkRun, AppError> {
    let ffmpeg_path = {
        let guard = state.ffmpeg_path.lock().unwrap();
        guard
            .clone()
            .ok_or_else(|| AppError::FfmpegNotFound("FFmpeg path not set".into()))?
    };

    let ffmpeg_version = {
        let guard = state.ffmpeg_version.lock().unwrap();
        guard.clone().unwrap_or_else(|| "Unknown".into())
    };

    let has_libvmaf = ffmpeg::check_libvmaf_support(&ffmpeg_path).await;

    // Reset cancel flag
    {
        let mut cancel = state.benchmark_cancel.lock().unwrap();
        *cancel = false;
    }

    let run_id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();
    let system_info = crate::services::system::collect_system_info();

    let sources_dir = data_dir.join("sources");
    let encodes_dir = data_dir.join("encodes").join(&run_id);
    std::fs::create_dir_all(&sources_dir)?;
    std::fs::create_dir_all(&encodes_dir)?;

    // Build the list of all encode jobs
    let mut jobs: Vec<(EncoderDef, QualityPreset, Resolution)> = Vec::new();
    for enc in &config.encoders {
        for preset in &config.presets {
            for res in &config.resolutions {
                jobs.push((enc.clone(), preset.clone(), res.clone()));
            }
        }
    }

    let total_steps = jobs.len() as u32;
    let mut results: Vec<BenchmarkResult> = Vec::new();

    // Generate test sources for each resolution
    for res in &config.resolutions {
        let source_path = source_path_for_resolution(&sources_dir, res);

        let _ = app.emit(
            "benchmark-progress",
            BenchmarkProgress {
                current_encoder: "".into(),
                current_preset: "".into(),
                current_resolution: res.label.clone(),
                step: 0,
                total_steps,
                encoding_fps: None,
                elapsed_ms: 0,
                phase: "generating_source".into(),
            },
        );

        ffmpeg::generate_test_source(&ffmpeg_path, &source_path, res.width, res.height, 10, 30)
            .await?;
    }

    // Run each encode job sequentially
    for (step, (enc, preset, res)) in jobs.iter().enumerate() {
        // Check cancel flag
        {
            let cancel = state.benchmark_cancel.lock().unwrap();
            if *cancel {
                return Err(AppError::Cancelled);
            }
        }

        let step_num = (step + 1) as u32;

        let _ = app.emit(
            "benchmark-progress",
            BenchmarkProgress {
                current_encoder: enc.display_name.clone(),
                current_preset: preset.to_string(),
                current_resolution: res.label.clone(),
                step: step_num,
                total_steps,
                encoding_fps: None,
                elapsed_ms: 0,
                phase: "encoding".into(),
            },
        );

        let source_path = source_path_for_resolution(&sources_dir, res);
        let ext = encoder::output_extension(&enc.codec_family);
        let output_filename = format!(
            "{}_{}_{}.{}",
            enc.name,
            preset.to_string().to_lowercase(),
            res.label.to_lowercase(),
            ext
        );
        let output_path = encodes_dir.join(&output_filename);

        let encode_args = encoder::build_encode_args(enc, preset);
        let ffmpeg_args_str = encode_args.join(" ");

        let app_clone = app.clone();
        let enc_display = enc.display_name.clone();
        let preset_str = preset.to_string();
        let res_label = res.label.clone();

        let (encoding_time_ms, output_size_bytes, encoding_fps) = ffmpeg::run_encode(
            &ffmpeg_path,
            &source_path,
            &output_path,
            &encode_args,
            move |fps| {
                let _ = app_clone.emit(
                    "benchmark-progress",
                    BenchmarkProgress {
                        current_encoder: enc_display.clone(),
                        current_preset: preset_str.clone(),
                        current_resolution: res_label.clone(),
                        step: step_num,
                        total_steps,
                        encoding_fps: Some(fps),
                        elapsed_ms: 0,
                        phase: "encoding".into(),
                    },
                );
            },
        )
        .await?;

        // Quality metrics (optional)
        let quality = if config.enable_quality_metrics {
            let _ = app.emit(
                "benchmark-progress",
                BenchmarkProgress {
                    current_encoder: enc.display_name.clone(),
                    current_preset: preset.to_string(),
                    current_resolution: res.label.clone(),
                    step: step_num,
                    total_steps,
                    encoding_fps: None,
                    elapsed_ms: 0,
                    phase: "measuring_quality".into(),
                },
            );

            metrics::calculate_quality_metrics(
                &ffmpeg_path,
                &source_path,
                &output_path,
                has_libvmaf,
            )
            .await
            .unwrap_or_default()
        } else {
            metrics::QualityMetrics::default()
        };

        let result = BenchmarkResult {
            id: uuid::Uuid::new_v4().to_string(),
            run_id: run_id.clone(),
            encoder: enc.clone(),
            preset: preset.clone(),
            resolution: res.clone(),
            encoding_time_ms,
            encoding_fps,
            output_size_bytes,
            vmaf: quality.vmaf,
            ssim: quality.ssim,
            psnr: quality.psnr,
            ffmpeg_args: ffmpeg_args_str,
        };

        results.push(result);
    }

    let _ = app.emit(
        "benchmark-progress",
        BenchmarkProgress {
            current_encoder: "".into(),
            current_preset: "".into(),
            current_resolution: "".into(),
            step: total_steps,
            total_steps,
            encoding_fps: None,
            elapsed_ms: 0,
            phase: "complete".into(),
        },
    );

    let first_res = config
        .resolutions
        .first()
        .cloned()
        .unwrap_or(Resolution {
            width: 1920,
            height: 1080,
            label: "1080p".into(),
        });

    let run = BenchmarkRun {
        id: run_id,
        timestamp,
        system_info,
        ffmpeg_version,
        results,
        source_duration_sec: 10,
        source_resolution: first_res,
    };

    Ok(run)
}

fn source_path_for_resolution(sources_dir: &Path, res: &Resolution) -> PathBuf {
    sources_dir.join(format!("testsrc_{}x{}.y4m", res.width, res.height))
}
