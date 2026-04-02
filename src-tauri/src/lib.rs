mod commands;
mod db;
mod error;
mod models;
mod services;
mod state;

use state::AppState;
use std::sync::Mutex;
use tauri::Manager;

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
            commands::benchmark::cancel_benchmark,
            commands::database::get_benchmark_runs,
            commands::database::get_benchmark_run,
            commands::database::delete_benchmark_run,
            commands::database::get_runs_for_comparison,
            commands::system::get_system_info,
            commands::export::export_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CodecBench");
}
