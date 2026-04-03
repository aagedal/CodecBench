use tauri::State;

use crate::db::queries;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_encode_retention(state: State<'_, AppState>) -> Result<u32, AppError> {
    let db = state.db.lock().unwrap();
    let days = queries::get_setting(&db, "encode_retention_days")?
        .and_then(|v| v.parse().ok())
        .unwrap_or(30u32);
    Ok(days)
}

#[tauri::command]
pub async fn set_encode_retention(days: u32, state: State<'_, AppState>) -> Result<(), AppError> {
    let db = state.db.lock().unwrap();
    queries::set_setting(&db, "encode_retention_days", &days.to_string())?;
    Ok(())
}
