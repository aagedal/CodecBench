import { invoke } from "@tauri-apps/api/core";
import type {
  BenchmarkConfig,
  BenchmarkRun,
  BenchmarkRunSummary,
  EncoderDef,
  FfmpegInfo,
  SystemInfo,
} from "../types";

export const detectFfmpeg = () => invoke<FfmpegInfo>("detect_ffmpeg");

export const setFfmpegPath = (path: string) =>
  invoke<FfmpegInfo>("set_ffmpeg_path", { path });

export const getAvailableEncoders = () =>
  invoke<EncoderDef[]>("get_available_encoders");

export const startBenchmark = (config: BenchmarkConfig) =>
  invoke<BenchmarkRun>("start_benchmark", { config });

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
