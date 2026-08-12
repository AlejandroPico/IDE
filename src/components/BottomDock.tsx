import {
  CheckCircle2,
  CircleX,
  Clipboard,
  ExternalLink,
  Info,
  LoaderCircle,
  Maximize2,
  PanelBottomClose,
  Play,
  RotateCw,
  SendHorizontal,
  TerminalSquare,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { BottomPanelId, CodeDiagnostic } from "../core/types";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { buildWebPreview } from "../services/runtime";
import { executeTerminalCommand, TERMINAL_COMMANDS, terminalInitialCwd } from "../services/terminal";
import { isTauriRuntime } from "../services/desktop";

const panelTabs: Array<{ id: BottomPanelId; label: string }> = [
  { id: "console", label: "Consola" },
  { id: "problems", label: "Problemas" },
  { id: "preview", label: "Vista" },
  { id: "output", label: "Salida" }
];

const terminalDirectories = new Map<string, string>();
let terminalHistory: string[] = [];

const ConsolePanel = () => {
  const entries = useIDEStore((state) => state.consoleEntries);
  const project = useIDEStore(selectActiveProject);
  const addEntry = useIDEStore((state) => state.addConsoleEntry);
  const clearConsole = useIDEStore((state) => state.clearConsole);
  const [command, setCommand] = useState("");
  const [cwd, setCwd] = useState(() => terminalDirectories.get(project.id) ?? terminalInitialCwd(project));
  const [busy, setBusy] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = terminalDirectories.get(project.id) ?? terminalInitialCwd(project);
    setCwd(next);
  }, [project.id, project.nativeRoot, project.name]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, busy]);

  const prompt = useMemo(() => {
    const parts = cwd.split(/[\\/]/).filter(Boolean);
    return parts.at(-1) || (isTauriRuntime() ? cwd : project.name);
  }, [cwd, project.name]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = command.trim();
    if (!value || busy) return;
    setCommand("");
    setHistoryIndex(-1);
    terminalHistory = [...terminalHistory.filter((item) => item !== value), value].slice(-100);
    addEntry({ stream: "command", text: `${prompt}  ${value}` });
    setBusy(true);
    try {
      const result = await executeTerminalCommand(value, cwd, project);
      if (result.clear) clearConsole();
      if (result.stdout) addEntry({ stream: "stdout", text: result.stdout });
      if (result.stderr) addEntry({ stream: "stderr", text: result.stderr });
      if (result.cwd) {
        setCwd(result.cwd);
        terminalDirectories.set(project.id, result.cwd);
      }
      if (isTauriRuntime()) {
        addEntry({
          stream: "system",
          text: `${result.shell} · ${Math.round(result.durationMs)} ms${result.exitCode !== null && result.exitCode !== undefined ? ` · código ${result.exitCode}` : ""}`
        });
      }
    } catch (error) {
      addEntry({ stream: "stderr", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const keyboard = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      clearConsole();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!terminalHistory.length) return;
      const next = historyIndex < 0 ? terminalHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setCommand(terminalHistory[next] ?? "");
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex < 0) return;
      const next = historyIndex + 1;
      if (next >= terminalHistory.length) {
        setHistoryIndex(-1);
        setCommand("");
      } else {
        setHistoryIndex(next);
        setCommand(terminalHistory[next] ?? "");
      }
      return;
    }
    if (event.key === "Tab" && !isTauriRuntime()) {
      const token = command.trim().toLowerCase();
      const candidates = [...TERMINAL_COMMANDS, ...Object.values(project.files).map((file) => file.path)];
      const matches = candidates.filter((item) => item.toLowerCase().startsWith(token));
      if (matches.length === 1) {
        event.preventDefault();
        setCommand(matches[0]!);
      }
    }
  };

  return (
    <div className="console-panel" aria-live="polite" onMouseDown={() => inputRef.current?.focus()}>
      <div className="terminal-meta">
        <span><i />{isTauriRuntime() ? (navigator.platform.toLowerCase().includes("win") ? "CMD del sistema" : "Shell del sistema") : "IDE Web Shell"}</span>
        <code title={cwd}>{cwd}</code>
        <small>↑↓ historial · Ctrl L limpiar</small>
      </div>
      <div className="terminal-transcript" ref={transcriptRef}>
        {entries.length ? entries.map((entry) => (
          <div key={entry.id} className={`console-line console-line--${entry.stream}`}>
            <span className="console-line__time">{new Date(entry.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            <span className="console-line__mark">{entry.stream === "command" ? "❯" : entry.stream === "stderr" ? "!" : entry.stream === "system" ? "·" : ""}</span>
            <pre>{entry.text}</pre>
          </div>
        )) : <div className="dock-empty"><TerminalSquare size={26} /><span>Terminal preparada. Escribe <b>help</b> para ver los comandos.</span></div>}
      </div>
      <form className="terminal-input" onSubmit={submit}>
        <span>{prompt}</span><b>❯</b>
        <input
          ref={inputRef}
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={keyboard}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Comando de terminal"
          placeholder={isTauriRuntime() ? "Escribe un comando del sistema…" : "Escribe help, ls, open, run…"}
        />
        <button type="submit" disabled={busy || !command.trim()} title="Ejecutar comando">{busy ? <LoaderCircle className="spin" size={14} /> : <SendHorizontal size={14} />}</button>
      </form>
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
