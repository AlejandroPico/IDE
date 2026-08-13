import {
  Bug,
  ChevronRight,
  CloudDownload,
  FolderKanban,
  FolderTree,
  GitBranch,
  PanelBottom,
  Play,
  Search,
  Settings,
  Sparkles,
  Workflow
} from "lucide-react";
import type { ComponentType, MouseEvent as ReactMouseEvent } from "react";
import { useMemo } from "react";
import type { ActivityId } from "../core/types";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { runActiveFile } from "../services/ideActions";
import { isTauriRuntime } from "../services/desktop";
import { SidePanel } from "./SidePanel";
import { EditorWorkspace } from "./EditorWorkspace";
import { BottomDock } from "./BottomDock";
import { ContextMenu } from "./ContextMenu";
import { FloatingWindows } from "./FloatingWindows";
import { AllModals } from "./Modals";

const activities: Array<{ id: ActivityId; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: "structure", label: "Estructura", icon: FolderTree },
  { id: "search", label: "Buscar en archivos", icon: Search },
  { id: "run", label: "Diagnóstico", icon: Bug },
  { id: "source", label: "Cambios", icon: GitBranch },
  { id: "architecture", label: "Arquitectura", icon: Workflow }
];

const NavigationRail = ({ onResize }: { onResize: (event: ReactMouseEvent) => void }) => {
  const active = useIDEStore((state) => state.activeActivity);
  const panelOpen = useIDEStore((state) => state.leftPanelOpen);
  const panelWidth = useIDEStore((state) => state.leftPanelWidth);
  const running = useIDEStore((state) => state.running);
  const setActivity = useIDEStore((state) => state.setActivity);
  const setModal = useIDEStore((state) => state.setModal);
  const toggleLeftPanel = useIDEStore((state) => state.toggleLeftPanel);

  return (
    <aside className={`navigation-rail ${panelOpen ? "is-expanded" : ""}`} style={panelOpen ? { width: panelWidth } : undefined} aria-label="Navegación principal">
      <div className="navigation-rail__surface">
        <button
          className="rail-brand"
          type="button"
          onClick={toggleLeftPanel}
          title={panelOpen ? "Contraer panel lateral" : "Abrir panel lateral"}
          aria-label={panelOpen ? "Contraer panel lateral" : "Abrir panel lateral"}
          aria-expanded={panelOpen}
        >
          <img src="./favicon.svg" alt="" />
          <span><strong>IDE</strong><small>{isTauriRuntime() ? "DESKTOP" : "WEB"}</small></span>
          <ChevronRight size={14} />
        </button>

        <div className="navigation-rail__body">
          <div className="navigation-rail__activity">
            <div className="navigation-rail__main">
              <button type="button" className={`rail-item ${active === "project" && panelOpen ? "is-active" : ""}`} onClick={() => setActivity("project")} title="Proyecto" aria-label="Proyecto">
                <FolderKanban size={19} strokeWidth={1.75} /><span>Proyecto</span>
              </button>
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
              </button>
            </div>
          </div>

          {panelOpen && <div className="navigation-rail__panel"><SidePanel /></div>}
        </div>
        {panelOpen && <button className="resize-handle resize-handle--x" type="button" aria-label="Redimensionar panel" onMouseDown={onResize} />}
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
        <NavigationRail onResize={beginHorizontalResize} />
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
