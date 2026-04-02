import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getBenchmarkRuns, getRunsForComparison } from "../lib/tauri";
import type { BenchmarkRun, BenchmarkRunSummary } from "../types";
import { formatDate } from "../utils/format";
import { getColorForIndex } from "../utils/colors";

function TrendsPage() {
  const [summaries, setSummaries] = useState<BenchmarkRunSummary[]>([]);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCpu, setSelectedCpu] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getBenchmarkRuns();
        setSummaries(data);

        // Group by CPU name
        const cpus = [...new Set(data.map((r) => r.cpu_name))];
        if (cpus.length > 0) {
          setSelectedCpu(cpus[0]);
        }
      } catch (e) {
        console.error("Failed to load runs:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load full runs for the selected CPU
  useEffect(() => {
    if (!selectedCpu) return;
    const cpuRuns = summaries
      .filter((s) => s.cpu_name === selectedCpu)
      .map((s) => s.id);

    if (cpuRuns.length === 0) {
      setRuns([]);
      return;
    }

    getRunsForComparison(cpuRuns)
      .then(setRuns)
      .catch(console.error);
  }, [selectedCpu, summaries]);

  const cpuNames = useMemo(
    () => [...new Set(summaries.map((s) => s.cpu_name))],
    [summaries],
  );

  // Build trend data: for each encoder+preset combo, track fps over time
  const { trendData, encoderKeys } = useMemo(() => {
    if (runs.length === 0) return { trendData: [], encoderKeys: [] };

    // Sort runs by timestamp
    const sorted = [...runs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Collect all encoder+preset combos
    const keys = new Set<string>();
    for (const run of sorted) {
      for (const r of run.results) {
        keys.add(`${r.encoder.display_name} (${r.preset})`);
      }
    }
    const encoderKeys = Array.from(keys);

    const trendData = sorted.map((run) => {
      const point: Record<string, string | number> = {
        date: formatDate(run.timestamp),
        ffmpeg: run.ffmpeg_version.replace(/^ffmpeg version /, "").split(" ")[0],
      };
      for (const r of run.results) {
        const key = `${r.encoder.display_name} (${r.preset})`;
        point[key] = parseFloat(r.encoding_fps.toFixed(1));
      }
      return point;
    });

    return { trendData, encoderKeys };
  }, [runs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        Loading trends...
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="text-surface-400 text-center py-20">
        No benchmark data yet. Run some benchmarks first.
      </div>
    );
  }

  const cpuRunCount = summaries.filter(
    (s) => s.cpu_name === selectedCpu,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Trends</h2>
        <p className="text-surface-400 mt-1">
          Performance over time for the same system
        </p>
      </div>

      {/* CPU Selector */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          System
        </h3>
        <div className="flex flex-wrap gap-2">
          {cpuNames.map((cpu) => {
            const count = summaries.filter((s) => s.cpu_name === cpu).length;
            return (
              <button
                key={cpu}
                onClick={() => setSelectedCpu(cpu)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCpu === cpu
                    ? "bg-blue-600 text-white"
                    : "bg-surface-800 text-surface-400 hover:text-surface-200"
                }`}
              >
                {cpu}
                <span className="ml-2 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {cpuRunCount < 2 ? (
        <div className="bg-surface-900 rounded-xl border border-surface-700 p-8 text-center">
          <p className="text-surface-400">
            Need at least 2 benchmark runs on the same system to show trends.
          </p>
          <p className="text-surface-500 text-sm mt-1">
            Currently {cpuRunCount} run{cpuRunCount !== 1 ? "s" : ""} for this
            system.
          </p>
        </div>
      ) : (
        <>
          {/* FPS Trend Chart */}
          <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
            <h3 className="text-sm font-semibold text-surface-300 mb-4">
              Encoding Speed Over Time (fps)
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
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
                    fontSize: "12px",
                  }}
                  labelFormatter={(label, payload) => {
                    const ffmpeg =
                      payload?.[0]?.payload?.ffmpeg ?? "";
                    return `${label}${ffmpeg ? ` — ffmpeg ${ffmpeg}` : ""}`;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                />
                {encoderKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={getColorForIndex(i)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Run Details Table */}
          <div className="bg-surface-900 rounded-xl border border-surface-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left p-3 text-surface-400 font-medium">
                    Date
                  </th>
                  <th className="text-left p-3 text-surface-400 font-medium">
                    FFmpeg Version
                  </th>
                  <th className="text-left p-3 text-surface-400 font-medium">
                    OS
                  </th>
                  <th className="text-right p-3 text-surface-400 font-medium">
                    Encodes
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs
                  .sort(
                    (a, b) =>
                      new Date(b.timestamp).getTime() -
                      new Date(a.timestamp).getTime(),
                  )
                  .map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-surface-800 hover:bg-surface-800/50"
                    >
                      <td className="p-3 text-white">
                        {formatDate(run.timestamp)}
                      </td>
                      <td className="p-3 text-surface-200 font-mono text-xs">
                        {run.ffmpeg_version
                          .replace(/^ffmpeg version /, "")
                          .split(" ")[0]}
                      </td>
                      <td className="p-3 text-surface-200">
                        {run.system_info.os} {run.system_info.os_version}
                      </td>
                      <td className="p-3 text-right text-surface-200">
                        {run.results.length}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default TrendsPage;
