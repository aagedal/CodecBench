use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::db::queries;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn export_json(
    run_id: String,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let db = state.db.lock().unwrap();
    let run = queries::get_run(&db, &run_id)?;
    let json = serde_json::to_string_pretty(&run)?;
    Ok(json)
}

#[tauri::command]
pub async fn export_all_runs(state: State<'_, AppState>) -> Result<String, AppError> {
    let db = state.db.lock().unwrap();
    let runs = queries::get_all_runs_full(&db)?;
    let json = serde_json::to_string_pretty(&runs)?;
    Ok(json)
}

#[derive(Serialize)]
pub struct ImportResult {
    pub added: usize,
    pub skipped: usize,
}

#[tauri::command]
pub async fn import_runs(
    json_str: String,
    state: State<'_, AppState>,
) -> Result<ImportResult, AppError> {
    let runs: Vec<crate::models::BenchmarkRun> = serde_json::from_str(&json_str)?;
    let db = state.db.lock().unwrap();
    let mut added = 0;
    let mut skipped = 0;
    for run in runs {
        if queries::run_exists(&db, &run.id)? {
            skipped += 1;
        } else {
            queries::insert_run(&db, &run)?;
            added += 1;
        }
    }
    Ok(ImportResult { added, skipped })
}

#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> Result<(), AppError> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(AppError::Io(format!("Path does not exist: {}", path.display())));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(if path.is_dir() { &path } else { path.parent().unwrap_or(&path) })
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(if path.is_dir() { &path } else { path.parent().unwrap_or(&path) })
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    #[cfg(target_os = "windows")]
    {
        if path.is_dir() {
            std::process::Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| AppError::Io(e.to_string()))?;
        } else {
            std::process::Command::new("explorer")
                .args(["/select,", &path.to_string_lossy()])
                .spawn()
                .map_err(|e| AppError::Io(e.to_string()))?;
        }
    }

    Ok(())
}
