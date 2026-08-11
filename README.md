# IDE

IDE es un entorno de desarrollo integrado híbrido y multilenguaje, diseñado con identidad propia para funcionar tanto en GitHub Pages como en una aplicación nativa ligera para Windows, Linux y macOS.

La versión web no es una maqueta: edita proyectos reales, guarda en IndexedDB, importa carpetas, exporta JSON/ZIP, diagnostica código, ejecuta JavaScript, TypeScript y Python y muestra aplicaciones web en un entorno aislado. La edición Desktop añade acceso al disco y ejecución mediante los compiladores instalados en el sistema.

## Abrir

- Web: <https://alejandropico.github.io/IDE/>
- Descargas: <https://github.com/AlejandroPico/IDE/releases>
- Compilaciones recientes: <https://github.com/AlejandroPico/IDE/actions>

## Capacidades

| Área | Web | Desktop |
|---|---:|---:|
| Monaco, autocompletado y resaltado | Sí | Sí |
| Diagnóstico estructural y semántico | Sí | Sí |
| Proyectos simultáneos y búsqueda global | Sí | Sí |
| Pestañas, divisiones y ventanas internas | Sí | Sí |
| Editor desacoplado / segundo monitor | Popup + Window Management API | Ventana Tauri nativa |
| Persistencia | IndexedDB, JSON, ZIP | IndexedDB y sistema de archivos |
| HTML, CSS y JavaScript | Ejecución directa | Ejecución directa |
| TypeScript | SWC WebAssembly | Node 24+ |
| Python | Pyodide 314 / Python 3.14 | CPython local |
| Java y Spring Boot | Edición y diagnóstico | JDK 25, Maven |
| C y C++ | Edición y diagnóstico | GCC/Clang |
| C# y ASP.NET | Edición y diagnóstico | .NET 10 |
| Rust | Edición y diagnóstico | rustc/Cargo |
| Kotlin, PHP, Go y Ruby | Edición y diagnóstico | Toolchain local |

## Plantillas incluidas

Web esencial, React + TypeScript, Vue + TypeScript, Angular, Node + TypeScript, Python, FastAPI, Django, Java, Spring Boot 4.1, .NET Console, ASP.NET Core API, C + CMake, C++ + CMake, Rust + Cargo, PHP + Composer y Go Modules.

## Desarrollo web

Requisitos: Node.js 24 o posterior y npm 11 o posterior.

```bash
npm install
npm run dev
```

Verificación completa:

```bash
npm run check
```

La compilación aparece en `dist/` y usa `/IDE/` como ruta base para GitHub Pages.

## Desarrollo Desktop

Instala primero los [requisitos oficiales de Tauri](https://v2.tauri.app/start/prerequisites/) para tu sistema y Rust estable.

```bash
npm install
npm run tauri dev
```

Crear el instalador del sistema actual:

```bash
npm run tauri build
```

Los binarios de usuario final no abren una consola adicional. Windows recibe MSI/NSIS, Linux AppImage/DEB y macOS DMG/App según el empaquetador de Tauri.

## Publicación

- `deploy.yml` prueba, construye y publica la SPA en Pages tras cada cambio en `main`.
- `desktop.yml` compila cuatro objetivos: Windows x64, Linux x64, macOS Apple Silicon y macOS Intel.
- Un tag `v*` crea o actualiza la release correspondiente con los instaladores.

## Estructura

```text
src/
  components/       interfaz, paneles, ventanas y asistentes
  core/             tipos, lenguajes, plantillas y diagnóstico
  services/         ejecución, archivos, escritorio y ventanas
  store/            estado persistente de proyectos
  workers/          diagnóstico y Python fuera del hilo principal
src-tauri/
  src/lib.rs        comandos nativos y pipelines de toolchains
.github/workflows/  Pages y binarios multiplataforma
docs/               arquitectura y hoja de ruta
```

La explicación técnica completa está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y la evolución prevista en [docs/ROADMAP.md](docs/ROADMAP.md).

## Privacidad y honestidad funcional

IDE no tiene telemetría, cuenta obligatoria ni guardado remoto. Todo queda en el navegador o en la carpeta local elegida. Tampoco presenta una simulación como compilación: cuando el navegador carece del runtime de un lenguaje, lo indica y reserva la ejecución para Desktop.

Licencia MIT · © 2026 Alejandro Pico
