import {
  CheckCircle2,
  CircleX,
  Clipboard,
  ExternalLink,
  Info,
  Maximize2,
  PanelBottomClose,
  Play,
  RotateCw,
  TerminalSquare,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { useMemo } from "react";
import type { BottomPanelId, CodeDiagnostic } from "../core/types";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { buildWebPreview } from "../services/runtime";

const panelTabs: Array<{ id: BottomPanelId; label: string }> = [
  { id: "console", label: "Consola" },
  { id: "problems", label: "Problemas" },
  { id: "preview", label: "Vista" },
  { id: "output", label: "Salida" }
];

const ConsolePanel = () => {
  const entries = useIDEStore((state) => state.consoleEntries);
  return (
    <div className="console-panel" aria-live="polite">
      {entries.length ? entries.map((entry) => (
        <div key={entry.id} className={`console-line console-line--${entry.stream}`}>
          <span className="console-line__time">{new Date(entry.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <span className="console-line__mark">{entry.stream === "command" ? "❯" : entry.stream === "stderr" ? "!" : entry.stream === "system" ? "·" : ""}</span>
          <pre>{entry.text}</pre>
        </div>
      )) : <div className="dock-empty"><TerminalSquare size={26} /><span>La consola está vacía.</span></div>}
    </div>
  );
};

const DiagnosticIcon = ({ diagnostic }: { diagnostic: CodeDiagnostic }) => {
  if (diagnostic.severity === "error") return <CircleX size={15} />;
  if (diagnostic.severity === "warning") return <TriangleAlert size={15} />;
  if (diagnostic.severity === "hint") return <CheckCircle2 size={15} />;
  return <Info size={15} />;
};

const ProblemsPanel = () => {
  const diagnosticsMap = useIDEStore((state) => state.diagnostics);
  const diagnostics = useMemo(() => Object.values(diagnosticsMap).flat().sort((a, b) => {
    const priority = { error: 0, warning: 1, info: 2, hint: 3 };
    return priority[a.severity] - priority[b.severity] || a.filePath.localeCompare(b.filePath) || a.line - b.line;
  }), [diagnosticsMap]);
  const openFile = useIDEStore((state) => state.openFile);
  const reveal = (item: CodeDiagnostic) => {
    openFile(item.fileId);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("ide:reveal", { detail: { fileId: item.fileId, line: item.line, column: item.column } })), 80);
  };
  return (
    <div className="problems-panel">
      {diagnostics.length ? diagnostics.map((item) => (
        <button type="button" key={item.id} className={`problem-row problem-row--${item.severity}`} onClick={() => reveal(item)}>
          <DiagnosticIcon diagnostic={item} />
          <span className="problem-row__message"><strong>{item.message}</strong><small>{item.source}{item.code ? ` · ${item.code}` : ""}</small></span>
          <span className="problem-row__location">{item.filePath}<b>{item.line}:{item.column}</b></span>
        </button>
      )) : <div className="dock-empty dock-empty--success"><CheckCircle2 size={30} /><strong>Sin problemas detectados</strong><span>El analizador estructural y semántico está observando el archivo activo.</span></div>}
    </div>
  );
};

const PreviewPanel = () => {
  const project = useIDEStore(selectActiveProject);
  const previewHtml = useIDEStore((state) => state.previewHtml);
  const setPreviewHtml = useIDEStore((state) => state.setPreviewHtml);
  const html = previewHtml || buildWebPreview(project);
  const reload = () => {
    setPreviewHtml("");
    window.setTimeout(() => setPreviewHtml(buildWebPreview(useIDEStore.getState().getProject())), 0);
  };
  const external = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "ide-preview", "popup=yes,width=1100,height=780,resizable=yes");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <div className="preview-panel">
      <div className="preview-toolbar"><span><i />Vista aislada · Web Platform</span><div><button type="button" onClick={reload} title="Recargar"><RotateCw size={14} /></button><button type="button" onClick={external} title="Abrir en ventana"><ExternalLink size={14} /></button></div></div>
      <iframe title="Vista previa del proyecto" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals allow-popups" />
    </div>
  );
};

const OutputPanel = () => {
  const project = useIDEStore(selectActiveProject);
  const diagnosticsMap = useIDEStore((state) => state.diagnostics);
  const diagnostics = useMemo(() => Object.values(diagnosticsMap).flat(), [diagnosticsMap]);
  const languages = useMemo(() => new Set(Object.values(project.files).map((file) => file.language)), [project.files]);
  return (
    <div className="output-panel">
      <div className="output-summary">
        <div><small>PROYECTO</small><strong>{project.name}</strong><span>{Object.keys(project.files).length} archivos · {languages.size} lenguajes</span></div>
        <div><small>DIAGNÓSTICO</small><strong>{diagnostics.length ? `${diagnostics.length} incidencias` : "Limpio"}</strong><span>{diagnostics.filter((item) => item.severity === "error").length} errores · {diagnostics.filter((item) => item.severity === "warning").length} avisos</span></div>
        <div><small>PERSISTENCIA</small><strong>{project.nativeRoot ? "Sistema local" : "IndexedDB"}</strong><span>{project.nativeRoot ?? "Privado en este navegador"}</span></div>
      </div>
      <pre>{`IDE Core 0.1.0
Proyecto: ${project.name}
Plantilla: ${project.templateId}
Última actualización: ${new Date(project.updatedAt).toLocaleString("es-ES")}
Estado: preparado`}</pre>
    </div>
  );
};

export function BottomDock() {
  const active = useIDEStore((state) => state.bottomPanel);
  const diagnosticsMap = useIDEStore((state) => state.diagnostics);
  const diagnostics = useMemo(() => Object.values(diagnosticsMap).flat(), [diagnosticsMap]);
  const entries = useIDEStore((state) => state.consoleEntries);
  const running = useIDEStore((state) => state.running);
  const setBottomPanel = useIDEStore((state) => state.setBottomPanel);
  const toggleBottomPanel = useIDEStore((state) => state.toggleBottomPanel);
  const clearConsole = useIDEStore((state) => state.clearConsole);
  const openFloatingWindow = useIDEStore((state) => state.openFloatingWindow);
  const copyConsole = async () => navigator.clipboard.writeText(entries.map((entry) => entry.text).join("\n"));
  return (
    <div className="bottom-dock">
      <header className="dock-tabs">
        <nav>{panelTabs.map((tab) => <button key={tab.id} type="button" className={active === tab.id ? "is-active" : ""} onClick={() => setBottomPanel(tab.id, true)}>{tab.label}{tab.id === "problems" && diagnostics.length > 0 && <b>{diagnostics.length}</b>}</button>)}</nav>
        <div>
          {active === "console" && <><button type="button" onClick={() => void copyConsole()} title="Copiar consola"><Clipboard size={14} /></button><button type="button" onClick={clearConsole} title="Limpiar"><Trash2 size={14} /></button></>}
          {active === "preview" && <button type="button" onClick={() => openFloatingWindow({ title: "Vista del proyecto", kind: "preview", x: 170, y: 90, width: 900, height: 620, minimized: false, maximized: false })} title="Ventana flotante"><Maximize2 size={14} /></button>}
          <button type="button" onClick={toggleBottomPanel} title="Ocultar panel"><PanelBottomClose size={14} /></button>
        </div>
      </header>
      <div className="dock-body">
        {active === "console" && <ConsolePanel />}
        {active === "problems" && <ProblemsPanel />}
        {active === "preview" && <PreviewPanel />}
        {active === "output" && <OutputPanel />}
      </div>
      {running && <div className="dock-running"><span /><Play size={11} fill="currentColor" /> Ejecutando</div>}
    </div>
  );
}
