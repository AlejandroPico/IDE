import {
  Bug,
  ChevronRight,
  CloudDownload,
  FileArchive,
  FileCode2,
  FolderKanban,
  FolderOpen,
  FolderTree,
  GitBranch,
  PanelBottom,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Upload,
  Workflow
} from "lucide-react";
import type { ComponentType, MouseEvent as ReactMouseEvent } from "react";
import { useMemo, useState } from "react";
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

interface ActionMenuProps {
  label: string;
  items: MenuItem[];
}

const ActionMenu = ({ label, items }: ActionMenuProps) => (
  <div className="rail-menu__popover" role="menu" aria-label={`Acciones de ${label}`}>
    <header><span>{label}</span><small>ACCIONES</small></header>
    {items.map((item, index) => {
      const ItemIcon = item.icon;
      return (
        <div key={`${item.label}-${index}`}>
          {item.separator && <div className="menu-separator" />}
          <button type="button" role="menuitem" className={item.danger ? "danger" : ""} onClick={item.action}>
            <span>{ItemIcon && <ItemIcon size={15} />}{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        </div>
      );
    })}
  </div>
);

const activities: Array<{ id: ActivityId; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: "structure", label: "Estructura", icon: FolderTree },
  { id: "search", label: "Buscar en archivos", icon: Search },
  { id: "run", label: "Diagnóstico", icon: Bug },
  { id: "source", label: "Cambios", icon: GitBranch },
  { id: "architecture", label: "Arquitectura", icon: Workflow }
];

const NavigationRail = () => {
  const [expanded, setExpanded] = useState(false);
  const project = useIDEStore(selectActiveProject);
  const active = useIDEStore((state) => state.activeActivity);
  const panelOpen = useIDEStore((state) => state.leftPanelOpen);
  const running = useIDEStore((state) => state.running);
  const setActivity = useIDEStore((state) => state.setActivity);
  const setModal = useIDEStore((state) => state.setModal);
  const toggleLeftPanel = useIDEStore((state) => state.toggleLeftPanel);
  const toggleRail = () => {
    if (expanded && panelOpen) toggleLeftPanel();
    setExpanded((value) => !value);
  };
  const selectActivity = (activity: ActivityId) => {
    setActivity(activity);
    setExpanded(false);
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

  return (
    <aside className={`navigation-rail ${expanded ? "is-expanded" : ""}`} aria-label="Navegación principal">
      <div className="navigation-rail__surface">
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
          {expanded && <span className="rail-section-label rail-section-label--workspace">ESPACIO DE TRABAJO</span>}
          <div className="rail-activity-menu">
            <button
              type="button"
              className={`rail-item ${active === "project" && panelOpen ? "is-active" : ""}`}
              onClick={() => selectActivity("project")}
              title="Proyecto · coloca el puntero encima para ver sus acciones"
              aria-label="Proyecto"
              aria-haspopup="menu"
            >
              <FolderKanban size={19} strokeWidth={1.75} />
              <span>Proyecto</span>
              {expanded && <ChevronRight className="rail-item__chevron" size={13} />}
            </button>
            <ActionMenu label="Proyecto" items={projectMenu} />
          </div>
          {activities.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`rail-item ${active === id && panelOpen ? "is-active" : ""}`}
              onClick={() => selectActivity(id)}
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
  const bottomPanelOpen = useIDEStore((state) => state.bottomPanelOpen);
  const setBottomPanel = useIDEStore((state) => state.setBottomPanel);
  const toggleBottomPanel = useIDEStore((state) => state.toggleBottomPanel);
  return (
    <footer className="statusbar">
      <div>
        <span className="statusbar__branch"><GitBranch size={12} /> {project.nativeRoot ? "Git local" : "Historial local"}</span>
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
        <button
          type="button"
          className={`statusbar__panel-toggle ${bottomPanelOpen ? "is-active" : ""}`}
          onClick={toggleBottomPanel}
          title={bottomPanelOpen ? "Ocultar panel inferior" : "Mostrar panel inferior"}
          aria-label={bottomPanelOpen ? "Ocultar panel inferior" : "Mostrar panel inferior"}
          aria-pressed={bottomPanelOpen}
        ><PanelBottom size={12} /><span>Panel</span></button>
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
