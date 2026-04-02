use rusqlite::Connection;

use crate::error::AppError;
use crate::models::*;

use super::models::{result_from_row, run_from_row, summary_from_row};

pub fn insert_run(conn: &Connection, run: &BenchmarkRun) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "INSERT INTO benchmark_runs (
            id, timestamp, cpu_name, cpu_cores, cpu_threads, ram_gb,
            os, os_version, gpu, ffmpeg_version,
            source_duration_sec, source_resolution_w, source_resolution_h,
            source_resolution_label
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        rusqlite::params![
            run.id,
            run.timestamp,
            run.system_info.cpu_name,
            run.system_info.cpu_cores,
            run.system_info.cpu_threads,
            run.system_info.ram_gb,
            run.system_info.os,
            run.system_info.os_version,
            run.system_info.gpu,
            run.ffmpeg_version,
            run.source_duration_sec,
            run.source_resolution.width,
            run.source_resolution.height,
            run.source_resolution.label,
        ],
    )?;

    for result in &run.results {
        tx.execute(
            "INSERT INTO benchmark_results (
                id, run_id, encoder_name, encoder_display_name,
                codec_family, encoder_type, preset,
                resolution_w, resolution_h, resolution_label,
                encoding_time_ms, encoding_fps, output_size_bytes,
                vmaf, ssim, psnr, ffmpeg_args
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            rusqlite::params![
                result.id,
                result.run_id,
                result.encoder.name,
                result.encoder.display_name,
                result.encoder.codec_family.to_string(),
                result.encoder.encoder_type.to_string(),
                result.preset.to_string(),
                result.resolution.width,
                result.resolution.height,
                result.resolution.label,
                result.encoding_time_ms,
                result.encoding_fps,
                result.output_size_bytes,
                result.vmaf,
                result.ssim,
                result.psnr,
                result.ffmpeg_args,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}

pub fn get_all_runs(conn: &Connection) -> Result<Vec<BenchmarkRunSummary>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT r.id, r.timestamp, r.cpu_name, r.os, r.ffmpeg_version,
                COUNT(res.id) as result_count
         FROM benchmark_runs r
         LEFT JOIN benchmark_results res ON res.run_id = r.id
         GROUP BY r.id
         ORDER BY r.timestamp DESC",
    )?;

    let summaries: Vec<BenchmarkRunSummary> = stmt
        .query_map([], |row| summary_from_row(row))?
        .filter_map(|r| r.ok())
        .collect();

    // Populate resolutions for each summary
    let mut result = Vec::new();
    for mut summary in summaries {
        let mut res_stmt = conn.prepare(
            "SELECT DISTINCT resolution_label FROM benchmark_results WHERE run_id = ?1",
        )?;
        let resolutions: Vec<String> = res_stmt
            .query_map([&summary.id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        summary.resolutions = resolutions;
        result.push(summary);
    }

    Ok(result)
}

pub fn get_run(conn: &Connection, id: &str) -> Result<BenchmarkRun, AppError> {
    let mut run = conn.query_row(
        "SELECT * FROM benchmark_runs WHERE id = ?1",
        [id],
        |row| run_from_row(row),
    )?;

    let mut stmt = conn.prepare(
        "SELECT * FROM benchmark_results WHERE run_id = ?1 ORDER BY encoder_name, preset",
    )?;

    let results: Vec<BenchmarkResult> = stmt
        .query_map([id], |row| result_from_row(row))?
        .filter_map(|r| r.ok())
        .collect();

    run.results = results;
    Ok(run)
}

pub fn delete_run(conn: &Connection, id: &str) -> Result<(), AppError> {
    // Foreign key cascade handles results
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    conn.execute("DELETE FROM benchmark_runs WHERE id = ?1", [id])?;
    Ok(())
}

pub fn get_runs_for_comparison(
    conn: &Connection,
    ids: &[String],
) -> Result<Vec<BenchmarkRun>, AppError> {
    let mut runs = Vec::new();
    for id in ids {
        runs.push(get_run(conn, id)?);
    }
    Ok(runs)
}
