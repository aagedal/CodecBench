import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import {
  startBenchmark,
  startQualityBenchmark,
  cancelBenchmark as cancelBenchmarkApi,
} from "../lib/tauri";
import { onBenchmarkProgress } from "../lib/events";
import type {
  BenchmarkConfig,
  QualityBenchmarkConfig,
  BenchmarkProgress,
  BenchmarkRun,
} from "../types";

type BenchmarkState =
  | { status: "idle" }
  | { status: "running"; isQualityMode: boolean }
  | { status: "complete"; run: BenchmarkRun }
  | { status: "error"; error: string; isQualityMode: boolean };

interface BenchmarkContextValue {
  state: BenchmarkState;
  progress: BenchmarkProgress | null;
  elapsed: number;
  startSpeed: (config: BenchmarkConfig) => void;
  startQuality: (config: QualityBenchmarkConfig) => void;
  cancel: () => void;
  reset: () => void;
}

const BenchmarkContext = createContext<BenchmarkContextValue | null>(null);

export function BenchmarkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BenchmarkState>({ status: "idle" });
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTimeRef = useRef(0);
  const unlistenRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = undefined;
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
  }, []);

  const beginRun = useCallback(
    async (
      isQuality: boolean,
      runFn: () => Promise<BenchmarkRun>,
    ) => {
      cleanup();
      setProgress(null);
      setElapsed(0);
      setState({ status: "running", isQualityMode: isQuality });

      const unlisten = await onBenchmarkProgress((p) => {
        setProgress(p);
      });
      unlistenRef.current = unlisten;

      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 100);

      try {
        const run = await runFn();
        cleanup();
        setState({ status: "complete", run });
      } catch (e) {
        cleanup();
        setState({
          status: "error",
          error: String(e),
          isQualityMode: isQuality,
        });
      }
    },
    [cleanup],
  );

  const startSpeed = useCallback(
    (config: BenchmarkConfig) => {
      beginRun(false, () => startBenchmark(config));
    },
    [beginRun],
  );

  const startQuality = useCallback(
    (config: QualityBenchmarkConfig) => {
      beginRun(true, () => startQualityBenchmark(config));
    },
    [beginRun],
  );

  const cancel = useCallback(async () => {
    try {
      await cancelBenchmarkApi();
    } catch {
      // ignore
    }
    cleanup();
    setState({ status: "idle" });
    setProgress(null);
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setState({ status: "idle" });
    setProgress(null);
    setElapsed(0);
  }, [cleanup]);

  return (
    <BenchmarkContext.Provider
      value={{ state, progress, elapsed, startSpeed, startQuality, cancel, reset }}
    >
      {children}
    </BenchmarkContext.Provider>
  );
}

export function useBenchmark() {
  const ctx = useContext(BenchmarkContext);
  if (!ctx) throw new Error("useBenchmark must be used within BenchmarkProvider");
  return ctx;
}
