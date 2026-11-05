// Graphin for Windows. The app is the same web application as the browser version. This launcher:
//   1. finds the bundled PHP runtime and the application files,
//   2. starts PHP's built-in server on this computer only, with the database in the app-data folder,
//   3. opens a window on that server, and
//   4. stops the server when the window closes.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// The PHP server, kept so it can be stopped when the app exits.
struct Engine(Mutex<Option<Child>>);

/// The port Graphin prefers. The browser extension and bookmarklet can rely on it.
const PREFERRED_PORT: u16 = 8765;

/// Windows paths from Tauri can start with \? (the long-path prefix). PHP does not accept that prefix,
/// so it is removed.
fn plain_path(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy().into_owned();
    match text.strip_prefix(r"\\?\") {
        Some(rest) => PathBuf::from(rest),
        None => path,
    }
}

/// Where the bundled PHP runtime and the application files are. Installed apps keep them in the resource
/// folder; `tauri dev` runs from the source tree, so fall back to src-tauri/bundle next to this project.
fn bundle_dir(app: &tauri::App) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("bundle"));
    }
    candidates.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("bundle"));
    candidates
        .into_iter()
        .map(plain_path)
        .find(|dir| dir.join("php").join("php.exe").is_file())
}

/// The preferred port if nothing else uses it, otherwise any free port.
fn free_port() -> Option<u16> {
    if TcpListener::bind(("127.0.0.1", PREFERRED_PORT)).is_ok() {
        return Some(PREFERRED_PORT);
    }
    let listener = TcpListener::bind(("127.0.0.1", 0)).ok()?;
    listener.local_addr().ok().map(|addr| addr.port())
}

/// Starts PHP's built-in server on 127.0.0.1 only. The database is a file in the app-data folder.
fn start_engine(app: &tauri::App, bundle: &Path, port: u16) -> Result<Child, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let php = bundle.join("php").join("php.exe");
    let public = bundle.join("public");
    let extensions = bundle.join("php").join("ext");

    let mut command = Command::new(&php);
    command
        // -n ignores any php.ini on the computer, so the bundled runtime behaves the same everywhere.
        .arg("-n")
        .arg("-d")
        .arg(format!("extension_dir={}", extensions.display()))
        .arg("-d")
        .arg("extension=pdo_sqlite")
        .arg("-d")
        .arg("extension=mbstring")
        .arg("-d")
        .arg("display_errors=0")
        .arg("-S")
        .arg(format!("127.0.0.1:{port}"))
        .arg("-t")
        .arg(&public)
        .arg(public.join("index.php"))
        .current_dir(bundle)
        .env("APP_MODE", "desktop")
        .env("APP_DEBUG", "false")
        .env("DB_DRIVER", "sqlite")
        .env("DB_PATH", data_dir.join("graphin.sqlite"));

    // Do not open a console window for the PHP process.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    command
        .spawn()
        .map_err(|e| format!("Could not start the Graphin engine: {e}"))
}

/// Waits until the server accepts connections, for up to 15 seconds.
fn wait_for_engine(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&address, Duration::from_millis(200)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(150));
    }
    false
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let bundle = bundle_dir(app).ok_or("The Graphin engine (bundle/php) was not found.")?;
            let port = free_port().ok_or("No free local port is available.")?;

            let child = start_engine(app, &bundle, port)?;
            app.manage(Engine(Mutex::new(Some(child))));

            if !wait_for_engine(port) {
                return Err("The Graphin engine did not start in time.".into());
            }

            let url: tauri::Url = format!("http://127.0.0.1:{port}/").parse()?;
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Graphin")
                .inner_size(1280.0, 820.0)
                .min_inner_size(800.0, 560.0)
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Graphin")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(engine) = app.try_state::<Engine>() {
                    if let Some(mut child) = engine.0.lock().ok().and_then(|mut slot| slot.take()) {
                        let _ = child.kill();
                    }
                }
            }
        });
}
