import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getBenchmarkRuns, deleteBenchmarkRun, exportAllRuns, importRuns } from "../lib/tauri";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { BenchmarkRunSummary } from "../types";
import { formatDate } from "../utils/format";

type ModeFilter = "all" | "speed" | "quality";

function HistoryPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<BenchmarkRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [notification, setNotification] = useState<{ ok: boolean; msg: string } | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");

  const showNotification = (ok: boolean, msg: string) => {
    clearTimeout(notificationTimer.current);
    setNotification({ ok, msg });
    if (ok) notificationTimer.current = setTimeout(() => setNotification(null), 4000);
  };

  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return runs.filter((run) => {
      if (modeFilter !== "all" && run.benchmark_mode !== modeFilter) return false;
      if (q) {
        const inCpu = run.cpu_name.toLowerCase().includes(q);
        const inSource = run.source_file?.toLowerCase().includes(q) ?? false;
        if (!inCpu && !inSource) return false;
      }
      return true;
    });
  }, [runs, searchQuery, modeFilter]);

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
      showNotification(false, "Delete failed.");
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    let failed = 0;
    for (const id of ids) {
      try {
        await deleteBenchmarkRun(id);
        setRuns((prev) => prev.filter((r) => r.id !== id));
      } catch {
        failed++;
      }
    }
    setSelectedIds(new Set());
    setPendingBulkDelete(false);
    if (failed === 0) {
      showNotification(true, `Deleted ${ids.length} run${ids.length !== 1 ? "s" : ""}.`);
    } else {
      showNotification(false, `Deleted ${ids.length - failed} of ${ids.length} runs. ${failed} failed.`);
    }
  };

  const handleCompare = () => {
    const ids = Array.from(selectedIds);
    navigate(`/compare?ids=${ids.join(",")}`);
  };

  const handleExportAll = async () => {
    try {
      const json = await exportAllRuns();
      const path = await save({
        defaultPath: "codecbench_export.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path) {
        await writeTextFile(path, json);
        showNotification(true, `Exported ${runs.length} run${runs.length !== 1 ? "s" : ""}.`);
      }
    } catch (e) {
      console.error("Export failed:", e);
      showNotification(false, "Export failed.");
    }
  };

  const handleImport = async () => {
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (!path) return;
      const json = await readTextFile(path as string);
      const result = await importRuns(json);
      await loadRuns();
      showNotification(true, `Import complete: ${result.added} added, ${result.skipped} already existed.`);
    } catch (e) {
      console.error("Import failed:", e);
      showNotification(false, "Import failed. Make sure the file is a valid CodecBench export.");
    }
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
            {filteredRuns.length !== runs.length
              ? `${filteredRuns.length} of ${runs.length} runs`
              : `${runs.length} saved benchmark run${runs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notification && (
            <span className={`text-xs ${notification.ok ? "text-emerald-400" : "text-red-400"}`}>
              {notification.msg}
            </span>
          )}
          <button
            onClick={handleImport}
            className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-xs transition-colors"
          >
            Import
          </button>
          <button
            onClick={handleExportAll}
            className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-xs transition-colors"
          >
            Export All
          </button>
          {selectedIds.size >= 1 && (
            pendingBulkDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-surface-400">Delete {selectedIds.size} run{selectedIds.size !== 1 ? "s" : ""}?</span>
                <button
                  onClick={handleBulkDelete}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setPendingBulkDelete(false)}
                  className="text-xs text-surface-500 hover:text-surface-300 px-2 py-1 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPendingBulkDelete(true)}
                className="px-3 py-1.5 bg-surface-800 hover:bg-red-900/40 border border-surface-600 hover:border-red-700/50 rounded-lg text-xs text-surface-400 hover:text-red-400 transition-colors"
              >
                Delete Selected ({selectedIds.size})
              </button>
            )
          )}
          {selectedIds.size >= 2 && !pendingBulkDelete && (
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors"
            >
              Compare Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {runs.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by CPU or source file…"
            className="flex-1 px-3 py-1.5 bg-surface-900 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-surface-500"
          />
          <div className="flex rounded-lg overflow-hidden border border-surface-700">
            {(["all", "speed", "quality"] as ModeFilter[]).map((m) => (
              <button
                key={m}
                onClick={() => setModeFilter(m)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                  modeFilter === m
                    ? "bg-surface-700 text-white"
                    : "bg-surface-900 text-surface-400 hover:bg-surface-800"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

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
      ) : filteredRuns.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-surface-400">No runs match your search</p>
          <button
            onClick={() => { setSearchQuery(""); setModeFilter("all"); }}
            className="mt-3 text-xs text-surface-500 hover:text-surface-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRuns.map((run) => (
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
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      run.benchmark_mode === "quality"
                        ? "bg-amber-900/30 text-amber-400"
                        : "bg-blue-900/30 text-blue-400"
                    }`}
                  >
                    {run.benchmark_mode === "quality" ? "Quality" : "Speed"}
                  </span>
                  <span className="text-xs text-surface-500">
                    {run.os}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                  <span>{formatDate(run.timestamp)}</span>
                  <span>{run.result_count} results</span>
                  <span>{run.resolutions.join(", ")}</span>
                  {run.source_file && (
                    <span className="text-surface-500">{run.source_file}</span>
                  )}
                </div>
                <p className="text-xs text-surface-500 mt-0.5 truncate">
                  {run.ffmpeg_version}
                </p>
              </div>
              {pendingDeleteId === run.id ? (
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-surface-400">Delete?</span>
                  <button
                    onClick={() => handleDelete(run.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setPendingDeleteId(null)}
                    className="text-xs text-surface-500 hover:text-surface-300 px-2 py-1 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteId(run.id);
                  }}
                  className="text-surface-500 hover:text-red-400 text-xs px-2 py-1 transition-colors shrink-0"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
