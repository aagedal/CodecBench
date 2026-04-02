use tauri::State;

use crate::db::queries;
use crate::error::AppError;
use crate::models::{BenchmarkRun, BenchmarkRunSummary};
use crate::state::AppState;

#[tauri::command]
pub async fn get_benchmark_runs(
    state: State<'_, AppState>,
) -> Result<Vec<BenchmarkRunSummary>, AppError> {
    let db = state.db.lock().unwrap();
    queries::get_all_runs(&db)
}

#[tauri::command]
pub async fn get_benchmark_run(
    id: String,
    state: State<'_, AppState>,
) -> Result<BenchmarkRun, AppError> {
    let db = state.db.lock().unwrap();
    queries::get_run(&db, &id)
}

#[tauri::command]
pub async fn delete_benchmark_run(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db = state.db.lock().unwrap();
    queries::delete_run(&db, &id)
}

#[tauri::command]
pub async fn get_runs_for_comparison(
    ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<BenchmarkRun>, AppError> {
    let db = state.db.lock().unwrap();
    queries::get_runs_for_comparison(&db, &ids)
}
