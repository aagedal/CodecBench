mod commands;
mod db;
mod error;
mod models;
mod services;
mod state;

use state::AppState;
use std::sync::Mutex;
use tauri::Manager;

/// Delete encoded file directories that are older than the configured retention period.
/// Nulls out the output_dir / output_file DB references so the run data is preserved.
fn cleanup_old_encodes(conn: &rusqlite::Connection) {
    let retention_days: i64 = db::queries::get_setting(conn, "encode_retention_days")
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    if retention_days == 0 {
        return; // "Never" — skip cleanup
    }

    let runs = match db::queries::get_quality_runs_with_output_dir(conn) {
        Ok(r) => r,
        Err(_) => return,
    };

    let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days);

    for (run_id, timestamp, output_dir) in runs {
        let run_time = match chrono::DateTime::parse_from_rfc3339(&timestamp) {
            Ok(t) => t,
            Err(_) => continue,
        };
        if run_time < cutoff {
            let _ = std::fs::remove_dir_all(&output_dir);
            let _ = db::queries::clear_run_output_files(conn, &run_id);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data).expect("Failed to create app data dir");

            let db_path = app_data.join("codecbench.db");
            let conn =
                rusqlite::Connection::open(&db_path).expect("Failed to open database");
            conn.execute_batch("PRAGMA foreign_keys = ON;")
                .expect("Failed to enable foreign keys");
            db::schema::run_migrations(&conn).expect("Failed to run migrations");
            cleanup_old_encodes(&conn);

            app.manage(AppState {
                db: Mutex::new(conn),
                ffmpeg_path: Mutex::new(None),
                ffmpeg_version: Mutex::new(None),
                benchmark_cancel: Mutex::new(false),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ffmpeg::detect_ffmpeg,
            commands::ffmpeg::set_ffmpeg_path,
            commands::ffmpeg::get_available_encoders,
            commands::benchmark::start_benchmark,
            commands::benchmark::start_quality_benchmark,
            commands::benchmark::cancel_benchmark,
            commands::database::get_benchmark_runs,
            commands::database::get_benchmark_run,
            commands::database::delete_benchmark_run,
            commands::database::get_runs_for_comparison,
            commands::system::get_system_info,
            commands::export::export_json,
            commands::export::export_all_runs,
            commands::export::import_runs,
            commands::export::reveal_in_file_manager,
            commands::settings::get_encode_retention,
            commands::settings::set_encode_retention,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CodecBench");
}
