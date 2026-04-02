use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CodecFamily {
    H264,
    H265,
    AV1,
    ProRes,
}

impl std::fmt::Display for CodecFamily {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CodecFamily::H264 => write!(f, "H264"),
            CodecFamily::H265 => write!(f, "H265"),
            CodecFamily::AV1 => write!(f, "AV1"),
            CodecFamily::ProRes => write!(f, "ProRes"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EncoderType {
    Software,
    Hardware,
}

impl std::fmt::Display for EncoderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EncoderType::Software => write!(f, "Software"),
            EncoderType::Hardware => write!(f, "Hardware"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncoderDef {
    pub name: String,
    pub codec_family: CodecFamily,
    pub encoder_type: EncoderType,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QualityPreset {
    Fast,
    Medium,
    High,
}

impl std::fmt::Display for QualityPreset {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            QualityPreset::Fast => write!(f, "Fast"),
            QualityPreset::Medium => write!(f, "Medium"),
            QualityPreset::High => write!(f, "High"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkConfig {
    pub encoders: Vec<EncoderDef>,
    pub presets: Vec<QualityPreset>,
    pub resolutions: Vec<Resolution>,
    pub enable_quality_metrics: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub id: String,
    pub run_id: String,
    pub encoder: EncoderDef,
    pub preset: QualityPreset,
    pub resolution: Resolution,
    pub encoding_time_ms: u64,
    pub encoding_fps: f64,
    pub output_size_bytes: u64,
    pub vmaf: Option<f64>,
    pub ssim: Option<f64>,
    pub psnr: Option<f64>,
    pub ffmpeg_args: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkRun {
    pub id: String,
    pub timestamp: String,
    pub system_info: SystemInfo,
    pub ffmpeg_version: String,
    pub benchmark_mode: String,        // "speed" or "quality"
    pub source_file: Option<String>,   // filename for quality mode, None for speed (synthetic)
    pub results: Vec<BenchmarkResult>,
    pub source_duration_sec: u32,
    pub source_resolution: Resolution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkRunSummary {
    pub id: String,
    pub timestamp: String,
    pub cpu_name: String,
    pub os: String,
    pub ffmpeg_version: String,
    pub benchmark_mode: String,
    pub source_file: Option<String>,
    pub result_count: u32,
    pub resolutions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub cpu_name: String,
    pub cpu_cores: u32,
    pub cpu_threads: u32,
    pub ram_gb: f64,
    pub os: String,
    pub os_version: String,
    pub gpu: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfmpegInfo {
    pub path: String,
    pub version: String,
    pub encoders: Vec<EncoderDef>,
    pub has_libvmaf: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkProgress {
    pub current_encoder: String,
    pub current_preset: String,
    pub current_resolution: String,
    pub step: u32,
    pub total_steps: u32,
    pub encoding_fps: Option<f64>,
    pub elapsed_ms: u64,
    pub phase: String,
}

/// Config for quality benchmark mode — user provides a source clip
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityBenchmarkConfig {
    pub source_path: String,
    pub encoders: Vec<EncoderDef>,
    pub presets: Vec<QualityPreset>,
}
