import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { detectFfmpeg, setFfmpegPath, getSystemInfo, getEncodeRetention, setEncodeRetention } from "../lib/tauri";
import type { FfmpegInfo, SystemInfo } from "../types";

function SetupPage() {
  const navigate = useNavigate();
  const [ffmpegInfo, setFfmpegInfo] = useState<FfmpegInfo | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [retention, setRetention] = useState<number>(30);

  useEffect(() => {
    const init = async () => {
      try {
        const sysInfo = await getSystemInfo();
        setSystemInfo(sysInfo);
      } catch {
        // Non-critical
      }

      try {
        const days = await getEncodeRetention();
        setRetention(days);
      } catch {
        // Non-critical
      }

      try {
        const info = await detectFfmpeg();
        setFfmpegInfo(info);
        setError(null);
      } catch (e) {
        setError(
          "FFmpeg not found automatically. Please select the path manually.",
        );
      } finally {
        setDetecting(false);
      }
    };
    init();
  }, []);

  const handleRetentionChange = async (days: number) => {
    setRetention(days);
    try {
      await setEncodeRetention(days);
    } catch (e) {
      console.error("Failed to save retention setting:", e);
    }
  };

  const handleBrowse = async () => {
    const selected = await open({
      multiple: false,
      title: "Select FFmpeg Binary",
    });
    if (selected) {
      try {
        const info = await setFfmpegPath(selected as string);
        setFfmpegInfo(info);
        setError(null);
      } catch (e) {
        setError(`Invalid FFmpeg binary: ${e}`);
      }
    }
  };

  const softwareEncoders =
    ffmpegInfo?.encoders.filter((e) => e.encoder_type === "Software") ?? [];
  const hardwareEncoders =
    ffmpegInfo?.encoders.filter((e) => e.encoder_type === "Hardware") ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Setup</h2>
        <p className="text-surface-400 mt-1">
          Configure FFmpeg and review your system info
        </p>
      </div>

      {/* System Info */}
      {systemInfo && (
        <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
          <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
            System
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-surface-400">CPU</span>
              <p className="text-white">{systemInfo.cpu_name}</p>
            </div>
            <div>
              <span className="text-surface-400">Cores / Threads</span>
              <p className="text-white">
                {systemInfo.cpu_cores}C / {systemInfo.cpu_threads}T
              </p>
            </div>
            <div>
              <span className="text-surface-400">RAM</span>
              <p className="text-white">{systemInfo.ram_gb.toFixed(1)} GB</p>
            </div>
            <div>
              <span className="text-surface-400">OS</span>
              <p className="text-white">
                {systemInfo.os} {systemInfo.os_version}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FFmpeg Detection */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          FFmpeg
        </h3>

        {detecting ? (
          <div className="flex items-center gap-3 text-surface-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Detecting FFmpeg...
          </div>
        ) : ffmpegInfo ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">
                Connected
              </span>
            </div>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-surface-400">Path: </span>
                <span className="text-surface-200 font-mono text-xs">
                  {ffmpegInfo.path}
                </span>
              </p>
              <p>
                <span className="text-surface-400">Version: </span>
                <span className="text-surface-200">{ffmpegInfo.version}</span>
              </p>
            </div>

            {softwareEncoders.length > 0 && (
              <div>
                <p className="text-xs text-surface-400 mb-1">
                  Software Encoders ({softwareEncoders.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {softwareEncoders.map((enc) => (
                    <span
                      key={enc.name}
                      className="px-2 py-0.5 bg-surface-800 rounded text-xs text-surface-200"
                    >
                      {enc.display_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hardwareEncoders.length > 0 && (
              <div>
                <p className="text-xs text-surface-400 mb-1">
                  Hardware Encoders ({hardwareEncoders.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {hardwareEncoders.map((enc) => (
                    <span
                      key={enc.name}
                      className="px-2 py-0.5 bg-blue-900/30 border border-blue-800/50 rounded text-xs text-blue-300"
                    >
                      {enc.display_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ffmpegInfo.has_libvmaf ? (
              <p className="text-xs text-emerald-400">
                VMAF quality metrics available
              </p>
            ) : (
              <p className="text-xs text-amber-400">
                VMAF not available — this ffmpeg was built without{" "}
                <span className="font-mono">--enable-libvmaf</span>.
                SSIM and PSNR will still be measured. To enable VMAF, install a
                build that includes libvmaf (e.g.{" "}
                <span className="font-mono">brew install ffmpeg --HEAD</span> or
                a static build from ffmpeg.org).
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <p className="text-amber-400 text-sm">{error}</p>
            )}
          </div>
        )}

        <button
          onClick={handleBrowse}
          className="mt-4 px-4 py-2 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-lg text-sm transition-colors"
        >
          Browse for FFmpeg...
        </button>
      </div>

      {/* Encoded Files */}
      <div className="bg-surface-900 rounded-xl border border-surface-700 p-5">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          Encoded Files
        </h3>
        <p className="text-xs text-surface-400 mb-3">
          Quality benchmark runs keep encoded files on disk for video comparison.
          Auto-delete them after:
        </p>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "1 day", days: 1 },
            { label: "7 days", days: 7 },
            { label: "1 month", days: 30 },
            { label: "Never", days: 0 },
          ].map(({ label, days }) => (
            <button
              key={days}
              onClick={() => handleRetentionChange(days)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                retention === days
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-surface-800 border-surface-600 text-surface-300 hover:border-surface-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {retention > 0 && (
          <p className="mt-2 text-xs text-surface-500">
            Encoded files older than {retention === 1 ? "1 day" : retention === 7 ? "7 days" : "1 month"} are deleted at startup.
            Benchmark results and metrics are always kept.
          </p>
        )}
        {retention === 0 && (
          <p className="mt-2 text-xs text-surface-500">
            Encoded files are never deleted automatically.
          </p>
        )}
      </div>

      {/* Continue Button */}
      <button
        onClick={() => navigate("/benchmark")}
        disabled={!ffmpegInfo}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-700 disabled:text-surface-500 rounded-xl text-white font-medium transition-colors"
      >
        Continue to Benchmark
      </button>
    </div>
  );
}

export default SetupPage;
