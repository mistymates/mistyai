#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{env, fs, path::PathBuf, process::Command};

fn spawn(path: &str, args: &[&str]) -> Result<(), String> {
    Command::new(path)
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("{path}: {error}"))
}

fn env_path(name: &str, segments: &[&str]) -> Option<String> {
    let mut path = PathBuf::from(env::var(name).ok()?);
    for segment in segments {
        path.push(segment);
    }
    Some(path.to_string_lossy().to_string())
}

fn first_child_exe(base: Option<String>, exe_name: &str) -> Option<String> {
    let base = PathBuf::from(base?);
    let entries = fs::read_dir(base).ok()?;

    for entry in entries.flatten() {
        let path = entry.path().join(exe_name);
        if path.exists() {
            return Some(path.to_string_lossy().to_string());
        }
    }

    None
}

fn brave_candidates() -> Vec<String> {
    let mut candidates = vec!["brave".to_string(), "brave.exe".to_string()];
    if let Some(path) = env_path(
        "ProgramFiles",
        &["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
    ) {
        candidates.push(path);
    }
    if let Some(path) = env_path(
        "ProgramFiles(x86)",
        &["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
    ) {
        candidates.push(path);
    }
    if let Some(path) = env_path(
        "LOCALAPPDATA",
        &["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
    ) {
        candidates.push(path);
    }
    candidates
}

fn open_default_url(url: &str) -> Result<(), String> {
    spawn("rundll32.exe", &["url.dll,FileProtocolHandler", url])
        .or_else(|_| spawn("cmd", &["/C", "start", "", url]))
}

fn open_url_in_brave(url: &str) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only http and https URLs can be opened.".to_string());
    }

    for candidate in brave_candidates() {
        if spawn(&candidate, &[url]).is_ok() {
            return Ok(());
        }
    }

    open_default_url(url)
}

fn open_app_protocol(protocol: &str) -> Result<(), String> {
    spawn("cmd", &["/C", "start", "", protocol])
}

fn launch_app(target: &str) -> Result<(), String> {
    let mut candidates: Vec<String> = Vec::new();

    match target {
        "brave" => candidates.extend(brave_candidates()),
        "discord" => {
            candidates.push("discord".to_string());
            candidates.push("Discord.exe".to_string());
            if let Some(path) =
                first_child_exe(env_path("LOCALAPPDATA", &["Discord"]), "Discord.exe")
            {
                candidates.push(path);
            }
            if let Some(path) = first_child_exe(
                env_path("LOCALAPPDATA", &["DiscordCanary"]),
                "DiscordCanary.exe",
            ) {
                candidates.push(path);
            }
        }
        "whatsapp" => {
            candidates.push("WhatsApp".to_string());
            candidates.push("WhatsApp.exe".to_string());
            if let Some(path) = env_path("LOCALAPPDATA", &["WhatsApp", "WhatsApp.exe"]) {
                candidates.push(path);
            }
        }
        "spotify" => {
            candidates.push("spotify".to_string());
            candidates.push("Spotify.exe".to_string());
            if let Some(path) = env_path("APPDATA", &["Spotify", "Spotify.exe"]) {
                candidates.push(path);
            }
        }
        "roblox" => {
            candidates.push("RobloxPlayerBeta.exe".to_string());
            if let Some(path) = first_child_exe(
                env_path("LOCALAPPDATA", &["Roblox", "Versions"]),
                "RobloxPlayerBeta.exe",
            ) {
                candidates.push(path);
            }
        }
        _ => return Err(format!("Unknown launcher target: {target}")),
    }

    for candidate in candidates {
        if spawn(&candidate, &[]).is_ok() {
            return Ok(());
        }
    }

    match target {
        "discord" => open_app_protocol("discord://"),
        "whatsapp" => open_app_protocol("whatsapp://"),
        "spotify" => open_app_protocol("spotify:"),
        "roblox" => open_app_protocol("roblox-player:"),
        _ => Err(format!("Could not launch {target}.")),
    }
}

#[tauri::command]
fn launch_target(target: String, url: Option<String>) -> Result<String, String> {
    let normalized = target.trim().to_lowercase();

    if let Some(url) = url {
        if normalized != "brave" {
            return Err("URLs are only opened through the Brave launcher.".to_string());
        }
        open_url_in_brave(url.trim())?;
        return Ok("opened".to_string());
    }

    launch_app(&normalized)?;
    Ok("opened".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![launch_target])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
