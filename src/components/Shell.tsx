import {
  Blocks,
  Boxes,
  Bug,
  ChevronRight,
  CircleHelp,
  CloudDownload,
  Command,
  FileArchive,
  FileCode2,
  FolderKanban,
  FolderOpen,
  GitBranch,
  Info,
  Keyboard,
  LayoutDashboard,
  LayoutPanelLeft,
  PanelBottom,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Upload,
  Workflow,
  Wrench
} from "lucide-react";
import type { ComponentType, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityId } from "../core/types";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { exportProjectJson, exportProjectZip } from "../services/projectIO";
import { importWorkspaceFile, openWorkspace, runActiveFile, saveActiveFile, saveAllFiles } from "../services/ideActions";
import { isTauriRuntime } from "../services/desktop";
import { SidePanel } from "./SidePanel";
import { EditorWorkspace } from "./EditorWorkspace";
import { BottomDock } from "./BottomDock";
import { ContextMenu } from "./ContextMenu";
import { FloatingWindows } from "./FloatingWindows";
import { AllModals } from "./Modals";

interface MenuItem {
  label: string;
  icon?: ComponentType<{ size?: number }>;
  shortcut?: string;
  action: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface RailMenuProps {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  items: MenuItem[];
  open: boolean;
  onToggle: (id: string) => void;
}

const RailMenu = ({ id, label, icon: Icon, items, open, onToggle }: RailMenuProps) => (
  <div className="rail-menu">
    <button className={`rail-subitem ${open ? "is-open" : ""}`} type="button" onClick={() => onToggle(id)} aria-expanded={open}>
      <Icon size={16} strokeWidth={1.8} />
      <span>{label}</span>
      <ChevronRight className="rail-subitem__chevron" size={13} />
    </button>
    {open && (
      <div className="rail-menu__popover" role="menu">
        <header><span>{label}</span><small>IDE</small></header>
        {items.map((item, index) => {
          const ItemIcon = item.icon;
          return (
            <div key={`${item.label}-${index}`}>
              {item.separator && <div className="menu-separator" />}
              <button
                type="button"
                role="menuitem"
                className={item.danger ? "danger" : ""}
                onClick={() => { item.action(); onToggle(""); }}
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

const activities: Array<{ id: ActivityId; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: "explorer", label: "Proyecto", icon: Boxes },
  { id: "search", label: "Buscar en archivos", icon: Search },
  { id: "run", label: "Diagnóstico", icon: Bug },
  { id: "source", label: "Cambios", icon: GitBranch },
  { id: "architecture", label: "Arquitectura", icon: Workflow }
];

const NavigationRail = () => {
  const [expanded, setExpanded] = useState(false);
  const [openMenu, setOpenMenu] = useState("");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const project = useIDEStore(selectActiveProject);
  const active = useIDEStore((state) => state.activeActivity);
  const panelOpen = useIDEStore((state) => state.leftPanelOpen);
  const running = useIDEStore((state) => state.running);
  const setActivity = useIDEStore((state) => state.setActivity);
  const setModal = useIDEStore((state) => state.setModal);
  const toggleLeftPanel = useIDEStore((state) => state.toggleLeftPanel);
  const toggleBottomPanel = useIDEStore((state) => state.toggleBottomPanel);
  const splitEditor = useIDEStore((state) => state.splitEditor);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!surfaceRef.current?.contains(event.target as Node)) setOpenMenu("");
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  const toggleMenu = (id: string) => setOpenMenu((current) => current === id ? "" : id);
  const toggleRail = () => {
    if (expanded) {
      setExpanded(false);
      setOpenMenu("");
      return;
    }
    setExpanded(true);
  };

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
    { label: "Diagnóstico", icon: Bug, action: () => { setActivity("run"); useIDEStore.getState().setBottomPanel("problems", true); } },
    { label: "Arquitectura", icon: Workflow, action: () => setActivity("architecture") }
  ];
  const helpMenu: MenuItem[] = [
    { label: "Acerca de IDE", icon: Info, action: () => setModal("about", true) },
    { label: "Atajos de teclado", icon: Keyboard, separator: true, action: () => setModal("shortcuts", true) }
  ];

  return (
    <aside className={`navigation-rail ${expanded ? "is-expanded" : ""}`} aria-label="Navegación principal">
      <div className="navigation-rail__surface" ref={surfaceRef}>
        <button
          className="rail-brand"
          type="button"
          onClick={toggleRail}
          title={expanded ? "Cerrar menú principal" : "Abrir menú principal"}
          aria-label={expanded ? "Cerrar menú principal" : "Abrir menú principal"}
          aria-expanded={expanded}
        >
          <img src="./favicon.svg" alt="" />
          <span><strong>IDE</strong><small>{isTauriRuntime() ? "DESKTOP" : "WEB"}</small></span>
          <ChevronRight size={14} />
        </button>

        <div className="navigation-rail__main">
          {expanded && (
            <div className="rail-menu-stack">
              <span className="rail-section-label">MENÚ</span>
              <RailMenu id="project" label="Proyecto" icon={FolderKanban} items={projectMenu} open={openMenu === "project"} onToggle={toggleMenu} />
              <RailMenu id="view" label="Vista" icon={LayoutDashboard} items={viewMenu} open={openMenu === "view"} onToggle={toggleMenu} />
              <RailMenu id="tools" label="Herramientas" icon={Wrench} items={toolsMenu} open={openMenu === "tools"} onToggle={toggleMenu} />
              <RailMenu id="help" label="Ayuda y acerca de" icon={CircleHelp} items={helpMenu} open={openMenu === "help"} onToggle={toggleMenu} />
            </div>
          )}

          {expanded && <span className="rail-section-label rail-section-label--workspace">ESPACIO DE TRABAJO</span>}
          {activities.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`rail-item ${active === id && panelOpen ? "is-active" : ""}`}
              onClick={() => setActivity(id)}
              title={label}
              aria-label={label}
            >
              <Icon size={19} strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="navigation-rail__foot">
          {!isTauriRuntime() && <button className="rail-item" type="button" onClick={() => setModal("downloads", true)} title="Descargar IDE"><CloudDownload size={19} /><span>Descargar IDE</span></button>}
          <button className="rail-item" type="button" onClick={() => setModal("settings", true)} title="Preferencias · Ctrl+, "><Settings size={19} /><span>Preferencias</span></button>
          <button className="rail-item rail-run" type="button" disabled={running} onClick={() => void runActiveFile()} title="Ejecutar archivo · F5">
            {running ? <span className="run-spinner" /> : <Play size={19} fill="currentColor" />}
            <span>{running ? "Ejecutando…" : "Ejecutar"}</span>
            {expanded && <kbd>F5</kbd>}
          </button>
        </div>
      </div>
    </aside>
  );
};

const StatusBar = () => {
  const buildRevision = (import.meta.env.VITE_BUILD_REVISION || "local").slice(0, 7);
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
        <span title={`Compilación ${buildRevision}`}>r{buildRevision}</span>
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
      <div className="workspace-grid">
        <NavigationRail />
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
