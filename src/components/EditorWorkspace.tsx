import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import {
  Blocks,
  Braces,
  ChevronRight,
  Code2,
  Download,
  ExternalLink,
  FileCode2,
  FolderOpen,
  MoreHorizontal,
  Play,
  Plus,
  Sparkles,
  SplitSquareHorizontal,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { CodeDiagnostic, EditorGroup, IDEFile } from "../core/types";
import { getLanguageForPath, languageBadge } from "../core/languages";
import { PROJECT_TEMPLATES } from "../core/templates";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { openWorkspace, runActiveFile, saveActiveFile } from "../services/ideActions";
import { detachEditor } from "../services/windowing";

const configureMonaco: BeforeMount = (monaco) => {
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2024,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    strict: true,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    noEmit: true
  });
  monaco.editor.defineTheme("ide-obsidian", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "668078", fontStyle: "italic" },
      { token: "keyword", foreground: "77e4c2" },
      { token: "string", foreground: "e8b967" },
      { token: "number", foreground: "c59bf0" },
      { token: "type", foreground: "77c8e9" }
    ],
    colors: {
      "editor.background": "#0b1513",
      "editor.foreground": "#d9eee7",
      "editorLineNumber.foreground": "#52645f",
      "editorLineNumber.activeForeground": "#9bbdb3",
      "editorCursor.foreground": "#7df7d0",
      "editor.selectionBackground": "#24584a88",
      "editor.inactiveSelectionBackground": "#203a3488",
      "editor.lineHighlightBackground": "#10201d",
      "editorIndentGuide.background1": "#23332f",
      "editorIndentGuide.activeBackground1": "#54746a",
      "editorGutter.background": "#0b1513"
    }
  });
  monaco.editor.defineTheme("ide-paper", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "778078", fontStyle: "italic" },
      { token: "keyword", foreground: "087b68" },
      { token: "string", foreground: "9a5a14" },
      { token: "number", foreground: "6944a6" },
      { token: "type", foreground: "17678f" }
    ],
    colors: { "editor.background": "#f6f3ea", "editor.foreground": "#182420", "editorCursor.foreground": "#087b68", "editor.selectionBackground": "#9ee8d0aa", "editor.lineHighlightBackground": "#eee9dc" }
  });
  monaco.editor.defineTheme("ide-blueprint", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "83b7d9", fontStyle: "italic" },
      { token: "keyword", foreground: "ffffff", fontStyle: "bold" },
      { token: "string", foreground: "ffd77d" },
      { token: "number", foreground: "a9f2ff" }
    ],
    colors: { "editor.background": "#083f66", "editor.foreground": "#eaf8ff", "editorCursor.foreground": "#ffd77d", "editor.selectionBackground": "#2c81ad", "editor.lineHighlightBackground": "#0d4a73", "editorLineNumber.foreground": "#7db4d2" }
  });
};

const markerSeverity = (monaco: typeof Monaco, severity: CodeDiagnostic["severity"]): Monaco.MarkerSeverity => {
  if (severity === "error") return monaco.MarkerSeverity.Error;
  if (severity === "warning") return monaco.MarkerSeverity.Warning;
  if (severity === "hint") return monaco.MarkerSeverity.Hint;
  return monaco.MarkerSeverity.Info;
};

const CodeEditor = ({ file, detached = false }: { file: IDEFile; detached?: boolean }) => {
  const project = useIDEStore(selectActiveProject);
  const settings = useIDEStore((state) => state.settings);
  const updateFile = useIDEStore((state) => state.updateFile);
  const setDiagnostics = useIDEStore((state) => state.setDiagnostics);
  const diagnostics = useIDEStore((state) => state.diagnostics[file.id] ?? []);
  const setContextMenu = useIDEStore((state) => state.setContextMenu);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const saveTimer = useRef<number | null>(null);
  const requestRef = useRef(0);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.focus();
  };

  useEffect(() => {
    const worker = new Worker(new URL("../workers/diagnostics.worker.ts", import.meta.url), { type: "module" });
    const timer = window.setTimeout(() => {
      const requestId = ++requestRef.current;
      worker.postMessage({
        requestId,
        fileId: file.id,
        filePath: file.path,
        language: file.language,
        content: file.content,
        workspacePaths: Object.values(project.files).map((item) => item.path)
      });
    }, 260);
    worker.onmessage = (event: MessageEvent<{ requestId: number; fileId: string; diagnostics: CodeDiagnostic[] }>) => {
      if (event.data.requestId === requestRef.current && event.data.fileId === file.id) setDiagnostics(file.id, event.data.diagnostics);
    };
    return () => { window.clearTimeout(timer); worker.terminate(); };
  }, [file.content, file.id, file.language, file.path, project.files, setDiagnostics]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    monaco.editor.setModelMarkers(model, "ide-core", diagnostics.map((item) => ({
      severity: markerSeverity(monaco, item.severity),
      message: item.message,
      source: item.source,
      code: item.code,
      startLineNumber: item.line,
      startColumn: item.column,
      endLineNumber: item.endLine ?? item.line,
      endColumn: item.endColumn ?? item.column + 1
    })));
  }, [diagnostics]);

  useEffect(() => {
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<{ fileId: string; line: number; column: number }>).detail;
      if (detail.fileId !== file.id || !editorRef.current) return;
      editorRef.current.revealLineInCenter(detail.line);
      editorRef.current.setPosition({ lineNumber: detail.line, column: detail.column });
      editorRef.current.focus();
    };
    window.addEventListener("ide:reveal", reveal);
    return () => window.removeEventListener("ide:reveal", reveal);
  }, [file.id]);

  useEffect(() => {
    const runEditorAction = (event: Event) => {
      const action = (event as CustomEvent<{ action: string }>).detail.action;
      const editor = editorRef.current;
      if (!editor) return;
      const actionMap: Record<string, string> = {
        definition: "editor.action.revealDefinition",
        rename: "editor.action.rename",
        format: "editor.action.formatDocument",
        cut: "editor.action.clipboardCutAction",
        copy: "editor.action.clipboardCopyAction",
        paste: "editor.action.clipboardPasteAction"
      };
      const editorActionId = actionMap[action];
      if (editorActionId) void editor.getAction(editorActionId)?.run();
    };
    window.addEventListener("ide:editor-action", runEditorAction);
    return () => window.removeEventListener("ide:editor-action", runEditorAction);
  }, []);

  const change = (value?: string) => {
    updateFile(file.id, value ?? "");
    if (settings.autoSave) {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void saveActiveFile(), 1100);
    }
  };

  const theme = settings.theme === "paper" ? "ide-paper" : settings.theme === "blueprint" ? "ide-blueprint" : "ide-obsidian";
  return (
    <div
      className={`code-editor ${detached ? "code-editor--detached" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ x: event.clientX, y: event.clientY, scope: "editor", targetId: file.id, targetPath: file.path });
      }}
    >
      <Editor
        beforeMount={configureMonaco}
        onMount={onMount}
        path={`${project.id}/${file.path}`}
        language={file.language}
        value={file.content}
        theme={theme}
        onChange={change}
        saveViewState
        loading={<div className="editor-loading"><Sparkles size={20} /> Preparando el editor inteligente…</div>}
        options={{
          automaticLayout: true,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
          fontLigatures: true,
          fontSize: settings.fontSize,
          lineHeight: Math.round(settings.fontSize * 1.65),
          tabSize: settings.tabSize,
          insertSpaces: true,
          wordWrap: settings.wordWrap ? "on" : "off",
          minimap: { enabled: settings.minimap, scale: 0.8, showSlider: "mouseover" },
          renderWhitespace: settings.showWhitespace ? "selection" : "none",
          smoothScrolling: !settings.reducedMotion,
          cursorSmoothCaretAnimation: settings.reducedMotion ? "off" : "on",
          cursorBlinking: settings.reducedMotion ? "solid" : "smooth",
          bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
          guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
          stickyScroll: { enabled: true },
          inlineSuggest: { enabled: true },
          suggest: { preview: true, showStatusBar: true },
          quickSuggestions: { other: true, comments: false, strings: true },
          formatOnPaste: true,
          formatOnType: true,
          padding: { top: 15, bottom: 30 },
          scrollBeyondLastLine: false,
          renderValidationDecorations: "on",
          accessibilitySupport: "auto"
        }}
      />
    </div>
  );
};

const WelcomeCanvas = () => {
  const setModal = useIDEStore((state) => state.setModal);
  return (
    <div className="welcome-canvas">
      <div className="welcome-canvas__hero">
        <span className="welcome-canvas__eyebrow"><Sparkles size={13} /> NÚCLEO MODULAR PREPARADO</span>
        <h1>Código sin fricción.<br /><em>En cualquier plataforma.</em></h1>
        <p>Un espacio de trabajo local y privado, con ejecución real, diagnóstico continuo y proyectos multilenguaje.</p>
        <div>
          <button type="button" className="primary-action" onClick={() => setModal("projectWizard", true)}><Plus size={16} /> Crear proyecto</button>
          <button type="button" className="secondary-action" onClick={() => void openWorkspace()}><FolderOpen size={16} /> Abrir carpeta</button>
        </div>
      </div>
      <div className="welcome-canvas__templates">
        <div className="welcome-section-title"><span>INICIOS RÁPIDOS</span><button type="button" onClick={() => setModal("projectWizard", true)}>Ver todos <ChevronRight size={13} /></button></div>
        <div className="quick-templates">
          {PROJECT_TEMPLATES.slice(0, 6).map((template) => (
            <button key={template.id} type="button" onClick={() => setModal("projectWizard", true)} style={{ "--template-accent": template.accent } as React.CSSProperties}>
              <span><Code2 size={18} /></span><strong>{template.name}</strong><small>{template.framework}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="welcome-canvas__facts">
        <div><Braces size={18} /><span><strong>20+</strong> lenguajes detectados</span></div>
        <div><Blocks size={18} /><span><strong>Multi</strong> ventana y monitor</span></div>
        <div><Download size={18} /><span><strong>3</strong> sistemas de escritorio</span></div>
      </div>
    </div>
  );
};

const EditorPane = ({ group }: { group: EditorGroup }) => {
  const project = useIDEStore(selectActiveProject);
  const activeGroupId = useIDEStore((state) => state.activeGroupId);
  const openFile = useIDEStore((state) => state.openFile);
  const closeTab = useIDEStore((state) => state.closeTab);
  const setActiveGroup = useIDEStore((state) => state.setActiveGroup);
  const splitEditor = useIDEStore((state) => state.splitEditor);
  const closeEditorGroup = useIDEStore((state) => state.closeEditorGroup);
  const renameFile = useIDEStore((state) => state.renameFile);
  const setContextMenu = useIDEStore((state) => state.setContextMenu);
  const openFloatingWindow = useIDEStore((state) => state.openFloatingWindow);
  const [renaming, setRenaming] = useState<string | null>(null);
  const file = group.activeFileId ? project.files[group.activeFileId] : undefined;
  const detach = async () => {
    if (!file) return;
    const opened = await detachEditor(file.id, file.name);
    if (!opened) openFloatingWindow({ title: file.name, kind: "editor", fileId: file.id, x: 160, y: 100, width: 820, height: 580, minimized: false, maximized: false });
  };
  return (
    <section className={`editor-pane ${group.id === activeGroupId ? "is-active" : ""}`} onPointerDown={() => setActiveGroup(group.id)}>
      <div className="tabbar">
        <div className="tabbar__tabs">
          {group.tabs.map((fileId) => {
            const tabFile = project.files[fileId];
            if (!tabFile) return null;
            const language = getLanguageForPath(tabFile.path);
            return (
              <button
                type="button"
                key={fileId}
                className={`editor-tab ${group.activeFileId === fileId ? "is-active" : ""}`}
                onClick={() => openFile(fileId, group.id)}
                onDoubleClick={() => setRenaming(fileId)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ x: event.clientX, y: event.clientY, scope: "tab", targetId: fileId, targetPath: tabFile.path });
                }}
              >
                <span className="file-badge" style={{ color: language.color }}>{languageBadge(tabFile.path)}</span>
                {renaming === fileId ? (
                  <input
                    autoFocus
                    defaultValue={tabFile.path}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={(event) => { renameFile(fileId, event.target.value); setRenaming(null); }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") { renameFile(fileId, event.currentTarget.value); setRenaming(null); }
                      if (event.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : <span>{tabFile.name}</span>}
                {tabFile.dirty && <i className="tab-dirty" />}
                <span
                  className="tab-close"
                  role="button"
                  tabIndex={0}
                  aria-label={`Cerrar ${tabFile.name}`}
                  onClick={(event) => { event.stopPropagation(); closeTab(fileId, group.id); }}
                  onKeyDown={(event) => event.key === "Enter" && closeTab(fileId, group.id)}
                ><X size={12} /></span>
              </button>
            );
          })}
        </div>
        <div className="tabbar__actions">
          <button type="button" onClick={() => splitEditor(file?.id)} title="Dividir editor"><SplitSquareHorizontal size={15} /></button>
          <button type="button" onClick={() => void detach()} disabled={!file} title="Desacoplar a otra ventana"><ExternalLink size={15} /></button>
          {useIDEStore.getState().editorGroups.length > 1 && <button type="button" onClick={() => closeEditorGroup(group.id)} title="Cerrar grupo"><X size={15} /></button>}
          <button type="button" title="Más acciones"><MoreHorizontal size={15} /></button>
        </div>
      </div>
      {file ? (
        <>
          <div className="breadcrumbs"><span>{project.name}</span>{file.path.split("/").map((part, index) => <span key={`${part}-${index}`}><ChevronRight size={11} />{part}</span>)}<span className="breadcrumbs__language">{getLanguageForPath(file.path).label}</span></div>
          <CodeEditor file={file} />
        </>
      ) : <WelcomeCanvas />}
    </section>
  );
};

export function EditorWorkspace() {
  const groups = useIDEStore((state) => state.editorGroups);
  return (
    <div className={`editor-workspace editor-workspace--${groups.length}`}>
      {groups.map((group) => <EditorPane key={group.id} group={group} />)}
    </div>
  );
}

export function DetachedEditor({ fileId }: { fileId: string }) {
  const projects = useIDEStore((state) => state.projects);
  const file = useMemo(() => Object.values(projects).flatMap((project) => Object.values(project.files)).find((candidate) => candidate.id === fileId), [fileId, projects]);
  const setContextMenu = useIDEStore((state) => state.setContextMenu);
  const changeName = (event: ChangeEvent<HTMLInputElement>) => {
    document.title = `${event.target.value || file?.name || "Editor"} · IDE`;
  };
  if (!file) return <div className="detached-missing"><FileCode2 size={42} /><h1>Archivo no disponible</h1><p>La ventana principal puede haber cerrado el proyecto.</p><button type="button" onClick={() => window.close()}>Cerrar ventana</button></div>;
  return (
    <div className="detached-shell" onContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY, scope: "editor", targetId: file.id, targetPath: file.path }); }}>
      <header data-tauri-drag-region><img src="./favicon.svg" alt="" /><input defaultValue={file.name} onChange={changeName} aria-label="Título de la ventana" /><span>{getLanguageForPath(file.path).label}</span><button type="button" onClick={() => void runActiveFile()}><Play size={15} /> Ejecutar</button><button type="button" onClick={() => window.close()}><X size={16} /></button></header>
      <CodeEditor file={file} detached />
      <footer><span>{file.path}</span><span>{file.dirty ? "Cambios pendientes" : "Guardado"}</span><span>Sincronizado con la ventana principal</span></footer>
    </div>
  );
}

export { CodeEditor };
