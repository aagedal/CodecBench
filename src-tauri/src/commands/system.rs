use crate::error::AppError;
use crate::models::SystemInfo;
use crate::services::system;

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, AppError> {
    Ok(system::collect_system_info())
}
