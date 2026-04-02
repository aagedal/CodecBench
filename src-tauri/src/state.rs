use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub ffmpeg_path: Mutex<Option<PathBuf>>,
    pub ffmpeg_version: Mutex<Option<String>>,
    pub benchmark_cancel: Mutex<bool>,
}
