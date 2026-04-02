import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBenchmarkRuns, deleteBenchmarkRun } from "../lib/tauri";
import type { BenchmarkRunSummary } from "../types";
import { formatDate } from "../utils/format";

function HistoryPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<BenchmarkRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadRuns = async () => {
    try {
      const data = await getBenchmarkRuns();
      setRuns(data);
    } catch (e) {
      console.error("Failed to load runs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBenchmarkRun(id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleCompare = () => {
    const ids = Array.from(selectedIds);
    navigate(`/compare?ids=${ids.join(",")}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        Loading history...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">History</h2>
          <p className="text-surface-400 mt-1">
            {runs.length} saved benchmark run{runs.length !== 1 ? "s" : ""}
          </p>
        </div>
        {selectedIds.size >= 2 && (
          <button
            onClick={handleCompare}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors"
          >
            Compare Selected ({selectedIds.size})
          </button>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-surface-400">No benchmark runs yet</p>
          <button
            onClick={() => navigate("/benchmark")}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors"
          >
            Run First Benchmark
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              className={`bg-surface-900 rounded-xl border p-4 flex items-center gap-4 transition-colors cursor-pointer ${
                selectedIds.has(run.id)
                  ? "border-blue-500/50 bg-blue-600/5"
                  : "border-surface-700 hover:border-surface-600"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(run.id)}
                onChange={() => toggleSelect(run.id)}
                className="shrink-0"
              />
              <div
                className="flex-1 min-w-0"
                onClick={() => navigate(`/results/${run.id}`)}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">
                    {run.cpu_name}
                  </p>
                  <span className="text-xs text-surface-500">
                    {run.os}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                  <span>{formatDate(run.timestamp)}</span>
                  <span>{run.result_count} results</span>
                  <span>{run.resolutions.join(", ")}</span>
                </div>
                <p className="text-xs text-surface-500 mt-0.5 truncate">
                  {run.ffmpeg_version}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(run.id);
                }}
                className="text-surface-500 hover:text-red-400 text-xs px-2 py-1 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
