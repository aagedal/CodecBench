use rusqlite::Row;

use crate::models::*;

/// Convert a benchmark_runs row into a BenchmarkRun (without results — those are loaded separately)
pub fn run_from_row(row: &Row) -> rusqlite::Result<BenchmarkRun> {
    Ok(BenchmarkRun {
        id: row.get("id")?,
        timestamp: row.get("timestamp")?,
        system_info: SystemInfo {
            cpu_name: row.get("cpu_name")?,
            cpu_cores: row.get("cpu_cores")?,
            cpu_threads: row.get("cpu_threads")?,
            ram_gb: row.get("ram_gb")?,
            os: row.get("os")?,
            os_version: row.get("os_version")?,
            gpu: row.get("gpu")?,
        },
        ffmpeg_version: row.get("ffmpeg_version")?,
        benchmark_mode: row.get("benchmark_mode")?,
        source_file: row.get("source_file")?,
        output_dir: row.get("output_dir")?,
        results: Vec::new(),
        source_duration_sec: row.get("source_duration_sec")?,
        source_resolution: Resolution {
            width: row.get("source_resolution_w")?,
            height: row.get("source_resolution_h")?,
            label: row.get("source_resolution_label")?,
        },
        crf: row.get("crf")?,
    })
}

/// Convert a benchmark_results row into a BenchmarkResult
pub fn result_from_row(row: &Row) -> rusqlite::Result<BenchmarkResult> {
    let codec_family_str: String = row.get("codec_family")?;
    let encoder_type_str: String = row.get("encoder_type")?;
    let preset_str: String = row.get("preset")?;

    let codec_family = match codec_family_str.as_str() {
        "H264" => CodecFamily::H264,
        "H265" => CodecFamily::H265,
        "AV1" => CodecFamily::AV1,
        "ProRes" => CodecFamily::ProRes,
        _ => CodecFamily::H264,
    };

    let encoder_type = match encoder_type_str.as_str() {
        "Software" => EncoderType::Software,
        "Hardware" => EncoderType::Hardware,
        _ => EncoderType::Software,
    };

    let preset = match preset_str.as_str() {
        "Fast" => QualityPreset::Fast,
        "Medium" => QualityPreset::Medium,
        "High" => QualityPreset::High,
        _ => QualityPreset::Medium,
    };

    Ok(BenchmarkResult {
        id: row.get("id")?,
        run_id: row.get("run_id")?,
        encoder: EncoderDef {
            name: row.get("encoder_name")?,
            codec_family,
            encoder_type,
            display_name: row.get("encoder_display_name")?,
        },
        preset,
        resolution: Resolution {
            width: row.get("resolution_w")?,
            height: row.get("resolution_h")?,
            label: row.get("resolution_label")?,
        },
        encoding_time_ms: row.get("encoding_time_ms")?,
        encoding_fps: row.get("encoding_fps")?,
        output_size_bytes: row.get("output_size_bytes")?,
        vmaf: row.get("vmaf")?,
        ssim: row.get("ssim")?,
        psnr: row.get("psnr")?,
        ffmpeg_args: row.get("ffmpeg_args")?,
        output_file: row.get("output_file")?,
    })
}

/// Convert a benchmark_runs row into a BenchmarkRunSummary
pub fn summary_from_row(row: &Row) -> rusqlite::Result<BenchmarkRunSummary> {
    Ok(BenchmarkRunSummary {
        id: row.get("id")?,
        timestamp: row.get("timestamp")?,
        cpu_name: row.get("cpu_name")?,
        os: row.get("os")?,
        ffmpeg_version: row.get("ffmpeg_version")?,
        benchmark_mode: row.get("benchmark_mode")?,
        source_file: row.get("source_file")?,
        result_count: row.get("result_count")?,
        resolutions: Vec::new(), // populated separately
        crf: row.get("crf")?,
    })
}
