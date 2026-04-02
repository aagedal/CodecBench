import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAvailableEncoders } from "../lib/tauri";
import { useBenchmark } from "../hooks/useBenchmark";
import type {
  EncoderDef,
  QualityPreset,
  Resolution,
  BenchmarkConfig,
} from "../types";

const RESOLUTIONS: Resolution[] = [
  { width: 1920, height: 1080, label: "1080p" },
  { width: 3840, height: 2160, label: "4K" },
];

const PRESETS: QualityPreset[] = ["Fast", "Medium", "High"];

function BenchmarkConfigPage() {
  const navigate = useNavigate();
  const { startSpeed } = useBenchmark();
  const [encoders, setEncoders] = useState<EncoderDef[]>([]);
  const [selectedEncoders, setSelectedEncoders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPresets, setSelectedPresets] = useState<Set<QualityPreset>>(
    new Set(["Fast", "Medium", "High"]),
  );
  const [selectedResolutions, setSelectedResolutions] = useState<Set<string>>(
    new Set(["1080p"]),
  );
  const [enableQuality, setEnableQuality] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const encs = await getAvailableEncoders();
        setEncoders(encs);
        // Select all software encoders by default
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

  const toggleResolution = (label: string) => {
    setSelectedResolutions((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const totalJobs =
    selectedEncoders.size * selectedPresets.size * selectedResolutions.size;

  const handleStart = () => {
    const config: BenchmarkConfig = {
      encoders: encoders.filter((e) => selectedEncoders.has(e.name)),
      presets: PRESETS.filter((p) => selectedPresets.has(p)),
      resolutions: RESOLUTIONS.filter((r) => selectedResolutions.has(r.label)),
      enable_quality_metrics: enableQuality,
    };
    startSpeed(config);
    navigate("/benchmark/run");
  };

  const softwareEncoders = encoders.filter(
    (e) => e.encoder_type === "Software",
  );
  const hardwareEncoders = encoders.filter(
    (e) => e.encoder_type === "Hardware",
  );

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
        <h2 className="text-2xl font-bold text-white">Benchmark Config</h2>
        <p className="text-surface-400 mt-1">
          Select encoders, quality presets, and resolutions
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

      {/* Quality Presets */}
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

      {/* Resolutions */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          Resolutions
        </h3>
        <div className="flex gap-2">
          {RESOLUTIONS.map((res) => (
            <button
              key={res.label}
              onClick={() => toggleResolution(res.label)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedResolutions.has(res.label)
                  ? "bg-blue-600 text-white"
                  : "bg-surface-800 text-surface-400 hover:text-surface-200"
              }`}
            >
              {res.label}
              <span className="block text-xs opacity-60">
                {res.width}x{res.height}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quality Metrics Toggle */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-white">
              Quality Metrics (VMAF / SSIM / PSNR)
            </p>
            <p className="text-xs text-surface-400 mt-0.5">
              Significantly increases benchmark time
            </p>
          </div>
          <div
            className={`w-11 h-6 rounded-full transition-colors relative ${
              enableQuality ? "bg-blue-600" : "bg-surface-700"
            }`}
            onClick={() => setEnableQuality(!enableQuality)}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                enableQuality ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
        </label>
      </div>

      {/* Start Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">
          {totalJobs} encode{totalJobs !== 1 ? "s" : ""} to run
        </p>
        <button
          onClick={handleStart}
          disabled={totalJobs === 0}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-700 disabled:text-surface-500 rounded-xl text-white font-medium transition-colors"
        >
          Start Benchmark
        </button>
      </div>
    </div>
  );
}

export default BenchmarkConfigPage;
