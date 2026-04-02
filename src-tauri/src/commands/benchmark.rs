use tauri::{AppHandle, Manager, State};

use crate::error::AppError;
use crate::models::{BenchmarkConfig, BenchmarkRun, QualityBenchmarkConfig};
use crate::services::benchmark as benchmark_service;
use crate::state::AppState;

#[tauri::command]
pub async fn start_benchmark(
    config: BenchmarkConfig,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BenchmarkRun, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("Failed to get app data dir: {}", e)))?;

    let run = benchmark_service::run_benchmark(&app, &state, config, data_dir.clone()).await?;

    // Save to database
    {
        let db = state.db.lock().unwrap();
        crate::db::queries::insert_run(&db, &run)?;
    }

    // Clean up encoded files (they can be large)
    let encodes_dir = data_dir.join("encodes").join(&run.id);
    let _ = std::fs::remove_dir_all(&encodes_dir);

    Ok(run)
}

#[tauri::command]
pub async fn start_quality_benchmark(
    config: QualityBenchmarkConfig,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BenchmarkRun, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("Failed to get app data dir: {}", e)))?;

    let run =
        benchmark_service::run_quality_benchmark(&app, &state, config, data_dir.clone()).await?;

    {
        let db = state.db.lock().unwrap();
        crate::db::queries::insert_run(&db, &run)?;
    }

    Ok(run)
}

#[tauri::command]
pub async fn cancel_benchmark(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut cancel = state.benchmark_cancel.lock().unwrap();
    *cancel = true;
    Ok(())
}
