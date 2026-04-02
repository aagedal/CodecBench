#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("FFmpeg not found: {0}")]
    FfmpegNotFound(String),

    #[error("FFmpeg execution failed: {0}")]
    FfmpegExecution(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Benchmark cancelled")]
    Cancelled,

    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Other(e.to_string())
    }
}
