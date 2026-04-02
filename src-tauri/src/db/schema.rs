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

        -- Migration: add benchmark_mode and source_file columns
        -- These use ALTER TABLE so they work on existing databases
        ",
    )?;

    // Add columns if they don't exist (SQLite doesn't have IF NOT EXISTS for ALTER TABLE)
    let has_mode: bool = conn
        .prepare("SELECT benchmark_mode FROM benchmark_runs LIMIT 0")
        .is_ok();
    if !has_mode {
        conn.execute_batch(
            "ALTER TABLE benchmark_runs ADD COLUMN benchmark_mode TEXT NOT NULL DEFAULT 'speed';
             ALTER TABLE benchmark_runs ADD COLUMN source_file TEXT;",
        )?;
    }

    let has_output_dir: bool = conn
        .prepare("SELECT output_dir FROM benchmark_runs LIMIT 0")
        .is_ok();
    if !has_output_dir {
        conn.execute_batch(
            "ALTER TABLE benchmark_runs ADD COLUMN output_dir TEXT;
             ALTER TABLE benchmark_results ADD COLUMN output_file TEXT;",
        )?;
    }

    Ok(())
}
