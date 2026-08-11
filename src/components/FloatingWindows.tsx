import {
  CheckCircle2,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Minus,
  PanelTop,
  X
} from "lucide-react";
import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { FloatingWindowState } from "../core/types";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { buildWebPreview } from "../services/runtime";
import { CodeEditor } from "./EditorWorkspace";

const FloatingContent = ({ windowState }: { windowState: FloatingWindowState }) => {
  const project = useIDEStore(selectActiveProject);
  const previewHtml = useIDEStore((state) => state.previewHtml);
  const diagnosticsMap = useIDEStore((state) => state.diagnostics);
  const diagnostics = useMemo(() => Object.values(diagnosticsMap).flat(), [diagnosticsMap]);
  const toolchains = useIDEStore((state) => state.toolchains);
  if (windowState.kind === "editor" && windowState.fileId) {
    const file = project.files[windowState.fileId];
    return file ? <CodeEditor file={file} /> : <div className="floating-empty">El archivo ya no existe.</div>;
  }
  if (windowState.kind === "diagnostics") {
    return <div className="floating-diagnostics">{diagnostics.length ? diagnostics.map((item) => <div key={item.id} className={item.severity}><strong>{item.message}</strong><span>{item.filePath}:{item.line}</span></div>) : <div className="floating-empty"><CheckCircle2 size={28} /> Sin incidencias</div>}</div>;
  }
  if (windowState.kind === "toolchains") {
    return <div className="floating-diagnostics">{toolchains.map((item) => <div key={item.id} className={item.available ? "hint" : "warning"}><strong>{item.name}</strong><span>{item.version || "No detectado"}</span></div>)}</div>;
  }
  return <iframe className="floating-preview" title={windowState.title} srcDoc={previewHtml || buildWebPreview(project)} sandbox="allow-scripts allow-forms allow-modals allow-popups" />;
};

const FloatingWindow = ({ windowState }: { windowState: FloatingWindowState }) => {
  const update = useIDEStore((state) => state.updateFloatingWindow);
  const focus = useIDEStore((state) => state.focusFloatingWindow);
  const close = useIDEStore((state) => state.closeFloatingWindow);
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const startDrag = (event: ReactPointerEvent) => {
    if (windowState.maximized) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, originX: windowState.x, originY: windowState.y };
    focus(windowState.id);
  };
  const move = (event: ReactPointerEvent) => {
    if (!dragRef.current) return;
    update(windowState.id, {
      x: Math.max(0, Math.min(window.innerWidth - 220, dragRef.current.originX + event.clientX - dragRef.current.x)),
      y: Math.max(54, Math.min(window.innerHeight - 90, dragRef.current.originY + event.clientY - dragRef.current.y))
    });
  };
  const stop = () => { dragRef.current = null; };
  const style = windowState.maximized
    ? { left: 52, top: 45, width: "calc(100vw - 60px)", height: "calc(100vh - 74px)", zIndex: windowState.zIndex }
    : { left: windowState.x, top: windowState.y, width: windowState.width, height: windowState.minimized ? 38 : windowState.height, zIndex: windowState.zIndex };
  return (
    <section className={`floating-window ${windowState.minimized ? "is-minimized" : ""} ${windowState.maximized ? "is-maximized" : ""}`} style={style} onPointerDown={() => focus(windowState.id)}>
      <header onPointerDown={startDrag} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>
        <GripHorizontal size={16} /><span>{windowState.title}</span><small>VENTANA INTERNA</small>
        <div>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => update(windowState.id, { minimized: !windowState.minimized })} title={windowState.minimized ? "Restaurar" : "Minimizar"}>{windowState.minimized ? <PanelTop size={13} /> : <Minus size={13} />}</button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => update(windowState.id, { maximized: !windowState.maximized, minimized: false })} title="Maximizar">{windowState.maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => close(windowState.id)} title="Cerrar"><X size={14} /></button>
        </div>
      </header>
      {!windowState.minimized && <div className="floating-window__content"><FloatingContent windowState={windowState} /></div>}
    </section>
  );
};

export function FloatingWindows() {
  const windows = useIDEStore((state) => state.floatingWindows);
  return <>{windows.map((windowState) => <FloatingWindow key={windowState.id} windowState={windowState} />)}</>;
}
