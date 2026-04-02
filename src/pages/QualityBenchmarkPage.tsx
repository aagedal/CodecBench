import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { getAvailableEncoders } from "../lib/tauri";
import type { EncoderDef, QualityPreset, QualityBenchmarkConfig } from "../types";

const PRESETS: QualityPreset[] = ["Fast", "Medium", "High"];

function QualityBenchmarkPage() {
  const navigate = useNavigate();
  const [encoders, setEncoders] = useState<EncoderDef[]>([]);
  const [selectedEncoders, setSelectedEncoders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPresets, setSelectedPresets] = useState<Set<QualityPreset>>(
    new Set(["Fast", "Medium", "High"]),
  );
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const encs = await getAvailableEncoders();
        setEncoders(encs);
        const defaults = new Set(
          encs
            .filter((e) => e.encoder_type === "Software")
            .map((e) => e.name),
        );
        setSelectedEncoders(defaults);
      } catch (e) {
        console.error("Failed to get encoders:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSelectSource = async () => {
    const selected = await open({
      multiple: false,
      title: "Select Source Video",
      filters: [
        {
          name: "Video Files",
          extensions: [
            "mp4", "mkv", "mov", "avi", "webm", "y4m", "mxf", "ts",
            "m4v", "flv", "wmv", "mpg", "mpeg",
          ],
        },
      ],
    });
    if (selected) {
      setSourcePath(selected as string);
    }
  };

  const toggleEncoder = (name: string) => {
    setSelectedEncoders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const togglePreset = (preset: QualityPreset) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(preset)) next.delete(preset);
      else next.add(preset);
      return next;
    });
  };

  const totalJobs = selectedEncoders.size * selectedPresets.size;

  const handleStart = () => {
    if (!sourcePath) return;
    const config: QualityBenchmarkConfig = {
      source_path: sourcePath,
      encoders: encoders.filter((e) => selectedEncoders.has(e.name)),
      presets: PRESETS.filter((p) => selectedPresets.has(p)),
    };
    navigate("/benchmark/run", { state: { qualityConfig: config } });
  };

  const softwareEncoders = encoders.filter(
    (e) => e.encoder_type === "Software",
  );
  const hardwareEncoders = encoders.filter(
    (e) => e.encoder_type === "Hardware",
  );

  const sourceFileName = sourcePath?.split(/[/\\]/).pop();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading encoders...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Quality Benchmark</h2>
        <p className="text-surface-400 mt-1">
          Encode your source clip and measure SSIM, PSNR, and VMAF quality
        </p>
      </div>

      {/* Source Selection */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          Source Video
        </h3>
        {sourcePath ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{sourceFileName}</p>
              <p className="text-xs text-surface-400 font-mono truncate max-w-md">
                {sourcePath}
              </p>
            </div>
            <button
              onClick={handleSelectSource}
              className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-xs transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <button
            onClick={handleSelectSource}
            className="w-full py-8 border-2 border-dashed border-surface-600 rounded-lg text-surface-400 hover:border-surface-500 hover:text-surface-300 transition-colors"
          >
            Select a video file...
          </button>
        )}
        <p className="text-xs text-surface-500 mt-2">
          Use a high-quality source for meaningful quality comparisons.
          Ideally a mix of simple and complex scenes.
        </p>
      </div>

      {/* Software Encoders */}
      {softwareEncoders.length > 0 && (
        <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
          <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
            Software Encoders
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {softwareEncoders.map((enc) => (
              <label
                key={enc.name}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedEncoders.has(enc.name)
                    ? "bg-blue-600/10 border border-blue-500/30"
                    : "bg-surface-800 border border-surface-700 hover:border-surface-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedEncoders.has(enc.name)}
                  onChange={() => toggleEncoder(enc.name)}
                  className="rounded border-surface-600"
                />
                <div>
                  <p className="text-sm text-white">{enc.display_name}</p>
                  <p className="text-xs text-surface-400 font-mono">
                    {enc.name}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Hardware Encoders */}
      {hardwareEncoders.length > 0 && (
        <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
          <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
            Hardware Encoders
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {hardwareEncoders.map((enc) => (
              <label
                key={enc.name}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedEncoders.has(enc.name)
                    ? "bg-blue-600/10 border border-blue-500/30"
                    : "bg-surface-800 border border-surface-700 hover:border-surface-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedEncoders.has(enc.name)}
                  onChange={() => toggleEncoder(enc.name)}
                  className="rounded border-surface-600"
                />
                <div>
                  <p className="text-sm text-white">{enc.display_name}</p>
                  <p className="text-xs text-surface-400 font-mono">
                    {enc.name}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Speed Tiers */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          Speed Tiers
        </h3>
        <div className="flex gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => togglePreset(preset)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPresets.has(preset)
                  ? "bg-blue-600 text-white"
                  : "bg-surface-800 text-surface-400 hover:text-surface-200"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">
          {totalJobs} encode{totalJobs !== 1 ? "s" : ""} + quality analysis
        </p>
        <button
          onClick={handleStart}
          disabled={totalJobs === 0 || !sourcePath}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-700 disabled:text-surface-500 rounded-xl text-white font-medium transition-colors"
        >
          Start Quality Benchmark
        </button>
      </div>
    </div>
  );
}

export default QualityBenchmarkPage;
