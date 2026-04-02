import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { getRunsForComparison } from "../lib/tauri";
import type { BenchmarkRun } from "../types";
import { getColorForIndex } from "../utils/colors";

function ComparePage() {
  const [searchParams] = useSearchParams();
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    getRunsForComparison(ids)
      .then(setRuns)
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        Loading comparison...
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-surface-400 text-center py-20">
        No runs to compare. Select runs from the History page.
      </div>
    );
  }

  // Build comparison data: group by encoder+preset, bars for each system
  const runLabels = runs.map(
    (r) => `${r.system_info.cpu_name.split(" ").slice(0, 3).join(" ")}`,
  );

  // Get all unique encoder+preset combos
  const jobKeys = new Set<string>();
  for (const run of runs) {
    for (const result of run.results) {
      jobKeys.add(`${result.encoder.display_name} (${result.preset})`);
    }
  }

  const speedData = Array.from(jobKeys).map((key) => {
    const entry: Record<string, string | number> = { name: key };
    runs.forEach((run, i) => {
      const result = run.results.find(
        (r) => `${r.encoder.display_name} (${r.preset})` === key,
      );
      if (result) entry[runLabels[i]] = parseFloat(result.encoding_fps.toFixed(1));
    });
    return entry;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Compare</h2>
        <p className="text-surface-400 mt-1">
          Comparing {runs.length} benchmark runs
        </p>
      </div>

      {/* Legend */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-4">
        <div className="flex flex-wrap gap-4">
          {runs.map((run, i) => (
            <div key={run.id} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: getColorForIndex(i) }}
              />
              <div className="text-xs">
                <p className="text-white">{run.system_info.cpu_name}</p>
                <p className="text-surface-400">
                  {run.system_info.os} {run.system_info.os_version}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Speed Comparison */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 mb-4">
          Encoding Speed (fps)
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={speedData} barCategoryGap="15%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={{ stroke: "#475569" }}
              angle={-20}
              textAnchor="end"
              height={80}
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
            {runLabels.map((label, i) => (
              <Bar
                key={label}
                dataKey={label}
                fill={getColorForIndex(i)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ComparePage;
