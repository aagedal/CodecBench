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

    let source_fps: u32 = 30;
    let source_duration_sec: u32 = 10;
    let total_frames = (source_fps * source_duration_sec) as u64;

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

        ffmpeg::generate_test_source(
            &ffmpeg_path,
            &source_path,
            res.width,
            res.height,
            source_duration_sec,
            source_fps,
        )
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

        let encode_args = encoder::build_encode_args(enc, preset, None);
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
            total_frames,
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

        // Quality metrics (optional, speed benchmark uses SSIM/PSNR/VMAF only)
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

            let speed_metrics_config = crate::models::QualityMetricsConfig {
                vmaf: true, ssim: true, psnr: true, xpsnr: false, ssimu2: false,
            };
            metrics::calculate_quality_metrics(
                &ffmpeg_path,
                &source_path,
                &output_path,
                has_libvmaf,
                &speed_metrics_config,
                res.width,
                res.height,
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
            xpsnr: quality.xpsnr,
            ssimu2: quality.ssimu2,
            ffmpeg_args: ffmpeg_args_str,
            output_file: None,
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
        benchmark_mode: "speed".into(),
        source_file: None,
        source_full_path: None,
        output_dir: None,
        results,
        source_duration_sec,
        source_resolution: first_res,
        crf: None,
    };

    Ok(run)
}

/// Run a quality-focused benchmark using a user-provided source clip.
/// Always measures quality metrics (SSIM, PSNR, VMAF if available).
pub async fn run_quality_benchmark(
    app: &AppHandle,
    state: &AppState,
    config: QualityBenchmarkConfig,
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

    {
        let mut cancel = state.benchmark_cancel.lock().unwrap();
        *cancel = false;
    }

    let source = PathBuf::from(&config.source_path);
    if !source.exists() {
        return Err(AppError::Io(format!("Source file not found: {}", config.source_path)));
    }

    // Probe source video
    let (width, height, _fps, duration, total_frames) =
        ffmpeg::probe_video(&ffmpeg_path, &source).await?;

    let resolution = Resolution {
        width,
        height,
        label: format!("{}x{}", width, height),
    };

    let run_id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();
    let system_info = crate::services::system::collect_system_info();

    let encodes_dir = data_dir.join("encodes").join(&run_id);
    std::fs::create_dir_all(&encodes_dir)?;

    let mut jobs: Vec<(EncoderDef, QualityPreset)> = Vec::new();
    for enc in &config.encoders {
        for preset in &config.presets {
            jobs.push((enc.clone(), preset.clone()));
        }
    }

    let total_steps = jobs.len() as u32;
    let mut results: Vec<BenchmarkResult> = Vec::new();

    for (step, (enc, preset)) in jobs.iter().enumerate() {
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
                current_resolution: resolution.label.clone(),
                step: step_num,
                total_steps,
                encoding_fps: None,
                elapsed_ms: 0,
                phase: "encoding".into(),
            },
        );

        let ext = encoder::output_extension(&enc.codec_family);
        let output_filename = format!(
            "{}_{}_{}.{}",
            enc.name,
            preset.to_string().to_lowercase(),
            resolution.label.to_lowercase(),
            ext
        );
        let output_path = encodes_dir.join(&output_filename);

        let encode_args = encoder::build_encode_args(enc, preset, Some(config.crf));
        let ffmpeg_args_str = encode_args.join(" ");

        let app_clone = app.clone();
        let enc_display = enc.display_name.clone();
        let preset_str = preset.to_string();
        let res_label = resolution.label.clone();

        let (encoding_time_ms, output_size_bytes, encoding_fps) = ffmpeg::run_encode(
            &ffmpeg_path,
            &source,
            &output_path,
            &encode_args,
            total_frames,
            move |current_fps| {
                let _ = app_clone.emit(
                    "benchmark-progress",
                    BenchmarkProgress {
                        current_encoder: enc_display.clone(),
                        current_preset: preset_str.clone(),
                        current_resolution: res_label.clone(),
                        step: step_num,
                        total_steps,
                        encoding_fps: Some(current_fps),
                        elapsed_ms: 0,
                        phase: "encoding".into(),
                    },
                );
            },
        )
        .await?;

        // Always measure quality in quality benchmark mode
        let _ = app.emit(
            "benchmark-progress",
            BenchmarkProgress {
                current_encoder: enc.display_name.clone(),
                current_preset: preset.to_string(),
                current_resolution: resolution.label.clone(),
                step: step_num,
                total_steps,
                encoding_fps: None,
                elapsed_ms: 0,
                phase: "measuring_quality".into(),
            },
        );

        let quality = metrics::calculate_quality_metrics(
            &ffmpeg_path,
            &source,
            &output_path,
            has_libvmaf,
            &config.metrics,
            resolution.width,
            resolution.height,
        )
        .await
        .unwrap_or_default();

        results.push(BenchmarkResult {
            id: uuid::Uuid::new_v4().to_string(),
            run_id: run_id.clone(),
            encoder: enc.clone(),
            preset: preset.clone(),
            resolution: resolution.clone(),
            encoding_time_ms,
            encoding_fps,
            output_size_bytes,
            vmaf: quality.vmaf,
            ssim: quality.ssim,
            psnr: quality.psnr,
            xpsnr: quality.xpsnr,
            ssimu2: quality.ssimu2,
            ffmpeg_args: ffmpeg_args_str,
            output_file: Some(output_path.to_string_lossy().to_string()),
        });
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

    // Keep encoded files for quality mode — users want to inspect them

    // Extract just the filename from the full path
    let source_filename = std::path::Path::new(&config.source_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string());

    let run = BenchmarkRun {
        id: run_id,
        timestamp,
        system_info,
        ffmpeg_version,
        benchmark_mode: "quality".into(),
        source_file: source_filename,
        source_full_path: Some(config.source_path.clone()),
        output_dir: Some(encodes_dir.to_string_lossy().to_string()),
        results,
        source_duration_sec: duration.ceil() as u32,
        source_resolution: resolution,
        crf: Some(config.crf),
    };

    Ok(run)
}

/// Re-run quality metrics on existing encoded files for a quality benchmark run.
/// Returns the updated BenchmarkRun with refreshed metric values.
pub async fn rerun_quality_metrics(
    app: &AppHandle,
    state: &AppState,
    run_id: String,
    metrics_config: crate::models::QualityMetricsConfig,
) -> Result<crate::models::BenchmarkRun, AppError> {
    let ffmpeg_path = {
        let guard = state.ffmpeg_path.lock().unwrap();
        guard
            .clone()
            .ok_or_else(|| AppError::FfmpegNotFound("FFmpeg path not set".into()))?
    };

    let has_libvmaf = ffmpeg::check_libvmaf_support(&ffmpeg_path).await;

    // Load the run from DB
    let run = {
        let db = state.db.lock().unwrap();
        crate::db::queries::get_run(&db, &run_id)?
    };

    if run.benchmark_mode != "quality" {
        return Err(AppError::Io("Can only re-run metrics on quality benchmark runs".into()));
    }

    let source_path = run.source_full_path.as_ref()
        .ok_or_else(|| AppError::Io("Source path not available for this run".into()))?;
    let source = PathBuf::from(source_path);
    if !source.exists() {
        return Err(AppError::Io(format!("Source file not found: {}", source_path)));
    }

    let output_dir = run.output_dir.as_ref()
        .ok_or_else(|| AppError::Io("Encoded files have been deleted for this run".into()))?;

    let total_steps = run.results.len() as u32;
    let width = run.source_resolution.width;
    let height = run.source_resolution.height;

    for (step, result) in run.results.iter().enumerate() {
        let output_file = result.output_file.as_ref()
            .ok_or_else(|| AppError::Io(format!("No output file recorded for result {}", result.id)))?;

        let output_path = PathBuf::from(output_file);
        if !output_path.exists() {
            // Try finding the file in the output_dir (in case path changed)
            let filename = output_path.file_name()
                .ok_or_else(|| AppError::Io("Invalid output file path".into()))?;
            let alt_path = PathBuf::from(output_dir).join(filename);
            if !alt_path.exists() {
                return Err(AppError::Io(format!(
                    "Encoded file not found: {}", output_file
                )));
            }
        }

        let step_num = (step + 1) as u32;
        let _ = app.emit(
            "benchmark-progress",
            crate::models::BenchmarkProgress {
                current_encoder: result.encoder.display_name.clone(),
                current_preset: result.preset.to_string(),
                current_resolution: result.resolution.label.clone(),
                step: step_num,
                total_steps,
                encoding_fps: None,
                elapsed_ms: 0,
                phase: "measuring_quality".into(),
            },
        );

        let output_path = if PathBuf::from(output_file).exists() {
            PathBuf::from(output_file)
        } else {
            let filename = PathBuf::from(output_file).file_name().unwrap().to_owned();
            PathBuf::from(output_dir).join(filename)
        };

        let quality = metrics::calculate_quality_metrics(
            &ffmpeg_path,
            &source,
            &output_path,
            has_libvmaf,
            &metrics_config,
            width,
            height,
        )
        .await
        .unwrap_or_default();

        let db = state.db.lock().unwrap();
        crate::db::queries::update_result_metrics(
            &db,
            &result.id,
            quality.vmaf,
            quality.ssim,
            quality.psnr,
            quality.xpsnr,
            quality.ssimu2,
        )?;
    }

    let _ = app.emit(
        "benchmark-progress",
        crate::models::BenchmarkProgress {
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

    // Return the updated run
    let updated_run = {
        let db = state.db.lock().unwrap();
        crate::db::queries::get_run(&db, &run_id)?
    };
    Ok(updated_run)
}

fn source_path_for_resolution(sources_dir: &Path, res: &Resolution) -> PathBuf {
    sources_dir.join(format!("testsrc_{}x{}.y4m", res.width, res.height))
}
