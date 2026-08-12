use serde::Serialize;
use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::process::Command;
use tokio::time::timeout;
use walkdir::{DirEntry, WalkDir};

const MAX_FILE_SIZE: u64 = 2 * 1024 * 1024;
const MAX_FILES: usize = 2_500;
const MAX_OUTPUT: usize = 2 * 1024 * 1024;

#[derive(Serialize)]
struct NativeFile {
    path: String,
    content: String,
    size: u64,
    read_only: bool,
}

#[derive(Serialize)]
struct NativeWorkspace {
    root: String,
    name: String,
    files: Vec<NativeFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolchainStatus {
    id: String,
    name: String,
    executable: String,
    available: bool,
    version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunResult {
    ok: bool,
    runtime: String,
    stdout: String,
    stderr: String,
    duration_ms: f64,
    exit_code: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalResult {
    ok: bool,
    shell: String,
    stdout: String,
    stderr: String,
    cwd: String,
    duration_ms: f64,
    exit_code: Option<i32>,
}

fn normalized_relative(path: &Path) -> Result<PathBuf, String> {
    let mut safe = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => safe.push(value),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("La ruta intenta salir del espacio de trabajo".into());
            }
        }
    }
    if safe.as_os_str().is_empty() {
        return Err("La ruta está vacía".into());
    }
    Ok(safe)
}

fn ignored_entry(entry: &DirEntry) -> bool {
    if entry.depth() == 0 {
        return true;
    }
    let ignored: HashSet<&str> = [
        ".git", "node_modules", "dist", "build", "target", "bin", "obj", ".idea",
        ".vscode", ".gradle", ".mvn", ".venv", "venv", "__pycache__",
    ]
    .into_iter()
    .collect();
    !ignored.contains(entry.file_name().to_string_lossy().as_ref())
}

fn is_text_file(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    if matches!(
        file_name.as_str(),
        "dockerfile" | "makefile" | "license" | "readme" | ".gitignore" | ".editorconfig"
    ) {
        return true;
    }
    let extension = path
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    matches!(
        extension.as_str(),
        "txt"
            | "md"
            | "html"
            | "htm"
            | "css"
            | "scss"
            | "less"
            | "js"
            | "jsx"
            | "mjs"
            | "cjs"
            | "ts"
            | "tsx"
            | "json"
            | "jsonc"
            | "yaml"
            | "yml"
            | "xml"
            | "svg"
            | "py"
            | "pyw"
            | "java"
            | "kt"
            | "kts"
            | "c"
            | "h"
            | "cpp"
            | "cc"
            | "cxx"
            | "hpp"
            | "cs"
            | "rs"
            | "go"
            | "php"
            | "rb"
            | "sh"
            | "bash"
            | "zsh"
            | "ps1"
            | "bat"
            | "cmd"
            | "sql"
            | "toml"
            | "ini"
            | "properties"
            | "gradle"
            | "env"
    )
}

fn scan_workspace(root: &Path) -> Result<Vec<NativeFile>, String> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(ignored_entry)
        .filter_map(Result::ok)
    {
        if files.len() >= MAX_FILES || !entry.file_type().is_file() {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(value) if value.len() <= MAX_FILE_SIZE => value,
            _ => continue,
        };
        if !is_text_file(entry.path()) {
            continue;
        }
        let bytes = match std::fs::read(entry.path()) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let content = match String::from_utf8(bytes) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let relative = entry
            .path()
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        files.push(NativeFile {
            path: relative,
            content,
            size: metadata.len(),
            read_only: metadata.permissions().readonly(),
        });
    }
    Ok(files)
}

#[tauri::command]
async fn open_workspace() -> Result<Option<NativeWorkspace>, String> {
    let Some(folder) = rfd::AsyncFileDialog::new()
        .set_title("Abrir espacio de trabajo en IDE")
        .pick_folder()
        .await
    else {
        return Ok(None);
    };
    let root = folder.path().to_path_buf();
    let name = root
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("Proyecto")
        .to_string();
    let files = scan_workspace(&root)?;
    Ok(Some(NativeWorkspace {
        root: root.to_string_lossy().to_string(),
        name,
        files,
    }))
}

#[tauri::command]
async fn save_text_file(root: String, path: String, content: String) -> Result<(), String> {
    let root_path = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("No se encuentra la carpeta del proyecto: {error}"))?;
    let relative = normalized_relative(Path::new(&path))?;
    let target = root_path.join(relative);
    let parent = target
        .parent()
        .ok_or_else(|| "El archivo no tiene una carpeta válida".to_string())?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|error| format!("No se puede crear la carpeta: {error}"))?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("No se puede validar la ruta: {error}"))?;
    if !canonical_parent.starts_with(&root_path) {
        return Err("La ruta de destino queda fuera del espacio de trabajo".into());
    }
    tokio::fs::write(&target, content)
        .await
        .map_err(|error| format!("No se puede escribir el archivo: {error}"))
}

async fn version_of(program: &str, args: &[&str]) -> Option<String> {
    let mut command = Command::new(program);
    command.args(args).stdin(Stdio::null()).kill_on_drop(true);
    let output = timeout(Duration::from_secs(4), command.output())
        .await
        .ok()?
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = if output.stdout.is_empty() {
        String::from_utf8_lossy(&output.stderr)
    } else {
        String::from_utf8_lossy(&output.stdout)
    };
    Some(text.lines().next().unwrap_or_default().trim().to_string())
}

async fn detect_one(id: &str, name: &str, candidates: &[(&str, &[&str])]) -> ToolchainStatus {
    for (program, args) in candidates {
        if let Some(version) = version_of(program, args).await {
            return ToolchainStatus {
                id: id.into(),
                name: name.into(),
                executable: (*program).into(),
                available: true,
                version,
            };
        }
    }
    ToolchainStatus {
        id: id.into(),
        name: name.into(),
        executable: candidates.first().map(|value| value.0).unwrap_or_default().into(),
        available: false,
        version: String::new(),
    }
}

#[tauri::command]
async fn detect_toolchains() -> Vec<ToolchainStatus> {
    let empty: &[&str] = &[];
    let version: &[&str] = &["--version"];
    let java_version: &[&str] = &["-version"];
    let python_version: &[&str] = &["--version"];
    let go_version: &[&str] = &["version"];
    let node_candidates = [("node", version), ("bun", version), ("deno", version)];
    let python_candidates = [
        ("python", python_version),
        ("python3", python_version),
        ("py", python_version),
    ];
    let java_candidates = [("javac", version), ("java", java_version)];
    let c_candidates = [("gcc", version), ("clang", version), ("cl", empty)];
    let cpp_candidates = [("g++", version), ("clang++", version), ("cl", empty)];
    let dotnet_candidates = [("dotnet", version)];
    let rust_candidates = [("cargo", version), ("rustc", version)];
    let php_candidates = [("php", version)];
    let go_candidates = [("go", go_version)];
    let ruby_candidates = [("ruby", version)];
    let kotlin_candidates = [("kotlinc", version)];
    let maven_candidates = [("mvn", version), ("mvn.cmd", version)];
    let futures = [
        detect_one("node", "Node.js", &node_candidates),
        detect_one("python", "Python", &python_candidates),
        detect_one("java", "JDK", &java_candidates),
        detect_one("c", "Compilador C", &c_candidates),
        detect_one("cpp", "Compilador C++", &cpp_candidates),
        detect_one("dotnet", ".NET SDK", &dotnet_candidates),
        detect_one("rust", "Rust / Cargo", &rust_candidates),
        detect_one("php", "PHP", &php_candidates),
        detect_one("go", "Go", &go_candidates),
        detect_one("ruby", "Ruby", &ruby_candidates),
        detect_one("kotlin", "Kotlin", &kotlin_candidates),
        detect_one("maven", "Apache Maven", &maven_candidates),
    ];
    futures::future::join_all(futures).await
}

fn truncate_output(bytes: &[u8]) -> String {
    let end = bytes.len().min(MAX_OUTPUT);
    let mut value = String::from_utf8_lossy(&bytes[..end]).to_string();
    if bytes.len() > MAX_OUTPUT {
        value.push_str("\n… salida truncada por superar 2 MB");
    }
    value
}

async fn execute(
    program: &str,
    args: &[String],
    cwd: &Path,
    runtime: &str,
    started: Instant,
) -> RunResult {
    let mut command = Command::new(program);
    command
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    match timeout(Duration::from_secs(30), command.output()).await {
        Ok(Ok(output)) => RunResult {
            ok: output.status.success(),
            runtime: runtime.into(),
            stdout: truncate_output(&output.stdout),
            stderr: truncate_output(&output.stderr),
            duration_ms: started.elapsed().as_secs_f64() * 1_000.0,
            exit_code: output.status.code(),
        },
        Ok(Err(error)) => RunResult {
            ok: false,
            runtime: runtime.into(),
            stdout: String::new(),
            stderr: format!("No se pudo iniciar «{program}»: {error}"),
            duration_ms: started.elapsed().as_secs_f64() * 1_000.0,
            exit_code: None,
        },
        Err(_) => RunResult {
            ok: false,
            runtime: runtime.into(),
            stdout: String::new(),
            stderr: "El proceso superó 30 segundos y fue detenido. Los servidores de desarrollo de larga duración se incorporarán al gestor de procesos persistentes.".into(),
            duration_ms: started.elapsed().as_secs_f64() * 1_000.0,
            exit_code: None,
        },
    }
}

const TERMINAL_CWD_MARKER: &str = "__IDE_TERMINAL_CWD__=";

fn terminal_start_directory(cwd: Option<String>) -> Result<PathBuf, String> {
    let candidate = cwd
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from))
        .or_else(|| std::env::current_dir().ok())
        .ok_or_else(|| "No se pudo determinar una carpeta inicial para la terminal".to_string())?;
    let canonical = candidate
        .canonicalize()
        .map_err(|error| format!("No se encuentra la carpeta de la terminal: {error}"))?;
    if !canonical.is_dir() {
        return Err("La ruta de trabajo de la terminal no es una carpeta".into());
    }
    Ok(canonical)
}

fn extract_terminal_cwd(stdout: String, fallback: &Path) -> (String, String) {
    let mut cwd = fallback.to_string_lossy().to_string();
    let mut visible = Vec::new();
    for line in stdout.lines() {
        let clean = line.trim_end_matches('\r');
        if let Some(value) = clean.strip_prefix(TERMINAL_CWD_MARKER) {
            if !value.trim().is_empty() {
                cwd = value.trim().to_string();
            }
        } else {
            visible.push(line);
        }
    }
    (visible.join("\n").trim_end().to_string(), cwd)
}

#[tauri::command]
async fn run_terminal_command(cwd: Option<String>, command: String) -> Result<TerminalResult, String> {
    let command_text = command.trim();
    if command_text.is_empty() {
        return Err("El comando está vacío".into());
    }
    let working_root = terminal_start_directory(cwd)?;
    let started = Instant::now();
    let (program, shell_name, args) = if cfg!(windows) {
        (
            "cmd.exe".to_string(),
            "CMD".to_string(),
            vec![
                "/D".to_string(),
                "/S".to_string(),
                "/C".to_string(),
                format!("{command_text}\r\necho {TERMINAL_CWD_MARKER}%CD%"),
            ],
        )
    } else {
        let shell = if cfg!(target_os = "macos") && Path::new("/bin/zsh").exists() {
            "/bin/zsh"
        } else if Path::new("/bin/bash").exists() {
            "/bin/bash"
        } else {
            "/bin/sh"
        };
        (
            shell.to_string(),
            Path::new(shell).file_name().and_then(OsStr::to_str).unwrap_or("shell").to_string(),
            vec![
                "-lc".to_string(),
                format!("{command_text}\nprintf '\\n{TERMINAL_CWD_MARKER}%s\\n' \"$PWD\""),
            ],
        )
    };

    let mut process = Command::new(&program);
    process
        .args(&args)
        .current_dir(&working_root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    match timeout(Duration::from_secs(120), process.output()).await {
        Ok(Ok(output)) => {
            let (stdout, next_cwd) = extract_terminal_cwd(truncate_output(&output.stdout), &working_root);
            Ok(TerminalResult {
                ok: output.status.success(),
                shell: shell_name,
                stdout,
                stderr: truncate_output(&output.stderr),
                cwd: next_cwd,
                duration_ms: started.elapsed().as_secs_f64() * 1_000.0,
                exit_code: output.status.code(),
            })
        }
        Ok(Err(error)) => Err(format!("No se pudo iniciar {shell_name}: {error}")),
        Err(_) => Ok(TerminalResult {
            ok: false,
            shell: shell_name,
            stdout: String::new(),
            stderr: "El comando superó 120 segundos y fue detenido.".into(),
            cwd: working_root.to_string_lossy().to_string(),
            duration_ms: started.elapsed().as_secs_f64() * 1_000.0,
            exit_code: None,
        }),
    }
}

fn package_name(code: &str) -> Option<String> {
    code.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("package ")
            .and_then(|value| value.strip_suffix(';'))
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    })
}

#[tauri::command]
async fn run_source(
    root: Option<String>,
    path: String,
    language: String,
    content: String,
) -> Result<RunResult, String> {
    let started = Instant::now();
    let run_id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let temporary = std::env::temp_dir().join(format!("alejandropico-ide-{run_id}"));
    tokio::fs::create_dir_all(&temporary)
        .await
        .map_err(|error| error.to_string())?;

    let (working_root, source_path) = if let Some(root) = root {
        let working_root = PathBuf::from(root)
            .canonicalize()
            .map_err(|error| format!("No se encuentra el proyecto local: {error}"))?;
        let relative = normalized_relative(Path::new(&path))?;
        let source_path = working_root.join(relative);
        if let Some(parent) = source_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|error| error.to_string())?;
        }
        tokio::fs::write(&source_path, &content)
            .await
            .map_err(|error| error.to_string())?;
        (working_root, source_path)
    } else {
        let safe_name = Path::new(&path)
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("main.txt");
        let source_path = temporary.join(safe_name);
        tokio::fs::write(&source_path, &content)
            .await
            .map_err(|error| error.to_string())?;
        (temporary.clone(), source_path)
    };

    let source = source_path.to_string_lossy().to_string();
    let result = match language.as_str() {
        "python" => {
            let program = if version_of("python", &["--version"]).await.is_some() {
                "python"
            } else if version_of("python3", &["--version"]).await.is_some() {
                "python3"
            } else {
                "py"
            };
            execute(program, &[source], &working_root, "CPython local", started).await
        }
        "javascript" => execute("node", &[source], &working_root, "Node.js local", started).await,
        "typescript" => execute(
            "node",
            &["--experimental-strip-types".into(), source],
            &working_root,
            "Node.js · Type stripping nativo",
            started,
        )
        .await,
        "php" => execute("php", &[source], &working_root, "PHP CLI", started).await,
        "ruby" => execute("ruby", &[source], &working_root, "Ruby", started).await,
        "go" => execute("go", &["run".into(), source], &working_root, "Go toolchain", started).await,
        "rust" => {
            if working_root.join("Cargo.toml").exists() {
                execute("cargo", &["run".into(), "--quiet".into()], &working_root, "Cargo", started).await
            } else {
                let binary = temporary.join(if cfg!(windows) { "ide-run.exe" } else { "ide-run" });
                let compile = execute(
                    "rustc",
                    &[source, "-o".into(), binary.to_string_lossy().to_string()],
                    &working_root,
                    "rustc",
                    started,
                )
                .await;
                if compile.ok {
                    execute(binary.to_string_lossy().as_ref(), &[], &working_root, "Rust nativo", started).await
                } else {
                    compile
                }
            }
        }
        "c" | "cpp" => {
            let (compiler, runtime) = if language == "c" { ("gcc", "GCC · C") } else { ("g++", "G++ · C++") };
            let binary = temporary.join(if cfg!(windows) { "ide-run.exe" } else { "ide-run" });
            let compile = execute(
                compiler,
                &[source, "-o".into(), binary.to_string_lossy().to_string()],
                &working_root,
                compiler,
                started,
            )
            .await;
            if compile.ok {
                execute(binary.to_string_lossy().as_ref(), &[], &working_root, runtime, started).await
            } else {
                compile
            }
        }
        "java" => {
            if working_root.join("pom.xml").exists() {
                execute(
                    if cfg!(windows) { "mvn.cmd" } else { "mvn" },
                    &["-q".into(), "spring-boot:run".into()],
                    &working_root,
                    "Maven · Spring Boot",
                    started,
                )
                .await
            } else {
                let classes = temporary.join("classes");
                tokio::fs::create_dir_all(&classes).await.map_err(|error| error.to_string())?;
                let compile = execute(
                    "javac",
                    &["-d".into(), classes.to_string_lossy().to_string(), source],
                    &working_root,
                    "javac",
                    started,
                )
                .await;
                if compile.ok {
                    let class = source_path.file_stem().and_then(OsStr::to_str).unwrap_or("Main");
                    let qualified = package_name(&content).map(|package| format!("{package}.{class}")).unwrap_or_else(|| class.into());
                    execute(
                        "java",
                        &["-cp".into(), classes.to_string_lossy().to_string(), qualified],
                        &working_root,
                        "JDK local",
                        started,
                    )
                    .await
                } else {
                    compile
                }
            }
        }
        "csharp" => {
            let has_project = working_root
                .read_dir()
                .map(|entries| {
                    entries
                        .filter_map(Result::ok)
                        .any(|entry| entry.path().extension() == Some(OsStr::new("csproj")))
                })
                .unwrap_or(false);
            if has_project {
                execute("dotnet", &["run".into()], &working_root, ".NET SDK", started).await
            } else {
                // A loose .cs file gets a disposable project so one-click run also
                // works outside a pre-existing solution.
                tokio::fs::write(temporary.join("Program.cs"), &content)
                    .await
                    .map_err(|error| error.to_string())?;
                tokio::fs::write(
                    temporary.join("IDE.Run.csproj"),
                    "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>",
                )
                .await
                .map_err(|error| error.to_string())?;
                execute("dotnet", &["run".into()], &temporary, ".NET SDK · proyecto temporal", started).await
            }
        }
        "kotlin" => {
            let jar = temporary.join("ide-run.jar");
            let compile = execute(
                "kotlinc",
                &[source, "-include-runtime".into(), "-d".into(), jar.to_string_lossy().to_string()],
                &working_root,
                "Kotlin compiler",
                started,
            )
            .await;
            if compile.ok {
                execute("java", &["-jar".into(), jar.to_string_lossy().to_string()], &working_root, "Kotlin/JVM", started).await
            } else {
                compile
            }
        }
        _ => RunResult {
            ok: false,
            runtime: "IDE Desktop".into(),
            stdout: String::new(),
            stderr: format!("Todavía no hay un pipeline nativo registrado para «{language}»."),
            duration_ms: started.elapsed().as_secs_f64() * 1_000.0,
            exit_code: None,
        },
    };
    let _ = tokio::fs::remove_dir_all(&temporary).await;
    Ok(result)
}

#[tauri::command]
fn open_detached_editor(app: AppHandle, file_id: String, title: String) -> Result<(), String> {
    let label = format!("editor-{}", file_id.replace(|character: char| !character.is_ascii_alphanumeric(), "-"));
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(
        &app,
        label,
        WebviewUrl::App(format!("index.html?detached={file_id}").into()),
    )
    .title(format!("{title} · IDE"))
    .inner_size(1080.0, 760.0)
    .min_inner_size(620.0, 420.0)
    .resizable(true)
    .build()
    .map(|_| ())
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn host_platform() -> String {
    std::env::consts::OS.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_workspace,
            save_text_file,
            detect_toolchains,
            run_source,
            run_terminal_command,
            open_detached_editor,
            host_platform
        ])
        .run(tauri::generate_context!())
        .expect("error while running IDE");
}
