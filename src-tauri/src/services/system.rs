use crate::models::SystemInfo;

pub fn collect_system_info() -> SystemInfo {
    let mut sys = sysinfo::System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    let cpu_cores = sys.physical_core_count().unwrap_or(0) as u32;
    let cpu_threads = sys.cpus().len() as u32;
    let ram_gb = sys.total_memory() as f64 / 1_073_741_824.0;

    let os = std::env::consts::OS.to_string();
    let os_version = sysinfo::System::os_version().unwrap_or_else(|| "Unknown".to_string());

    SystemInfo {
        cpu_name,
        cpu_cores,
        cpu_threads,
        ram_gb,
        os,
        os_version,
        gpu: None,
    }
}
