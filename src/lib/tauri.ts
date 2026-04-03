import { invoke } from "@tauri-apps/api/core";
import type {
  BenchmarkConfig,
  BenchmarkRun,
  BenchmarkRunSummary,
  EncoderDef,
  FfmpegInfo,
  QualityBenchmarkConfig,
  QualityMetricsConfig,
  SystemInfo,
} from "../types";

export const detectFfmpeg = () => invoke<FfmpegInfo>("detect_ffmpeg");

export const setFfmpegPath = (path: string) =>
  invoke<FfmpegInfo>("set_ffmpeg_path", { path });

export const getAvailableEncoders = () =>
  invoke<EncoderDef[]>("get_available_encoders");

export const startBenchmark = (config: BenchmarkConfig) =>
  invoke<BenchmarkRun>("start_benchmark", { config });

export const startQualityBenchmark = (config: QualityBenchmarkConfig) =>
  invoke<BenchmarkRun>("start_quality_benchmark", { config });

export const cancelBenchmark = () => invoke("cancel_benchmark");

export const getBenchmarkRuns = () =>
  invoke<BenchmarkRunSummary[]>("get_benchmark_runs");

export const getBenchmarkRun = (id: string) =>
  invoke<BenchmarkRun>("get_benchmark_run", { id });

export const deleteBenchmarkRun = (id: string) =>
  invoke("delete_benchmark_run", { id });

export const getRunsForComparison = (ids: string[]) =>
  invoke<BenchmarkRun[]>("get_runs_for_comparison", { ids });

export const getSystemInfo = () => invoke<SystemInfo>("get_system_info");

export const exportJson = (runId: string) =>
  invoke<string>("export_json", { runId });

export const exportAllRuns = () => invoke<string>("export_all_runs");

export interface ImportResult {
  added: number;
  skipped: number;
}

export const importRuns = (jsonStr: string) =>
  invoke<ImportResult>("import_runs", { jsonStr });

export const revealInFileManager = (path: string) =>
  invoke("reveal_in_file_manager", { path });

export const getEncodeRetention = () => invoke<number>("get_encode_retention");

export const setEncodeRetention = (days: number) =>
  invoke("set_encode_retention", { days });

export const rerunQualityMetrics = (
  runId: string,
  metrics: QualityMetricsConfig,
  sourceOverride?: string,
) => invoke<BenchmarkRun>("rerun_quality_metrics", { runId, metrics, sourceOverride: sourceOverride ?? null });
