import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { BenchmarkProgress } from "../types";

export const onBenchmarkProgress = (
  callback: (progress: BenchmarkProgress) => void,
): Promise<UnlistenFn> => {
  return listen<BenchmarkProgress>("benchmark-progress", (event) => {
    callback(event.payload);
  });
};
