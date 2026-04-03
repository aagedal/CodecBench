export type CodecFamily = "H264" | "H265" | "AV1" | "ProRes";
export type EncoderType = "Software" | "Hardware";
export type QualityPreset = "Fast" | "Medium" | "High";

export interface EncoderDef {
  name: string;
  codec_family: CodecFamily;
  encoder_type: EncoderType;
  display_name: string;
}

export interface Resolution {
  width: number;
  height: number;
  label: string;
}

export interface BenchmarkConfig {
  encoders: EncoderDef[];
  presets: QualityPreset[];
  resolutions: Resolution[];
  enable_quality_metrics: boolean;
}

export interface BenchmarkResult {
  id: string;
  run_id: string;
  encoder: EncoderDef;
  preset: QualityPreset;
  resolution: Resolution;
  encoding_time_ms: number;
  encoding_fps: number;
  output_size_bytes: number;
  vmaf: number | null;
  ssim: number | null;
  psnr: number | null;
  ffmpeg_args: string;
  output_file: string | null;
}

export interface SystemInfo {
  cpu_name: string;
  cpu_cores: number;
  cpu_threads: number;
  ram_gb: number;
  os: string;
  os_version: string;
  gpu: string | null;
}

export interface FfmpegInfo {
  path: string;
  version: string;
  encoders: EncoderDef[];
  has_libvmaf: boolean;
}

export interface BenchmarkRun {
  id: string;
  timestamp: string;
  system_info: SystemInfo;
  ffmpeg_version: string;
  benchmark_mode: "speed" | "quality";
  source_file: string | null;
  output_dir: string | null;
  results: BenchmarkResult[];
  source_duration_sec: number;
  source_resolution: Resolution;
  crf: number | null;
}

export interface BenchmarkRunSummary {
  id: string;
  timestamp: string;
  cpu_name: string;
  os: string;
  ffmpeg_version: string;
  benchmark_mode: "speed" | "quality";
  source_file: string | null;
  result_count: number;
  resolutions: string[];
  crf: number | null;
}

export interface QualityBenchmarkConfig {
  source_path: string;
  encoders: EncoderDef[];
  presets: QualityPreset[];
  crf: number;
}

export interface BenchmarkProgress {
  current_encoder: string;
  current_preset: string;
  current_resolution: string;
  step: number;
  total_steps: number;
  encoding_fps: number | null;
  elapsed_ms: number;
  phase:
    | "generating_source"
    | "encoding"
    | "measuring_quality"
    | "complete";
}
