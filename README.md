# CodecBench

An open-source, cross-platform video codec benchmark tool. Compare encoding performance across codecs and CPUs, with support for hardware-accelerated encoders.

## Features

- **Codec benchmarking**: H.264 (x264), H.265 (x265), AV1 (SVT-AV1), and ProRes
- **3 speed tiers**: Fast, Medium, and High Quality presets per codec
- **Hardware encoder support**: Auto-detects VideoToolbox (macOS), NVENC (NVIDIA), QSV (Intel), and AMF (AMD)
- **Quality metrics**: Optional VMAF, SSIM, and PSNR measurement
- **Result history**: Local SQLite database stores all benchmark runs with full system specs
- **Comparison**: Side-by-side chart overlays to compare results across different systems
- **Export**: JSON, PNG, and PDF export of results
- **Cross-platform**: macOS, Linux, and Windows

## Prerequisites

- [FFmpeg](https://ffmpeg.org/) installed on your system
- CodecBench will auto-detect FFmpeg or you can set the path manually

### Installing FFmpeg

**macOS** (Homebrew):
```bash
brew install ffmpeg
```

**Ubuntu/Debian**:
```bash
sudo apt install ffmpeg
```

**Windows** (Chocolatey):
```bash
choco install ffmpeg
```

**Windows** (Scoop):
```bash
scoop install ffmpeg
```

Or download a static build from [ffmpeg.org](https://ffmpeg.org/download.html) and point CodecBench to the binary.

## Development

### Prerequisites

- [Rust](https://rustup.rs/)
- [Bun](https://bun.sh/) (or Node.js)
- Platform-specific dependencies for Tauri:
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - **Windows**: WebView2 (bundled with Windows 11, installable on Windows 10)

### Setup

```bash
# Install frontend dependencies
bun install

# Run in development mode
bun run tauri dev

# Build for production
bun run tauri build
```

### Running tests

```bash
# Rust tests
cd src-tauri && cargo test

# TypeScript type checking
bunx tsc --noEmit
```

## Tech Stack

- **Backend**: Rust, [Tauri v2](https://v2.tauri.app/)
- **Frontend**: React, TypeScript, [Recharts](https://recharts.org/), Tailwind CSS
- **Database**: SQLite (bundled via rusqlite)
- **Build**: Vite, Bun

## How It Works

1. **Setup**: CodecBench auto-detects your FFmpeg installation and discovers available encoders
2. **Configure**: Select which codecs, speed tiers, and resolutions to benchmark
3. **Run**: A synthetic test video is generated, then each encoder/preset combination runs sequentially for fair comparison
4. **Results**: View charts comparing encoding speed, time, output size, and optional quality metrics
5. **Compare**: Save results and compare across different systems or FFmpeg versions

### Encoder Presets

Each codec uses a constant quality setting (CRF) while varying the speed preset:

| Codec | Fast | Medium | High Quality |
|-------|------|--------|-------------|
| H.264 (x264) | ultrafast, CRF 23 | medium, CRF 23 | veryslow, CRF 23 |
| H.265 (x265) | ultrafast, CRF 28 | medium, CRF 28 | veryslow, CRF 28 |
| AV1 (SVT-AV1) | preset 10, CRF 30 | preset 6, CRF 30 | preset 2, CRF 30 |
| ProRes | Proxy (profile 0) | Normal (profile 2) | HQ (profile 3) |

## License

See [LICENSE](LICENSE) for details.
