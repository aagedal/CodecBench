use std::path::PathBuf;

use tauri::State;

use crate::error::AppError;
use crate::models::FfmpegInfo;
use crate::services::ffmpeg as ffmpeg_service;
use crate::state::AppState;

#[tauri::command]
pub async fn detect_ffmpeg(state: State<'_, AppState>) -> Result<FfmpegInfo, AppError> {
    let path = ffmpeg_service::detect_ffmpeg_path()
        .ok_or_else(|| AppError::FfmpegNotFound("Could not auto-detect FFmpeg".into()))?;

    let info = ffmpeg_service::detect_and_validate(&path).await?;

    // Store the path and version in app state
    {
        let mut fp = state.ffmpeg_path.lock().unwrap();
        *fp = Some(path);
    }
    {
        let mut fv = state.ffmpeg_version.lock().unwrap();
        *fv = Some(info.version.clone());
    }

    Ok(info)
}

#[tauri::command]
pub async fn set_ffmpeg_path(
    path: String,
    state: State<'_, AppState>,
) -> Result<FfmpegInfo, AppError> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err(AppError::FfmpegNotFound(format!(
            "Path does not exist: {}",
            path
        )));
    }

    let info = ffmpeg_service::detect_and_validate(&path_buf).await?;

    {
        let mut fp = state.ffmpeg_path.lock().unwrap();
        *fp = Some(path_buf);
    }
    {
        let mut fv = state.ffmpeg_version.lock().unwrap();
        *fv = Some(info.version.clone());
    }

    Ok(info)
}

#[tauri::command]
pub async fn get_available_encoders(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::EncoderDef>, AppError> {
    let path = {
        let guard = state.ffmpeg_path.lock().unwrap();
        guard
            .clone()
            .ok_or_else(|| AppError::FfmpegNotFound("FFmpeg path not set".into()))?
    };

    ffmpeg_service::discover_encoders(&path).await
}
