import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getBenchmarkRun, exportJson, revealInFileManager, rerunQualityMetrics } from "../lib/tauri";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import type { BenchmarkRun, QualityMetricsConfig } from "../types";
import {
  formatDuration,
  formatFileSize,
  formatFps,
  formatDate,
} from "../utils/format";
import { PRESET_COLORS } from "../utils/colors";

function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [run, setRun] = useState<BenchmarkRun | null>(
    (location.state as { run?: BenchmarkRun })?.run ?? null,
  );
  const [loading, setLoading] = useState(!run);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [rerunRunning, setRerunRunning] = useState(false);
  const [rerunMetrics, setRerunMetrics] = useState<QualityMetricsConfig>({
    ssim: true, psnr: true, vmaf: true, xpsnr: false, ssimu2: false,
  });
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!run && id) {
      getBenchmarkRun(id)
        .then(setRun)
        .finally(() => setLoading(false));
    }
  }, [id, run]);

  const handleExportJson = async () => {
    if (!run) return;
    try {
      const json = await exportJson(run.id);
      const path = await save({
        defaultPath: `codecbench_${run.id.slice(0, 8)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path) {
        await writeTextFile(path, json);
      }
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  const handleExportPng = async () => {
    if (!resultsRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(resultsRef.current, {
        backgroundColor: "#0f172a",
        scale: 2,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;

      const path = await save({
        defaultPath: `codecbench_${run!.id.slice(0, 8)}.png`,
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      });
      if (path) {
        const arrayBuffer = await blob.arrayBuffer();
        await writeFile(path, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      console.error("PNG export failed:", e);
    }
  };

  const handleExportPdf = async () => {
    if (!resultsRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");
      const canvas = await html2canvas(resultsRef.current, {
        backgroundColor: "#0f172a",
        scale: 2,
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // A4 landscape for wide charts
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? "landscape" : "portrait",
        unit: "px",
        format: [imgWidth / 2, imgHeight / 2],
      });
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth / 2, imgHeight / 2);

      const blob = pdf.output("blob");
      const path = await save({
        defaultPath: `codecbench_${run!.id.slice(0, 8)}.pdf`,
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
      });
      if (path) {
        const arrayBuffer = await blob.arrayBuffer();
        await writeFile(path, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      console.error("PDF export failed:", e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        Loading results...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-surface-400 text-center py-20">
        Benchmark run not found
      </div>
    );
  }

  const handleRerun = async () => {
    if (!run) return;
    setRerunRunning(true);
    try {
      const updated = await rerunQualityMetrics(run.id, rerunMetrics);
      setRun(updated);
      setRerunOpen(false);
    } catch (e) {
      console.error("Rerun failed:", e);
      alert(`Rerun failed: ${e}`);
    } finally {
      setRerunRunning(false);
    }
  };

  // Build chart data: group by encoder, bars for each preset
  const encoderNames = [
    ...new Set(run.results.map((r) => r.encoder.display_name)),
  ];

  const speedData = encoderNames.map((name) => {
    const entry: Record<string, string | number> = { name };
    for (const preset of ["Fast", "Medium", "High"]) {
      const result = run.results.find(
        (r) =>
          r.encoder.display_name === name && r.preset === preset,
      );
      if (result) entry[preset] = parseFloat(result.encoding_fps.toFixed(1));
    }
    return entry;
  });

  const timeData = encoderNames.map((name) => {
    const entry: Record<string, string | number> = { name };
    for (const preset of ["Fast", "Medium", "High"]) {
      const result = run.results.find(
        (r) =>
          r.encoder.display_name === name && r.preset === preset,
      );
      if (result)
        entry[preset] = parseFloat((result.encoding_time_ms / 1000).toFixed(2));
    }
    return entry;
  });

  const sizeData = encoderNames.map((name) => {
    const entry: Record<string, string | number> = { name };
    for (const preset of ["Fast", "Medium", "High"]) {
      const result = run.results.find(
        (r) =>
          r.encoder.display_name === name && r.preset === preset,
      );
      if (result)
        entry[preset] = parseFloat(
          (result.output_size_bytes / 1024 / 1024).toFixed(2),
        );
    }
    return entry;
  });

  const hasQuality = run.results.some(
    (r) => r.vmaf != null || r.ssim != null || r.psnr != null || r.xpsnr != null || r.ssimu2 != null,
  );
  const presets = [...new Set(run.results.map((r) => r.preset))];

  return (
    <div className="space-y-6" ref={resultsRef}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Results</h2>
          <p className="text-surface-400 mt-1 text-sm">
            {formatDate(run.timestamp)} &middot; {run.system_info.cpu_name}
          </p>
          <p className="text-surface-500 text-xs mt-0.5">
            {run.ffmpeg_version}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-xs transition-colors"
          >
            JSON
          </button>
          <button
            onClick={handleExportPng}
            className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-xs transition-colors"
          >
            PNG
          </button>
          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-xs transition-colors"
          >
            PDF
          </button>
          {run.output_dir && (
            <>
              <button
                onClick={() => setRerunOpen(true)}
                className="px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/50 rounded-lg text-xs text-amber-400 transition-colors"
              >
                Rerun Metrics
              </button>
              <button
                onClick={() => navigate(`/video-compare/${run.id}`)}
                className="px-3 py-1.5 bg-violet-900/30 hover:bg-violet-900/50 border border-violet-700/50 rounded-lg text-xs text-violet-400 transition-colors"
              >
                Video Compare
              </button>
              <button
                onClick={() => revealInFileManager(run.output_dir!)}
                className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/50 rounded-lg text-xs text-emerald-400 transition-colors"
              >
                Open Encodes
              </button>
            </>
          )}
        </div>
      </div>

      {/* Source Info */}
      {run.source_file && (
        <div className="bg-surface-900 rounded-xl border border-surface-700 p-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-surface-400">Source: </span>
            <span className="text-white">{run.source_file}</span>
            <span className="text-surface-500 ml-2">
              {run.source_resolution.label} &middot; {run.source_duration_sec}s
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-900/30 text-amber-400">
            Quality
          </span>
          {run.crf != null && (
            <span className="text-xs text-surface-400">CRF {run.crf}</span>
          )}
        </div>
      )}

      {/* System Info */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-4">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-surface-400">CPU</span>
            <p className="text-white text-xs mt-0.5">
              {run.system_info.cpu_name}
            </p>
          </div>
          <div>
            <span className="text-surface-400">Cores</span>
            <p className="text-white text-xs mt-0.5">
              {run.system_info.cpu_cores}C / {run.system_info.cpu_threads}T
            </p>
          </div>
          <div>
            <span className="text-surface-400">RAM</span>
            <p className="text-white text-xs mt-0.5">
              {run.system_info.ram_gb.toFixed(1)} GB
            </p>
          </div>
          <div>
            <span className="text-surface-400">OS</span>
            <p className="text-white text-xs mt-0.5">
              {run.system_info.os} {run.system_info.os_version}
            </p>
          </div>
        </div>
      </div>

      {/* Encoding Speed Chart */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 mb-4">
          Encoding Speed (fps)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={speedData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
              }}
            />
            <Legend />
            {presets.map((preset) => (
              <Bar
                key={preset}
                dataKey={preset}
                fill={PRESET_COLORS[preset]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Encoding Time Chart */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 mb-4">
          Encoding Time (seconds)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={timeData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
              }}
            />
            <Legend />
            {presets.map((preset) => (
              <Bar
                key={preset}
                dataKey={preset}
                fill={PRESET_COLORS[preset]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Output Size Chart */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 mb-4">
          Output Size (MB)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sizeData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
              }}
            />
            <Legend />
            {presets.map((preset) => (
              <Bar
                key={preset}
                dataKey={preset}
                fill={PRESET_COLORS[preset]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quality Metrics Chart */}
      {hasQuality && (() => {
        const hasSSIM = run.results.some((r) => r.ssim != null);
        const hasPSNR = run.results.some((r) => r.psnr != null);
        const hasVMAF = run.results.some((r) => r.vmaf != null);
        const hasXPSNR = run.results.some((r) => r.xpsnr != null);
        const hasSsimu2 = run.results.some((r) => r.ssimu2 != null);

        const vmafData = hasVMAF ? encoderNames.map((name) => {
          const entry: Record<string, string | number> = { name };
          for (const preset of ["Fast", "Medium", "High"]) {
            const result = run.results.find(
              (r) => r.encoder.display_name === name && r.preset === preset,
            );
            if (result?.vmaf != null) entry[preset] = parseFloat(result.vmaf.toFixed(1));
          }
          return entry;
        }) : [];

        return (
          <>
            {hasVMAF && (
              <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
                <h3 className="text-sm font-semibold text-surface-300 mb-4">
                  VMAF Score (0-100)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={vmafData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#475569" }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#475569" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }} />
                    <Legend />
                    {presets.map((preset) => (
                      <Bar key={preset} dataKey={preset} fill={PRESET_COLORS[preset]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {(hasSSIM || hasPSNR || hasXPSNR || hasSsimu2) && (
              <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
                <h3 className="text-sm font-semibold text-surface-300 mb-4">
                  Quality Metrics
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700">
                        <th className="text-left p-2 text-surface-400 font-medium">Encoder</th>
                        <th className="text-left p-2 text-surface-400 font-medium">Preset</th>
                        {hasSSIM && <th className="text-right p-2 text-surface-400 font-medium">SSIM</th>}
                        {hasPSNR && <th className="text-right p-2 text-surface-400 font-medium">PSNR (dB)</th>}
                        {hasVMAF && <th className="text-right p-2 text-surface-400 font-medium">VMAF</th>}
                        {hasXPSNR && <th className="text-right p-2 text-surface-400 font-medium">XPSNR (dB)</th>}
                        {hasSsimu2 && <th className="text-right p-2 text-surface-400 font-medium">SSIMULACRA2</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {run.results.filter((r) => r.ssim != null || r.psnr != null || r.vmaf != null || r.xpsnr != null || r.ssimu2 != null).map((r) => (
                        <tr key={r.id} className="border-b border-surface-800">
                          <td className="p-2 text-white">{r.encoder.display_name}</td>
                          <td className="p-2 text-surface-300">{r.preset}</td>
                          {hasSSIM && <td className="p-2 text-right text-surface-200">{r.ssim != null ? (r.ssim * 100).toFixed(2) + "%" : "—"}</td>}
                          {hasPSNR && <td className="p-2 text-right text-surface-200">{r.psnr?.toFixed(1) ?? "—"}</td>}
                          {hasVMAF && <td className="p-2 text-right text-surface-200">{r.vmaf?.toFixed(1) ?? "—"}</td>}
                          {hasXPSNR && <td className="p-2 text-right text-surface-200">{r.xpsnr?.toFixed(2) ?? "—"}</td>}
                          {hasSsimu2 && <td className="p-2 text-right text-surface-200">{r.ssimu2?.toFixed(2) ?? "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Results Table */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left p-3 text-surface-400 font-medium">
                  Encoder
                </th>
                <th className="text-left p-3 text-surface-400 font-medium">
                  Preset
                </th>
                <th className="text-right p-3 text-surface-400 font-medium">
                  Time
                </th>
                <th className="text-right p-3 text-surface-400 font-medium">
                  FPS
                </th>
                <th className="text-right p-3 text-surface-400 font-medium">
                  Size
                </th>
                {hasQuality && (() => {
                  const hasVMAFCol = run.results.some((r) => r.vmaf != null);
                  const hasSSIMCol = run.results.some((r) => r.ssim != null);
                  const hasPSNRCol = run.results.some((r) => r.psnr != null);
                  const hasXPSNRCol = run.results.some((r) => r.xpsnr != null);
                  const hasSsimu2Col = run.results.some((r) => r.ssimu2 != null);
                  return (
                    <>
                      {hasVMAFCol && <th className="text-right p-3 text-surface-400 font-medium">VMAF</th>}
                      {hasSSIMCol && <th className="text-right p-3 text-surface-400 font-medium">SSIM</th>}
                      {hasPSNRCol && <th className="text-right p-3 text-surface-400 font-medium">PSNR</th>}
                      {hasXPSNRCol && <th className="text-right p-3 text-surface-400 font-medium">XPSNR</th>}
                      {hasSsimu2Col && <th className="text-right p-3 text-surface-400 font-medium">SSIMULACRA2</th>}
                    </>
                  );
                })()}
                {run.output_dir && (
                  <th className="text-right p-3 text-surface-400 font-medium">
                    File
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {run.results.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-surface-800 hover:bg-surface-800/50"
                >
                  <td className="p-3">
                    <span className="text-white">{r.encoder.display_name}</span>
                    <p className="text-xs font-mono text-surface-500 mt-0.5 whitespace-nowrap">
                      {r.ffmpeg_args}
                    </p>
                  </td>
                  <td className="p-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${PRESET_COLORS[r.preset]}20`,
                        color: PRESET_COLORS[r.preset],
                      }}
                    >
                      {r.preset}
                    </span>
                  </td>
                  <td className="p-3 text-right text-surface-200">
                    {formatDuration(r.encoding_time_ms)}
                  </td>
                  <td className="p-3 text-right text-surface-200">
                    {formatFps(r.encoding_fps)}
                  </td>
                  <td className="p-3 text-right text-surface-200">
                    {formatFileSize(r.output_size_bytes)}
                  </td>
                  {hasQuality && (() => {
                    const hasVMAFCol = run.results.some((x) => x.vmaf != null);
                    const hasSSIMCol = run.results.some((x) => x.ssim != null);
                    const hasPSNRCol = run.results.some((x) => x.psnr != null);
                    const hasXPSNRCol = run.results.some((x) => x.xpsnr != null);
                    const hasSsimu2Col = run.results.some((x) => x.ssimu2 != null);
                    return (
                      <>
                        {hasVMAFCol && <td className="p-3 text-right text-surface-200">{r.vmaf?.toFixed(1) ?? "—"}</td>}
                        {hasSSIMCol && <td className="p-3 text-right text-surface-200">{r.ssim?.toFixed(4) ?? "—"}</td>}
                        {hasPSNRCol && <td className="p-3 text-right text-surface-200">{r.psnr?.toFixed(1) ?? "—"}</td>}
                        {hasXPSNRCol && <td className="p-3 text-right text-surface-200">{r.xpsnr?.toFixed(2) ?? "—"}</td>}
                        {hasSsimu2Col && <td className="p-3 text-right text-surface-200">{r.ssimu2?.toFixed(2) ?? "—"}</td>}
                      </>
                    );
                  })()}
                  {r.output_file && (
                    <td className="p-3 text-right">
                      <button
                        onClick={() => revealInFileManager(r.output_file!)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Reveal
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Rerun Metrics Modal */}
      {rerunOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-900 border border-surface-700 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Rerun Quality Metrics</h3>
            <p className="text-sm text-surface-400 mb-4">
              Re-measure quality metrics on the existing encoded files. Does not re-encode.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {(
                [
                  { key: "ssim", label: "SSIM" },
                  { key: "psnr", label: "PSNR" },
                  { key: "vmaf", label: "VMAF" },
                  { key: "xpsnr", label: "XPSNR" },
                  { key: "ssimu2", label: "SSIMULACRA2" },
                ] as { key: keyof QualityMetricsConfig; label: string }[]
              ).map(({ key, label }) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    rerunMetrics[key]
                      ? "bg-blue-600/10 border border-blue-500/30"
                      : "bg-surface-800 border border-surface-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={rerunMetrics[key]}
                    onChange={() => setRerunMetrics((p) => ({ ...p, [key]: !p[key] }))}
                    className="rounded border-surface-600"
                  />
                  <span className="text-sm text-white">{label}</span>
                </label>
              ))}
            </div>
            {!run.source_full_path && (
              <p className="text-xs text-amber-400 mb-3">
                Source path not available (older run). Rerun may fail if source has moved.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRerunOpen(false)}
                disabled={rerunRunning}
                className="px-4 py-2 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRerun}
                disabled={rerunRunning || !Object.values(rerunMetrics).some(Boolean)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-surface-700 disabled:text-surface-500 rounded-lg text-sm text-white font-medium transition-colors"
              >
                {rerunRunning ? "Running..." : "Run Metrics"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultsPage;
