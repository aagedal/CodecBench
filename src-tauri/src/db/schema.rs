use rusqlite::Connection;

use crate::error::AppError;

pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS benchmark_runs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            cpu_name TEXT NOT NULL,
            cpu_cores INTEGER NOT NULL,
            cpu_threads INTEGER NOT NULL,
            ram_gb REAL NOT NULL,
            os TEXT NOT NULL,
            os_version TEXT NOT NULL,
            gpu TEXT,
            ffmpeg_version TEXT NOT NULL DEFAULT '',
            source_duration_sec INTEGER NOT NULL,
            source_resolution_w INTEGER NOT NULL,
            source_resolution_h INTEGER NOT NULL,
            source_resolution_label TEXT NOT NULL,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS benchmark_results (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
            encoder_name TEXT NOT NULL,
            encoder_display_name TEXT NOT NULL,
            codec_family TEXT NOT NULL,
            encoder_type TEXT NOT NULL,
            preset TEXT NOT NULL,
            resolution_w INTEGER NOT NULL,
            resolution_h INTEGER NOT NULL,
            resolution_label TEXT NOT NULL,
            encoding_time_ms INTEGER NOT NULL,
            encoding_fps REAL NOT NULL,
            output_size_bytes INTEGER NOT NULL,
            vmaf REAL,
            ssim REAL,
            psnr REAL,
            ffmpeg_args TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_results_run_id ON benchmark_results(run_id);
        ",
    )?;

    Ok(())
}
