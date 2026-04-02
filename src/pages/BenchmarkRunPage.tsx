import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { startBenchmark, cancelBenchmark } from "../lib/tauri";
import { onBenchmarkProgress } from "../lib/events";
import type { BenchmarkConfig, BenchmarkProgress, BenchmarkRun } from "../types";
import { formatDuration, formatFps } from "../utils/format";

function BenchmarkRunPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const config = (location.state as { config: BenchmarkConfig })?.config;

  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!config) {
      navigate("/benchmark", { replace: true });
      return;
    }

    let cancelled = false;

    const run = async () => {
      const unlisten = await onBenchmarkProgress((p) => {
        if (!cancelled) setProgress(p);
      });

      startTime.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime.current);
      }, 100);

      try {
        const result: BenchmarkRun = await startBenchmark(config);
        clearInterval(timerRef.current);
        navigate(`/results/${result.id}`, { state: { run: result } });
      } catch (e) {
        clearInterval(timerRef.current);
        if (!cancelled) {
          setError(String(e));
        }
      } finally {
        unlisten();
      }
    };

    run();

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [config, navigate]);

  const handleCancel = async () => {
    try {
      await cancelBenchmark();
    } catch {
      // Ignore cancel errors
    }
    navigate("/benchmark", { replace: true });
  };

  const progressPercent = progress
    ? (progress.step / progress.total_steps) * 100
    : 0;

  const phaseLabel = progress
    ? progress.phase === "generating_source"
      ? "Generating test source..."
      : progress.phase === "encoding"
        ? "Encoding..."
        : progress.phase === "measuring_quality"
          ? "Measuring quality..."
          : "Complete"
    : "Initializing...";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Running Benchmark</h2>
        <p className="text-surface-400 mt-1">
          {formatDuration(elapsed)} elapsed
        </p>
      </div>

      {error ? (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-5">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => navigate("/benchmark")}
            className="mt-3 px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm transition-colors"
          >
            Back to Config
          </button>
        </div>
      ) : (
        <>
          {/* Progress Bar */}
          <div className="bg-surface-900 rounded-xl border border-surface-700 p-5 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-surface-300">{phaseLabel}</span>
              {progress && (
                <span className="text-surface-400">
                  {progress.step} / {progress.total_steps}
                </span>
              )}
            </div>
            <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Current Job */}
          {progress && progress.phase === "encoding" && (
            <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-surface-400">Encoder</p>
                  <p className="text-sm text-white font-medium mt-1">
                    {progress.current_encoder}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Preset</p>
                  <p className="text-sm text-white font-medium mt-1">
                    {progress.current_preset}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Resolution</p>
                  <p className="text-sm text-white font-medium mt-1">
                    {progress.current_resolution}
                  </p>
                </div>
              </div>
              {progress.encoding_fps != null && progress.encoding_fps > 0 && (
                <div className="mt-4 text-center">
                  <p className="text-3xl font-bold text-blue-400">
                    {formatFps(progress.encoding_fps)}
                  </p>
                  <p className="text-xs text-surface-400 mt-1">fps</p>
                </div>
              )}
            </div>
          )}

          {/* Cancel */}
          <button
            onClick={handleCancel}
            className="w-full py-3 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-xl text-surface-300 text-sm transition-colors"
          >
            Cancel Benchmark
          </button>
        </>
      )}
    </div>
  );
}

export default BenchmarkRunPage;
