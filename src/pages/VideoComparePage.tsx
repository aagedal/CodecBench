import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getBenchmarkRun } from "../lib/tauri";
import type { BenchmarkRun, BenchmarkResult } from "../types";
import { formatFileSize } from "../utils/format";
import { PRESET_COLORS } from "../utils/colors";

const BROWSER_SUPPORTED_EXTS = new Set(["mp4", "mov", "webm", "m4v"]);

function isPlayable(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return BROWSER_SUPPORTED_EXTS.has(ext);
}

function VideoCard({
  result,
  selected,
  slot,
  onClick,
}: {
  result: BenchmarkResult;
  selected: boolean;
  slot: number | null;
  onClick: () => void;
}) {
  const videoSrc = result.output_file ? convertFileSrc(result.output_file) : null;
  const playable = result.output_file ? isPlayable(result.output_file) : false;

  return (
    <div
      onClick={playable ? onClick : undefined}
      className={`bg-surface-900 rounded-xl border p-3 transition-colors ${
        !playable
          ? "border-surface-700 opacity-60 cursor-not-allowed"
          : selected
          ? "border-blue-500/70 bg-blue-600/5 cursor-pointer"
          : "border-surface-700 hover:border-surface-500 cursor-pointer"
      }`}
    >
      {slot !== null && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
            Slot {slot + 1}
          </span>
        </div>
      )}
      {videoSrc && playable ? (
        <video
          src={videoSrc}
          className="w-full rounded aspect-video bg-black object-contain"
          controls
          preload="metadata"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="w-full aspect-video bg-surface-800 rounded flex items-center justify-center text-surface-500 text-xs flex-col gap-1">
          {!playable ? (
            <>
              <span className="text-surface-400">Not playable in browser</span>
              <span className="text-surface-600">
                {result.output_file?.split(".").pop()?.toUpperCase()} container not supported
              </span>
              <span className="text-surface-600 text-center px-4">
                Re-run the benchmark to get MP4 output
              </span>
            </>
          ) : (
            <span>File not found</span>
          )}
        </div>
      )}
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            {result.encoder.display_name}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: `${PRESET_COLORS[result.preset]}20`,
              color: PRESET_COLORS[result.preset],
            }}
          >
            {result.preset}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-surface-400">
          <span>{formatFileSize(result.output_size_bytes)}</span>
          {result.vmaf != null && (
            <span>VMAF {result.vmaf.toFixed(1)}</span>
          )}
          {result.ssim != null && (
            <span>SSIM {(result.ssim * 100).toFixed(2)}%</span>
          )}
          {result.psnr != null && (
            <span>PSNR {result.psnr.toFixed(1)} dB</span>
          )}
          {result.xpsnr != null && (
            <span>XPSNR {result.xpsnr.toFixed(2)} dB</span>
          )}
          {result.ssimu2 != null && (
            <span>SSIMULACRA2 {result.ssimu2.toFixed(2)}</span>
          )}
        </div>
        <p className="mt-1 text-xs font-mono text-surface-600 truncate" title={result.ffmpeg_args}>
          {result.ffmpeg_args}
        </p>
      </div>
    </div>
  );
}

function SideBySidePlayer({
  slots,
  run,
}: {
  slots: [BenchmarkResult | null, BenchmarkResult | null];
  run: BenchmarkRun;
}) {
  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [synced, setSynced] = useState(false);
  const syncingRef = useRef(false);

  const syncPlayback = (sourceIdx: number, event: "play" | "pause" | "seek", time?: number) => {
    if (!synced || syncingRef.current) return;
    syncingRef.current = true;
    const otherIdx = sourceIdx === 0 ? 1 : 0;
    const other = videoRefs[otherIdx].current;
    if (!other) { syncingRef.current = false; return; }
    if (event === "play") other.play().catch(() => {});
    else if (event === "pause") other.pause();
    else if (event === "seek" && time !== undefined) other.currentTime = time;
    syncingRef.current = false;
  };

  return (
    <div className="bg-surface-900 rounded-xl border border-surface-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-surface-300">Side-by-Side</h3>
        <label className="flex items-center gap-2 text-xs text-surface-400 cursor-pointer">
          <input
            type="checkbox"
            checked={synced}
            onChange={(e) => setSynced(e.target.checked)}
            className="rounded"
          />
          Sync playback
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {slots.map((result, i) => (
          <div key={i}>
            {result ? (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                    Slot {i + 1}
                  </span>
                  <span className="text-sm text-white">{result.encoder.display_name}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: `${PRESET_COLORS[result.preset]}20`,
                      color: PRESET_COLORS[result.preset],
                    }}
                  >
                    {result.preset}
                  </span>
                </div>
                <video
                  ref={videoRefs[i]}
                  src={result.output_file ? convertFileSrc(result.output_file) : undefined}
                  className="w-full rounded aspect-video bg-black object-contain"
                  controls
                  preload="auto"
                  onPlay={() => syncPlayback(i, "play")}
                  onPause={() => syncPlayback(i, "pause")}
                  onSeeked={() => syncPlayback(i, "seek", videoRefs[i].current?.currentTime)}
                />
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-surface-400">
                  <span>{formatFileSize(result.output_size_bytes)}</span>
                  {result.vmaf != null && <span>VMAF {result.vmaf.toFixed(1)}</span>}
                  {result.ssim != null && <span>SSIM {(result.ssim * 100).toFixed(2)}%</span>}
                  {result.psnr != null && <span>PSNR {result.psnr.toFixed(1)} dB</span>}
                  {result.xpsnr != null && <span>XPSNR {result.xpsnr.toFixed(2)} dB</span>}
                  {result.ssimu2 != null && <span>SSIMULACRA2 {result.ssimu2.toFixed(2)}</span>}
                </div>
                <p className="mt-0.5 text-xs font-mono text-surface-600" title={result.ffmpeg_args}>
                  {result.ffmpeg_args}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center aspect-video rounded bg-surface-800 border border-dashed border-surface-600 text-surface-500 text-xs flex-col gap-1">
                <span className="text-lg">+</span>
                <span>Click a video below to fill Slot {i + 1}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {run.source_file && (
        <p className="mt-2 text-xs text-surface-500">
          Source: {run.source_file} &middot; {run.source_resolution.label} &middot; {run.source_duration_sec}s
        </p>
      )}
    </div>
  );
}

function VideoComparePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<BenchmarkRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<[BenchmarkResult | null, BenchmarkResult | null]>([null, null]);

  useEffect(() => {
    if (id) {
      getBenchmarkRun(id)
        .then(setRun)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleCardClick = (result: BenchmarkResult) => {
    setSlots((prev) => {
      const slotIdx = prev.findIndex((s) => s?.id === result.id);
      if (slotIdx !== -1) {
        // Deselect
        const next: [BenchmarkResult | null, BenchmarkResult | null] = [...prev] as [BenchmarkResult | null, BenchmarkResult | null];
        next[slotIdx] = null;
        return next;
      }
      // Fill first empty slot
      if (prev[0] === null) return [result, prev[1]];
      if (prev[1] === null) return [prev[0], result];
      // Both slots full — replace slot 1
      return [prev[0], result];
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        Loading...
      </div>
    );
  }

  if (!run || run.benchmark_mode !== "quality") {
    return (
      <div className="text-surface-400 text-center py-20">
        <p>Video comparison is only available for quality benchmark runs.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-sm transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  const resultsWithFiles = run.results.filter((r) => r.output_file);
  const anyUnsupported = resultsWithFiles.some(
    (r) => r.output_file && !isPlayable(r.output_file)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/results/${run.id}`)}
          className="text-surface-400 hover:text-white transition-colors text-sm"
        >
          ← Results
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Video Compare</h2>
          <p className="text-surface-400 text-sm mt-0.5">
            Click videos below to load them into comparison slots
          </p>
        </div>
      </div>

      {anyUnsupported && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-300">
          Some encoded files use the MKV container, which the browser engine cannot play.
          Re-run the quality benchmark to get MP4 output that can be previewed here.
        </div>
      )}

      <SideBySidePlayer slots={slots} run={run} />

      <div>
        <h3 className="text-sm font-semibold text-surface-300 mb-3">
          Encoded Files ({resultsWithFiles.length})
        </h3>
        {resultsWithFiles.length === 0 ? (
          <p className="text-surface-500 text-sm">
            No encoded files found. They may have been deleted.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {resultsWithFiles.map((result) => {
              const slotIdx = slots.findIndex((s) => s?.id === result.id);
              return (
                <VideoCard
                  key={result.id}
                  result={result}
                  selected={slotIdx !== -1}
                  slot={slotIdx !== -1 ? slotIdx : null}
                  onClick={() => handleCardClick(result)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoComparePage;
