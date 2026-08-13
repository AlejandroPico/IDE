import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  Blocks,
  Box,
  Braces,
  Check,
  ChevronRight,
  CircleCheck,
  CloudDownload,
  Code2,
  Command,
  Cpu,
  Download,
  ExternalLink,
  FileCode2,
  Flower2,
  CodeXml as Github,
  Globe2,
  HardDrive,
  Info,
  Keyboard,
  Laptop,
  MonitorDown,
  Moon,
  MoonStar,
  Orbit,
  PackageCheck,
  Palette,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Snowflake,
  Sun,
  Sunset,
  SwatchBook,
  Trees,
  Workflow,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { GitHubRelease, ProjectTemplate, ThemeId } from "../core/types";
import { PROJECT_TEMPLATES } from "../core/templates";
import { getLanguageForPath } from "../core/languages";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { runActiveFile, saveActiveFile } from "../services/ideActions";
import { isTauriRuntime } from "../services/desktop";

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
  });
}

const ModalFrame = ({ title, eyebrow, icon: Icon, onClose, children, className = "" }: {
  title: string;
  eyebrow: string;
  icon: ComponentType<{ size?: number }>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal-frame ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={ref}>
        <header><div className="modal-frame__icon"><Icon size={20} /></div><div><span>{eyebrow}</span><h2 id="modal-title">{title}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
        {children}
      </div>
    </div>
  );
};

const ProjectWizard = () => {
  const createProject = useIDEStore((state) => state.createProject);
  const setModal = useIDEStore((state) => state.setModal);
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<"all" | ProjectTemplate["category"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(PROJECT_TEMPLATES[0]!.id);
  const [name, setName] = useState("Mi nuevo proyecto");
  const templates = useMemo(() => PROJECT_TEMPLATES.filter((template) => {
    const matchesCategory = category === "all" || template.category === category;
    const haystack = `${template.name} ${template.language} ${template.framework} ${template.tags.join(" ")}`.toLowerCase();
    return matchesCategory && haystack.includes(query.toLowerCase());
  }), [category, query]);
  const selectedTemplate = PROJECT_TEMPLATES.find((template) => template.id === selected) ?? PROJECT_TEMPLATES[0]!;
  const finish = () => {
    createProject(selectedTemplate.id, name);
    setModal("projectWizard", false);
  };
  return (
    <ModalFrame title="Crear un espacio de trabajo" eyebrow="ASISTENTE DE PROYECTO" icon={Sparkles} onClose={() => setModal("projectWizard", false)} className="wizard-modal">
      <div className="wizard-progress"><span className={step >= 1 ? "is-active" : ""}><b>01</b> Tecnología</span><i /><span className={step >= 2 ? "is-active" : ""}><b>02</b> Configuración</span></div>
      {step === 1 ? (
        <div className="wizard-body">
          <aside className="wizard-categories">
            <button type="button" className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")}><Blocks size={15} /> Todo <b>{PROJECT_TEMPLATES.length}</b></button>
            <button type="button" className={category === "web" ? "is-active" : ""} onClick={() => setCategory("web")}><Globe2 size={15} /> Web</button>
            <button type="button" className={category === "backend" ? "is-active" : ""} onClick={() => setCategory("backend")}><Workflow size={15} /> Backend</button>
            <button type="button" className={category === "systems" ? "is-active" : ""} onClick={() => setCategory("systems")}><Cpu size={15} /> Sistemas</button>
            <button type="button" className={category === "general" ? "is-active" : ""} onClick={() => setCategory("general")}><Code2 size={15} /> General</button>
          </aside>
          <section className="wizard-templates">
            <label className="wizard-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Lenguaje, framework o tecnología" /></label>
            <div className="template-grid">
              {templates.map((template) => (
                <button key={template.id} type="button" className={selected === template.id ? "is-selected" : ""} onClick={() => setSelected(template.id)} style={{ "--template-accent": template.accent } as React.CSSProperties}>
                  <span className="template-card__mark"><Braces size={19} /></span>
                  <span className="template-card__state">{selected === template.id && <Check size={13} />}</span>
                  <strong>{template.name}</strong><small>{template.framework}</small><p>{template.description}</p>
                  <span className="template-card__tags">{template.tags.slice(0, 3).map((tag) => <i key={tag}>{tag}</i>)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="wizard-config">
          <div className="chosen-template" style={{ "--template-accent": selectedTemplate.accent } as React.CSSProperties}><span><Braces size={25} /></span><div><small>PLANTILLA</small><strong>{selectedTemplate.name}</strong><p>{selectedTemplate.description}</p></div></div>
          <label><span>Nombre del proyecto</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && name.trim() && finish()} /><small>Se puede cambiar posteriormente desde el explorador.</small></label>
          <div className="wizard-capabilities"><div><Globe2 size={18} /><span><strong>Ejecución web</strong><small>{selectedTemplate.webRunnable ? "Directa en este navegador" : "Requiere instalar sus dependencias"}</small></span>{selectedTemplate.webRunnable ? <CircleCheck size={17} /> : <Info size={17} />}</div><div><HardDrive size={18} /><span><strong>Ejecución Desktop</strong><small>{selectedTemplate.desktopRunnable ? "Compatible con toolchain local" : "Solo edición"}</small></span><CircleCheck size={17} /></div><div><ShieldCheck size={18} /><span><strong>Persistencia privada</strong><small>Guardado automático en IndexedDB</small></span><CircleCheck size={17} /></div></div>
          <p className="wizard-note"><PackageCheck size={15} /> Se crearán {selectedTemplate.files.length} archivos iniciales. Los frameworks no se descargan hasta que ejecutes su gestor de paquetes en Desktop.</p>
        </div>
      )}
      <footer className="wizard-footer"><span>{step === 1 ? `${templates.length} plantillas disponibles` : `${selectedTemplate.language} · ${selectedTemplate.framework}`}</span><div>{step === 2 && <button type="button" className="secondary-action" onClick={() => setStep(1)}><ArrowLeft size={15} /> Atrás</button>}<button type="button" className="primary-action" disabled={step === 2 && !name.trim()} onClick={() => step === 1 ? setStep(2) : finish()}>{step === 1 ? <>Continuar <ArrowRight size={15} /></> : <><Sparkles size={15} /> Crear proyecto</>}</button></div></footer>
    </ModalFrame>
  );
};

const SettingsModal = () => {
  const settings = useIDEStore((state) => state.settings);
  const update = useIDEStore((state) => state.updateSettings);
  const setModal = useIDEStore((state) => state.setModal);
  const themes: Array<{ id: ThemeId; label: string; icon: ComponentType<{ size?: number }> }> = [
    { id: "obsidian", label: "Obsidiana", icon: MoonStar },
    { id: "graphite", label: "Grafito", icon: SwatchBook },
    { id: "aurora", label: "Aurora", icon: Orbit },
    { id: "violet", label: "Violeta", icon: Sparkles },
    { id: "midnight", label: "Medianoche", icon: Moon },
    { id: "forest", label: "Bosque", icon: Trees },
    { id: "paper", label: "Papel", icon: Sun },
    { id: "sand", label: "Arena", icon: Sunset },
    { id: "rose", label: "Rosa", icon: Flower2 },
    { id: "arctic", label: "Ártico", icon: Snowflake },
    { id: "blueprint", label: "Plano técnico", icon: Palette },
    { id: "auto", label: "Automático", icon: Laptop }
  ];
  return (
    <ModalFrame title="Preferencias del entorno" eyebrow="CONFIGURACIÓN LOCAL" icon={Settings} onClose={() => setModal("settings", false)} className="settings-modal">
      <div className="settings-body">
        <section className="settings-appearance"><h3>Apariencia</h3><p>La elección se conserva únicamente en este dispositivo.</p><div className="theme-grid">{themes.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={settings.theme === id ? "is-selected" : ""} onClick={() => update({ theme: id })}><Icon size={17} /><span>{label}</span>{settings.theme === id && <Check size={12} />}</button>)}</div></section>
        <section className="settings-editor"><h3>Editor</h3><div className="settings-compact-grid"><div className="setting-row"><div><strong>Tamaño del texto</strong><small>Tipografía del código</small></div><input type="range" min="11" max="24" value={settings.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} /><output>{settings.fontSize}px</output></div><div className="setting-row"><div><strong>Tabulación</strong><small>Espacios al tabular</small></div><select value={settings.tabSize} onChange={(event) => update({ tabSize: Number(event.target.value) })}><option value="2">2 espacios</option><option value="4">4 espacios</option><option value="8">8 espacios</option></select></div></div></section>
        <section className="settings-behavior"><h3>Comportamiento</h3><div className="settings-compact-grid"><Toggle label="Guardado automático" detail="Guarda 1,1 s después de escribir" value={settings.autoSave} onChange={(value) => update({ autoSave: value })} /><Toggle label="Ajuste de línea" detail="Envuelve las líneas largas" value={settings.wordWrap} onChange={(value) => update({ wordWrap: value })} /><Toggle label="Minimapa" detail="Mapa lateral del archivo" value={settings.minimap} onChange={(value) => update({ minimap: value })} /><Toggle label="Caracteres invisibles" detail="Muestra espacios y tabulaciones" value={settings.showWhitespace} onChange={(value) => update({ showWhitespace: value })} /><Toggle label="Reducir movimiento" detail="Limita las animaciones" value={settings.reducedMotion} onChange={(value) => update({ reducedMotion: value })} /></div></section>
        <section className="settings-help">
          <h3>Información y ayuda</h3>
          <p>Documentación esencial y datos del proyecto, reunidos dentro de Preferencias.</p>
          <div>
            <button type="button" onClick={() => { setModal("settings", false); setModal("about", true); }}><Info size={17} /><span><strong>Acerca de IDE</strong><small>Versión {DESKTOP_VERSION} · Alejandro Pico · repositorio y portfolio</small></span><ChevronRight size={14} /></button>
            <button type="button" onClick={() => { setModal("settings", false); setModal("shortcuts", true); }}><Keyboard size={17} /><span><strong>Atajos de teclado</strong><small>Consulta todas las combinaciones disponibles</small></span><ChevronRight size={14} /></button>
          </div>
        </section>
        {isTauriRuntime() && <DesktopUpdateCheck />}
      </div>
      <footer className="modal-footer"><span><ShieldCheck size={14} /> Sin telemetría. Sin cuenta. Sin nube obligatoria.</span><button type="button" className="primary-action" onClick={() => setModal("settings", false)}><Check size={15} /> Listo</button></footer>
    </ModalFrame>
  );
};

const Toggle = ({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (value: boolean) => void }) => <label className="toggle-row"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;

const DESKTOP_VERSION = "0.3.1";

const isNewerVersion = (candidate: string, current: string): boolean => {
  const parts = (value: string) => value.replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const next = parts(candidate);
  const installed = parts(current);
  return [0, 1, 2].some((index) => next[index]! > installed[index]! && next.slice(0, index).every((part, previous) => part === installed[previous]));
};

const DesktopUpdateCheck = () => {
  const [status, setStatus] = useState<"idle" | "checking" | "current" | "available" | "error">("idle");
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const check = async () => {
    setStatus("checking");
    try {
      const response = await fetch("https://api.github.com/repos/AlejandroPico/IDE/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(`GitHub respondió ${response.status}`);
      const latest = await response.json() as GitHubRelease;
      setRelease(latest);
      setStatus(isNewerVersion(latest.tag_name, DESKTOP_VERSION) ? "available" : "current");
    } catch {
      setStatus("error");
    }
  };
  return (
    <section className="settings-update">
      <h3>Actualizaciones de Desktop</h3>
      <p>Versión instalada: {DESKTOP_VERSION}. La comprobación consulta únicamente las publicaciones oficiales del proyecto.</p>
      <div>
        <button type="button" onClick={() => void check()} disabled={status === "checking"}><RefreshCw className={status === "checking" ? "spin" : ""} size={15} />{status === "checking" ? "Comprobando…" : "Comprobar actualizaciones"}</button>
        {status === "current" && <span className="is-current"><CircleCheck size={14} /> IDE está actualizado.</span>}
        {status === "available" && release && <a href={release.html_url} target="_blank" rel="noreferrer">Nueva versión {release.tag_name} <ExternalLink size={12} /></a>}
        {status === "error" && <span className="is-error">No se pudo consultar GitHub. Inténtalo de nuevo.</span>}
      </div>
    </section>
  );
};

const detectPlatform = (): "windows" | "macos" | "linux" => {
  const value = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (value.includes("mac")) return "macos";
  if (value.includes("linux")) return "linux";
  return "windows";
};

const assetForPlatform = (release: GitHubRelease | null, platform: string) => release?.assets.find((asset) => {
  const name = asset.name.toLowerCase();
  if (platform === "windows") return name.endsWith(".msi") || name.endsWith(".exe");
  if (platform === "macos") return name.endsWith(".dmg") || name.endsWith(".app.tar.gz");
  return name.endsWith(".appimage") || name.endsWith(".deb");
});

const DownloadsModal = () => {
  const setModal = useIDEStore((state) => state.setModal);
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const platform = detectPlatform();
  const recommended = assetForPlatform(release, platform);
  useEffect(() => {
    const controller = new AbortController();
    fetch("https://api.github.com/repos/AlejandroPico/IDE/releases/latest", { signal: controller.signal, headers: { Accept: "application/vnd.github+json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "La primera compilación Desktop todavía está en curso." : `GitHub respondió ${response.status}.`);
        return response.json() as Promise<GitHubRelease>;
      })
      .then(setRelease)
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  const installPwa = async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  };
  return (
    <ModalFrame title="Instala el IDE donde trabajas" eyebrow="WEB + ESCRITORIO NATIVO" icon={MonitorDown} onClose={() => setModal("downloads", false)} className="downloads-modal">
      <div className="download-hero"><div><span className="download-os"><Laptop size={15} /> Sistema detectado: {platform === "windows" ? "Windows" : platform === "macos" ? "macOS" : "Linux"}</span><h3>Tu espacio de trabajo,<br />sin depender del navegador.</h3><p>La edición Desktop añade acceso al disco, compiladores locales, frameworks completos y ventanas nativas con el mismo proyecto visual.</p>{recommended ? <a className="download-primary" href={recommended.browser_download_url}><Download size={17} /> Descargar para {platform === "windows" ? "Windows" : platform === "macos" ? "macOS" : "Linux"}<small>{(recommended.size / 1024 / 1024).toFixed(1)} MB · {release?.tag_name}</small></a> : <a className="download-primary is-pending" href="https://github.com/AlejandroPico/IDE/actions" target="_blank" rel="noreferrer"><CloudDownload size={17} /> {loading ? "Consultando compilaciones…" : "Ver compilación Desktop"}<small>{error || "Windows · Linux · macOS"}</small></a>}</div><div className="download-device"><img src="./favicon.svg" alt="" /><span>IDE</span><i /><small>TAURI · RUST</small></div></div>
      <div className="download-options">
        <article><div><Globe2 size={20} /></div><span><small>SIN DESCARGA</small><strong>Aplicación web</strong><p>Edición, proyectos, vista web, JS/TS y Python en el navegador.</p></span><button type="button" onClick={() => setModal("downloads", false)}>Ya la estás usando <Check size={14} /></button></article>
        <article><div><AppWindow size={20} /></div><span><small>INSTALABLE</small><strong>Web App · PWA</strong><p>Acceso desde el escritorio y trabajo offline con el núcleo en caché.</p></span><button type="button" disabled={!deferredInstallPrompt} onClick={() => void installPwa()}>{deferredInstallPrompt ? "Instalar ahora" : "Disponible desde el navegador"}</button></article>
        <article><div><HardDrive size={20} /></div><span><small>NATIVO LIGERO</small><strong>IDE Desktop</strong><p>Acceso local, toolchains, ventanas nativas y paquetes del sistema.</p></span><a href="https://github.com/AlejandroPico/IDE/releases" target="_blank" rel="noreferrer">Todas las versiones <ExternalLink size={13} /></a></article>
      </div>
      {release && <div className="release-assets"><span>Archivos de {release.name || release.tag_name}</span><div>{release.assets.map((asset) => <a key={asset.id} href={asset.browser_download_url}><Box size={13} />{asset.name}<small>{(asset.size / 1024 / 1024).toFixed(1)} MB</small></a>)}</div></div>}
      <footer className="download-footer"><ShieldCheck size={16} /><span>Los binarios se compilan de forma reproducible en GitHub Actions. Sin runtimes ocultos ni procesos de fondo.</span><a href="https://github.com/AlejandroPico/IDE/actions" target="_blank" rel="noreferrer">Ver Actions</a></footer>
    </ModalFrame>
  );
};

const AboutModal = () => {
  const setModal = useIDEStore((state) => state.setModal);
  return (
    <ModalFrame title="IDE" eyebrow="ENTORNO DE DESARROLLO INTEGRAL" icon={Info} onClose={() => setModal("about", false)} className="about-modal">
      <div className="about-body"><div className="about-brand"><img src="./favicon.svg" alt="Logotipo de IDE" /><span><b>0.3.1</b><small>EDICIÓN MINIMALISTA</small></span></div><div><h3>Una herramienta propia para construir otras herramientas.</h3><p><strong>IDE es un proyecto de Alejandro Pico.</strong> Combina un núcleo web estático, ejecución aislada en WebAssembly y una envoltura Tauri/Rust capaz de usar el sistema local. Su interfaz, sus paneles desacoplables y su modelo de proyectos se han diseñado específicamente para este entorno.</p><div className="about-stack"><span>React 19</span><span>TypeScript 7</span><span>Vite 8</span><span>Monaco</span><span>Tauri 2.11</span><span>Rust</span><span>Pyodide 314</span></div><div className="about-links"><a href="https://github.com/AlejandroPico/IDE" target="_blank" rel="noreferrer"><Github size={16} /> Repositorio de IDE <ExternalLink size={12} /></a><a href="https://alejandropico.github.io/" target="_blank" rel="noreferrer"><Globe2 size={16} /> Portfolio de Alejandro <ExternalLink size={12} /></a></div></div></div>
      <footer className="modal-footer"><span>Creado por Alejandro Pico · Código abierto · Datos locales por defecto</span><button className="primary-action" type="button" onClick={() => setModal("about", false)}>Cerrar</button></footer>
    </ModalFrame>
  );
};

const shortcuts = [
  ["Ctrl / ⌘ + P", "Abrir archivo o paleta"], ["Ctrl / ⌘ + Shift + P", "Paleta de órdenes"], ["Ctrl / ⌘ + S", "Guardar archivo"], ["F5", "Ejecutar archivo activo"], ["Ctrl / ⌘ + Enter", "Ejecutar archivo activo"], ["Ctrl / ⌘ + B", "Mostrar u ocultar explorador"], ["Ctrl / ⌘ + J", "Mostrar u ocultar panel inferior"], ["Ctrl / ⌘ + ,", "Abrir preferencias"], ["F2", "Renombrar símbolo"], ["F12", "Ir a definición"], ["Shift + Alt + F", "Formatear documento"]
];

const ShortcutsModal = () => {
  const setModal = useIDEStore((state) => state.setModal);
  return <ModalFrame title="Atajos de teclado" eyebrow="FLUJO SIN RATÓN" icon={Keyboard} onClose={() => setModal("shortcuts", false)} className="shortcuts-modal"><div className="shortcut-list">{shortcuts.map(([keys, action]) => <div key={keys}><kbd>{keys}</kbd><span>{action}</span></div>)}</div><footer className="modal-footer"><span>Los atajos respetan Ctrl en Windows/Linux y ⌘ en macOS.</span><button className="primary-action" type="button" onClick={() => setModal("shortcuts", false)}>Listo</button></footer></ModalFrame>;
};

interface PaletteCommand { id: string; label: string; detail: string; icon: ComponentType<{ size?: number }>; action: () => void | Promise<void>; }

const CommandPalette = () => {
  const setModal = useIDEStore((state) => state.setModal);
  const setActivity = useIDEStore((state) => state.setActivity);
  const project = useIDEStore(selectActiveProject);
  const openFile = useIDEStore((state) => state.openFile);
  const setBottomPanel = useIDEStore((state) => state.setBottomPanel);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const close = () => setModal("commandPalette", false);
  const commands = useMemo<PaletteCommand[]>(() => [
    ...Object.values(project.files).map((file) => ({ id: `file-${file.id}`, label: file.path, detail: getLanguageForPath(file.path).label, icon: FileCode2, action: () => openFile(file.id) })),
    { id: "run", label: "Ejecutar archivo activo", detail: "F5", icon: Play, action: runActiveFile },
    { id: "save", label: "Guardar archivo activo", detail: "Ctrl S", icon: HardDrive, action: saveActiveFile },
    { id: "search", label: "Buscar en el proyecto", detail: "Panel lateral", icon: Search, action: () => setActivity("search") },
    { id: "problems", label: "Mostrar problemas", detail: "Diagnóstico", icon: Braces, action: () => setBottomPanel("problems", true) }
  ], [openFile, project.files, setActivity, setBottomPanel, setModal]);
  const filtered = commands.filter((command) => `${command.label} ${command.detail}`.toLowerCase().includes(query.replace(/^>/, "").trim().toLowerCase())).slice(0, 18);
  useEffect(() => setSelected(0), [query]);
  const execute = async (command?: PaletteCommand) => {
    if (!command) return;
    close();
    await command.action();
  };
  return (
    <div className="palette-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Paleta de órdenes">
        <label><Command size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca un archivo o escribe una orden…" onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setSelected((value) => Math.min(filtered.length - 1, value + 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => Math.max(0, value - 1)); } if (event.key === "Enter") void execute(filtered[selected]); if (event.key === "Escape") close(); }} /><kbd>ESC</kbd></label>
        <div className="palette-results">{filtered.map((command, index) => { const Icon = command.icon; return <button type="button" key={command.id} className={selected === index ? "is-selected" : ""} onMouseEnter={() => setSelected(index)} onClick={() => void execute(command)}><Icon size={16} /><span><strong>{command.label}</strong><small>{command.detail}</small></span><ChevronRight size={14} /></button>; })}</div>
        <footer><span><kbd>↑↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span>{filtered.length} resultados</span></footer>
      </div>
    </div>
  );
};

export function AllModals() {
  const wizard = useIDEStore((state) => state.projectWizardOpen);
  const settings = useIDEStore((state) => state.settingsOpen);
  const downloads = useIDEStore((state) => state.downloadsOpen);
  const about = useIDEStore((state) => state.aboutOpen);
  const shortcutsOpen = useIDEStore((state) => state.shortcutsOpen);
  const palette = useIDEStore((state) => state.commandPaletteOpen);
  return <>{wizard && <ProjectWizard />}{settings && <SettingsModal />}{downloads && <DownloadsModal />}{about && <AboutModal />}{shortcutsOpen && <ShortcutsModal />}{palette && <CommandPalette />}</>;
}
