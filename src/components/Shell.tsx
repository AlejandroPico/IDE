import {
  Blocks,
  Boxes,
  Bug,
  CloudDownload,
  Command,
  Download,
  FileArchive,
  FileCode2,
  FolderOpen,
  GitBranch,
  HardDriveDownload,
  Info,
  Keyboard,
  LayoutPanelLeft,
  MoonStar,
  PanelBottom,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Sun,
  Upload,
  Workflow
} from "lucide-react";
import type { ComponentType, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityId } from "../core/types";
import { useIDEStore, selectActiveProject } from "../store/ideStore";
import { exportProjectJson, exportProjectZip } from "../services/projectIO";
import { importWorkspaceFile, openWorkspace, runActiveFile, saveActiveFile, saveAllFiles } from "../services/ideActions";
import { isTauriRuntime } from "../services/desktop";
import { SidePanel } from "./SidePanel";
import { EditorWorkspace } from "./EditorWorkspace";
import { BottomDock } from "./BottomDock";
import { ContextMenu } from "./ContextMenu";
import { FloatingWindows } from "./FloatingWindows";
import { AllModals } from "./Modals";

interface IconButtonProps {
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  shortcut?: string;
  className?: string;
}

export const IconButton = ({ label, icon: Icon, onClick, active, disabled, shortcut, className = "" }: IconButtonProps) => (
  <button
    className={`icon-button ${active ? "is-active" : ""} ${className}`}
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={shortcut ? `${label} · ${shortcut}` : label}
    aria-label={label}
    aria-pressed={active}
  >
    <Icon size={17} strokeWidth={1.8} />
  </button>
);

interface MenuItem {
  label: string;
  icon?: ComponentType<{ size?: number }>;
  shortcut?: string;
  action: () => void;
  danger?: boolean;
  separator?: boolean;
}

const AppMenu = ({ label, items }: { label: string; items: MenuItem[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="app-menu" ref={ref}>
      <button type="button" className={open ? "is-open" : ""} onClick={() => setOpen((value) => !value)}>{label}</button>
      {open && (
        <div className="app-menu__popover" role="menu">
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <div key={`${item.label}-${index}`}>
                {item.separator && <div className="menu-separator" />}
                <button
                  type="button"
                  role="menuitem"
                  className={item.danger ? "danger" : ""}
                  onClick={() => { item.action(); setOpen(false); }}
                >
                  <span>{ItemIcon && <ItemIcon size={15} />}{item.label}</span>
                  {item.shortcut && <kbd>{item.shortcut}</kbd>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TopBar = () => {
  const project = useIDEStore(selectActiveProject);
  const settings = useIDEStore((state) => state.settings);
  const running = useIDEStore((state) => state.running);
  const updateSettings = useIDEStore((state) => state.updateSettings);
  const setModal = useIDEStore((state) => state.setModal);
  const setActivity = useIDEStore((state) => state.setActivity);
  const toggleLeftPanel = useIDEStore((state) => state.toggleLeftPanel);
  const toggleBottomPanel = useIDEStore((state) => state.toggleBottomPanel);
  const splitEditor = useIDEStore((state) => state.splitEditor);

  const projectMenu: MenuItem[] = [
    { label: "Nuevo proyecto", icon: Plus, shortcut: "Ctrl+N", action: () => setModal("projectWizard", true) },
    { label: "Abrir carpeta", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void openWorkspace() },
    { label: "Importar .ide.json", icon: Upload, action: () => void importWorkspaceFile() },
    { label: "Guardar", icon: Save, shortcut: "Ctrl+S", separator: true, action: () => void saveActiveFile() },
    { label: "Guardar todo", icon: Save, shortcut: "Ctrl+Alt+S", action: () => void saveAllFiles() },
    { label: "Exportar proyecto", icon: FileCode2, separator: true, action: () => exportProjectJson(project) },
    { label: "Exportar ZIP", icon: FileArchive, action: () => void exportProjectZip(project) }
  ];
  const viewMenu: MenuItem[] = [
    { label: "Explorador", icon: LayoutPanelLeft, shortcut: "Ctrl+B", action: toggleLeftPanel },
    { label: "Panel inferior", icon: PanelBottom, shortcut: "Ctrl+J", action: toggleBottomPanel },
    { label: "Dividir editor", icon: Blocks, action: () => splitEditor() },
    { label: "Paleta de órdenes", icon: Command, shortcut: "Ctrl+Shift+P", separator: true, action: () => setModal("commandPalette", true) }
  ];
  const toolsMenu: MenuItem[] = [
    { label: "Ejecutar archivo", icon: Play, shortcut: "F5", action: () => void runActiveFile() },
    { label: "Diagnóstico", icon: Bug, action: () => { setActivity("run"); useIDEStore.getState().setBottomPanel("problems", true); } },
    { label: "Arquitectura", icon: Workflow, action: () => setActivity("architecture") },
    { label: "Preferencias", icon: Settings, shortcut: "Ctrl+,", separator: true, action: () => setModal("settings", true) }
  ];
  const helpMenu: MenuItem[] = [
    { label: "Atajos de teclado", icon: Keyboard, action: () => setModal("shortcuts", true) },
    { label: "Descargas Desktop", icon: HardDriveDownload, action: () => setModal("downloads", true) },
    { label: "Acerca del IDE", icon: Info, separator: true, action: () => setModal("about", true) }
  ];

  const cycleTheme = () => {
    const order = ["obsidian", "paper", "blueprint", "auto"] as const;
    updateSettings({ theme: order[(order.indexOf(settings.theme) + 1) % order.length] });
  };
  const ThemeIcon = settings.theme === "paper" ? Sun : MoonStar;

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <img src="./favicon.svg" alt="" />
        <div><strong>IDE</strong><span>{isTauriRuntime() ? "DESKTOP" : "WEB"}</span></div>
      </div>
      <nav className="menu-strip" aria-label="Menú principal">
        <AppMenu label="Proyecto" items={projectMenu} />
        <AppMenu label="Vista" items={viewMenu} />
        <AppMenu label="Herramientas" items={toolsMenu} />
        <AppMenu label="Ayuda" items={helpMenu} />
      </nav>
      <button className="command-trigger" type="button" onClick={() => setModal("commandPalette", true)}>
        <Search size={15} /><span>{project.name}</span><kbd>Ctrl P</kbd>
      </button>
      <div className="topbar__actions">
        <IconButton label="Guardar" icon={Save} shortcut="Ctrl+S" onClick={() => void saveActiveFile()} />
        <button className="run-button" type="button" disabled={running} onClick={() => void runActiveFile()}>
          {running ? <span className="run-spinner" /> : <Play size={15} fill="currentColor" />}
          <span>{running ? "Ejecutando" : "Ejecutar"}</span>
        </button>
        <IconButton label="Descargar IDE" icon={Download} onClick={() => setModal("downloads", true)} />
        <IconButton label={`Tema: ${settings.theme}`} icon={ThemeIcon} onClick={cycleTheme} />
        <IconButton label="Preferencias" icon={Settings} onClick={() => setModal("settings", true)} />
      </div>
    </header>
  );
};

const activities: Array<{ id: ActivityId; label: string; icon: ComponentType<{ size?: number }> }> = [
  { id: "explorer", label: "Proyecto", icon: Boxes },
  { id: "search", label: "Buscar", icon: Search },
  { id: "run", label: "Ejecutar y diagnosticar", icon: Bug },
  { id: "source", label: "Cambios", icon: GitBranch },
  { id: "architecture", label: "Arquitectura", icon: Workflow }
];

const ActivityRail = () => {
  const active = useIDEStore((state) => state.activeActivity);
  const panelOpen = useIDEStore((state) => state.leftPanelOpen);
  const setActivity = useIDEStore((state) => state.setActivity);
  const setModal = useIDEStore((state) => state.setModal);
  return (
    <aside className="activity-rail" aria-label="Áreas de trabajo">
      <div className="activity-rail__main">
        {activities.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={active === id && panelOpen ? "is-active" : ""} onClick={() => setActivity(id)} title={label} aria-label={label}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="activity-rail__foot">
        <button type="button" onClick={() => setModal("downloads", true)} title="Aplicaciones Desktop"><CloudDownload size={19} /><span>Descargas</span></button>
        <button type="button" onClick={() => setModal("settings", true)} title="Preferencias"><Settings size={19} /><span>Ajustes</span></button>
      </div>
    </aside>
  );
};

const StatusBar = () => {
  const project = useIDEStore(selectActiveProject);
  const diagnosticsMap = useIDEStore((state) => state.diagnostics);
  const totals = useMemo(() => {
    const diagnostics = Object.values(diagnosticsMap).flat();
    return {
      errors: diagnostics.filter((item) => item.severity === "error").length,
      warnings: diagnostics.filter((item) => item.severity === "warning").length
    };
  }, [diagnosticsMap]);
  const activeFileId = useIDEStore((state) => state.editorGroups.find((group) => group.id === state.activeGroupId)?.activeFileId);
  const activeFile = activeFileId ? project.files[activeFileId] : undefined;
  const settings = useIDEStore((state) => state.settings);
  const setBottomPanel = useIDEStore((state) => state.setBottomPanel);
  return (
    <footer className="statusbar">
      <div>
        <span className="statusbar__branch"><GitBranch size={12} /> main</span>
        <button type="button" onClick={() => setBottomPanel("problems", true)} className={totals.errors ? "has-errors" : ""}>
          <span>× {totals.errors}</span><span>△ {totals.warnings}</span>
        </button>
      </div>
      <div className="statusbar__center"><Sparkles size={11} /><span>Diagnóstico nativo activo</span></div>
      <div>
        <span>{activeFile?.language ?? "Sin archivo"}</span>
        <span>UTF-8</span>
        <span>LF</span>
        <span>{settings.tabSize} espacios</span>
        <span>{isTauriRuntime() ? "Escritorio" : "Navegador"}</span>
      </div>
    </footer>
  );
};

export function MainShell() {
  const leftPanelOpen = useIDEStore((state) => state.leftPanelOpen);
  const leftPanelWidth = useIDEStore((state) => state.leftPanelWidth);
  const bottomPanelOpen = useIDEStore((state) => state.bottomPanelOpen);
  const bottomPanelHeight = useIDEStore((state) => state.bottomPanelHeight);
  const setLeftPanelWidth = useIDEStore((state) => state.setLeftPanelWidth);
  const setBottomPanelHeight = useIDEStore((state) => state.setBottomPanelHeight);
  const setContextMenu = useIDEStore((state) => state.setContextMenu);

  const beginHorizontalResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = leftPanelWidth;
    const move = (pointer: PointerEvent) => setLeftPanelWidth(startWidth + pointer.clientX - startX);
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  const beginVerticalResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = bottomPanelHeight;
    const move = (pointer: PointerEvent) => setBottomPanelHeight(startHeight + startY - pointer.clientY);
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      className="ide-shell"
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, scope: "workspace" });
      }}
      onPointerDown={() => setContextMenu(null)}
    >
      <TopBar />
      <div className="workspace-grid">
        <ActivityRail />
        {leftPanelOpen && <aside className="side-region" style={{ width: leftPanelWidth }}><SidePanel /><button className="resize-handle resize-handle--x" type="button" aria-label="Redimensionar panel" onMouseDown={beginHorizontalResize} /></aside>}
        <main className="workbench">
          <EditorWorkspace />
          {bottomPanelOpen && <section className="bottom-region" style={{ height: bottomPanelHeight }}><button className="resize-handle resize-handle--y" type="button" aria-label="Redimensionar panel inferior" onMouseDown={beginVerticalResize} /><BottomDock /></section>}
        </main>
      </div>
      <StatusBar />
      <ContextMenu />
      <FloatingWindows />
      <AllModals />
    </div>
  );
}
