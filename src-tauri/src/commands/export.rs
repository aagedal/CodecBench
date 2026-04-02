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
