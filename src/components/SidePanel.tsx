import {
  Box,
  Braces,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDot,
  CodeXml,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Gauge,
  GitBranch,
  HardDrive,
  PackageOpen,
  Play,
  RefreshCw,
  Save,
  Search,
  ServerCog,
  Sparkles,
  TerminalSquare,
  Workflow,
  X
} from "lucide-react";
import { useDeferredValue, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import type { IDEFile, SearchResult } from "../core/types";
import { getLanguage, getLanguageForPath, languageBadge } from "../core/languages";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { discoverToolchains, isTauriRuntime } from "../services/desktop";
import { runActiveFile, saveAllFiles } from "../services/ideActions";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  fileId?: string;
  children: TreeNode[];
}

const buildTree = (files: IDEFile[]): TreeNode[] => {
  const root: TreeNode[] = [];
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      if (index === parts.length - 1) {
        current.push({ name: part, path, type: "file", fileId: file.id, children: [] });
      } else {
        let folder = current.find((item) => item.type === "folder" && item.name === part);
        if (!folder) {
          folder = { name: part, path, type: "folder", children: [] };
          current.push(folder);
        }
        current = folder.children;
      }
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => nodes
    .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1)
    .map((node) => ({ ...node, children: sort(node.children) }));
  return sort(root);
};

const TreeItem = ({ node, depth, expanded, toggle }: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
}) => {
  const project = useIDEStore(selectActiveProject);
  const selectedFileId = useIDEStore((state) => state.selectedFileId);
  const openFile = useIDEStore((state) => state.openFile);
  const setContextMenu = useIDEStore((state) => state.setContextMenu);
  const file = node.fileId ? project.files[node.fileId] : undefined;
  const isOpen = expanded.has(node.path);
  const language = file ? getLanguageForPath(file.path) : null;
  const context = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, scope: node.type, targetId: node.fileId, targetPath: node.path });
  };
  if (node.type === "folder") {
    return (
      <>
        <button className="tree-row tree-row--folder" style={{ paddingLeft: 8 + depth * 14 }} type="button" onClick={() => toggle(node.path)} onContextMenu={context}>
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {isOpen ? <FolderOpen size={15} /> : <Folder size={15} />}
          <span>{node.name}</span>
          <small>{node.children.length}</small>
        </button>
        {isOpen && node.children.map((child) => <TreeItem key={`${child.type}-${child.path}`} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} />)}
      </>
    );
  }
  return (
    <button
      className={`tree-row tree-row--file ${selectedFileId === node.fileId ? "is-selected" : ""}`}
      style={{ paddingLeft: 23 + depth * 14 }}
      type="button"
      onClick={() => node.fileId && openFile(node.fileId)}
      onContextMenu={context}
    >
      <span className="file-badge" style={{ color: language?.color }}>{languageBadge(node.path)}</span>
      <span>{node.name}</span>
      {file?.dirty && <CircleDot className="dirty-dot" size={10} fill="currentColor" />}
    </button>
  );
};

const ExplorerPanel = () => {
  const project = useIDEStore(selectActiveProject);
  const projects = useIDEStore((state) => state.projects);
  const switchProject = useIDEStore((state) => state.switchProject);
  const createFile = useIDEStore((state) => state.createFile);
  const createFolderWithFile = useIDEStore((state) => state.createFolderWithFile);
  const setModal = useIDEStore((state) => state.setModal);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["src", "app"]));
  const [creation, setCreation] = useState<"file" | "folder" | null>(null);
  const tree = useMemo(() => buildTree(Object.values(project.files)), [project.files]);
  const submitCreation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const path = String(data.get("path") ?? "").trim();
    if (path) {
      if (creation === "file") createFile(path);
      else createFolderWithFile(path);
    }
    setCreation(null);
  };
  return (
    <div className="panel-content explorer-panel">
      <div className="side-heading">
        <div><span>ESPACIO DE TRABAJO</span><strong>{project.name}</strong></div>
        <div className="side-heading__tools">
          <button type="button" onClick={() => setCreation("file")} title="Nuevo archivo"><FilePlus2 size={15} /></button>
          <button type="button" onClick={() => setCreation("folder")} title="Nueva carpeta"><FolderPlus size={15} /></button>
          <button type="button" onClick={() => setModal("projectWizard", true)} title="Nuevo proyecto"><PackageOpen size={15} /></button>
        </div>
      </div>
      {Object.keys(projects).length > 1 && (
        <label className="project-switcher">
          <span>Proyecto activo</span>
          <select value={project.id} onChange={(event) => switchProject(event.target.value)}>
            {Object.values(projects).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      <div className="explorer-summary">
        <span>{Object.keys(project.files).length} archivos</span>
        <span>{project.nativeRoot ? <><HardDrive size={11} /> Local</> : <><Sparkles size={11} /> Virtual</>}</span>
      </div>
      {creation && (
        <form className="inline-create" onSubmit={submitCreation}>
          {creation === "file" ? <FilePlus2 size={14} /> : <FolderPlus size={14} />}
          <input autoFocus name="path" placeholder={creation === "file" ? "src/nuevo.ts" : "src/componentes"} onKeyDown={(event) => event.key === "Escape" && setCreation(null)} />
          <button type="button" onClick={() => setCreation(null)}><X size={13} /></button>
        </form>
      )}
      <div className="file-tree">
        {tree.length ? tree.map((node) => (
          <TreeItem key={`${node.type}-${node.path}`} node={node} depth={0} expanded={expanded} toggle={(path) => setExpanded((current) => {
            const next = new Set(current);
            if (next.has(path)) next.delete(path); else next.add(path);
            return next;
          })} />
        )) : <div className="empty-panel"><FolderOpen size={30} /><p>Este proyecto no contiene archivos.</p></div>}
      </div>
    </div>
  );
};

const SearchPanel = () => {
  const project = useIDEStore(selectActiveProject);
  const openFile = useIDEStore((state) => state.openFile);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo<SearchResult[]>(() => {
    const needle = caseSensitive ? deferredQuery : deferredQuery.toLowerCase();
    if (!needle) return [];
    const matches: SearchResult[] = [];
    for (const file of Object.values(project.files)) {
      file.content.split("\n").forEach((line, index) => {
        const haystack = caseSensitive ? line : line.toLowerCase();
        const column = haystack.indexOf(needle);
        if (column >= 0 && matches.length < 300) matches.push({ fileId: file.id, filePath: file.path, line: index + 1, column: column + 1, preview: line.trim() });
      });
    }
    return matches;
  }, [caseSensitive, deferredQuery, project.files]);
  return (
    <div className="panel-content search-panel">
      <div className="side-heading"><div><span>BÚSQUEDA GLOBAL</span><strong>Contenido del proyecto</strong></div></div>
      <div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Texto en todos los archivos" autoFocus /><button type="button" className={caseSensitive ? "is-active" : ""} onClick={() => setCaseSensitive((value) => !value)} title="Distinguir mayúsculas">Aa</button></div>
      <div className="result-count">{query ? `${results.length} coincidencias` : "Escribe para buscar"}</div>
      <div className="search-results">
        {results.map((result, index) => (
          <button type="button" key={`${result.fileId}-${result.line}-${index}`} onClick={() => openFile(result.fileId)}>
            <span><strong>{result.filePath}</strong><small>L{result.line}:{result.column}</small></span>
            <code>{result.preview}</code>
          </button>
        ))}
      </div>
    </div>
  );
};

const RunPanel = () => {
  const project = useIDEStore(selectActiveProject);
  const groups = useIDEStore((state) => state.editorGroups);
  const activeGroupId = useIDEStore((state) => state.activeGroupId);
  const toolchains = useIDEStore((state) => state.toolchains);
  const setToolchains = useIDEStore((state) => state.setToolchains);
  const setBottomPanel = useIDEStore((state) => state.setBottomPanel);
  const [checking, setChecking] = useState(false);
  const activeFileId = groups.find((group) => group.id === activeGroupId)?.activeFileId;
  const activeFile = activeFileId ? project.files[activeFileId] : undefined;
  const language = activeFile ? getLanguage(activeFile.language) : null;
  const check = async () => {
    if (!isTauriRuntime()) return;
    setChecking(true);
    try { setToolchains(await discoverToolchains()); } finally { setChecking(false); }
  };
  return (
    <div className="panel-content run-panel">
      <div className="side-heading"><div><span>EJECUCIÓN</span><strong>One-click Run</strong></div></div>
      <div className="runtime-card">
        <div className="runtime-card__icon"><Play size={22} fill="currentColor" /></div>
        <div><small>ARCHIVO ACTIVO</small><strong>{activeFile?.name ?? "Ninguno"}</strong><span>{language?.label ?? "Abre un archivo"}</span></div>
      </div>
      {language && (
        <div className="capability-grid">
          <div><span>Navegador</span><strong className={language.webRuntime === "none" ? "is-muted" : "is-ok"}>{language.webRuntime === "none" ? "Requiere Desktop" : "Disponible"}</strong></div>
          <div><span>Desktop</span><strong className="is-ok">{language.desktopRuntime}</strong></div>
        </div>
      )}
      <button className="primary-wide" type="button" onClick={() => void runActiveFile()} disabled={!activeFile}><Play size={15} /> Ejecutar ahora <kbd>F5</kbd></button>
      <button className="secondary-wide" type="button" onClick={() => setBottomPanel("problems", true)}><Gauge size={15} /> Abrir diagnóstico</button>
      <div className="section-label"><span>RUNTIMES DEL SISTEMA</span>{isTauriRuntime() && <button type="button" onClick={() => void check()} title="Volver a detectar"><RefreshCw className={checking ? "spin" : ""} size={13} /></button>}</div>
      {!isTauriRuntime() ? (
        <div className="toolchain-list">
          <div><CodeXml size={15} /><span><strong>Web Platform</strong><small>HTML · CSS · JavaScript</small></span><CircleCheck size={15} /></div>
          <div><Braces size={15} /><span><strong>TypeScript 7</strong><small>Transpilación bajo demanda</small></span><CircleCheck size={15} /></div>
          <div><TerminalSquare size={15} /><span><strong>Python 3.14</strong><small>Pyodide WASM · carga perezosa</small></span><CircleCheck size={15} /></div>
          <p className="panel-note">La edición Desktop añade compiladores y frameworks instalados en tu equipo.</p>
        </div>
      ) : toolchains.length ? (
        <div className="toolchain-list">{toolchains.map((toolchain) => <div key={toolchain.id} className={!toolchain.available ? "is-unavailable" : ""}><ServerCog size={15} /><span><strong>{toolchain.name}</strong><small>{toolchain.version || toolchain.executable}</small></span>{toolchain.available ? <CircleCheck size={15} /> : <X size={15} />}</div>)}</div>
      ) : <button className="toolchain-empty" type="button" onClick={() => void check()}><ServerCog size={25} /><span>Detectar JDK, Python, .NET, Rust, C/C++ y otros toolchains</span></button>}
    </div>
  );
};

const SourcePanel = () => {
  const project = useIDEStore(selectActiveProject);
  const openFile = useIDEStore((state) => state.openFile);
  const dirty = Object.values(project.files).filter((file) => file.dirty);
  return (
    <div className="panel-content source-panel">
      <div className="side-heading"><div><span>CONTROL DE CAMBIOS</span><strong>Estado del trabajo</strong></div><GitBranch size={18} /></div>
      <div className="branch-card"><GitBranch size={16} /><div><small>RAMA</small><strong>main</strong></div><span>{project.nativeRoot ? "Repositorio local" : "Sesión virtual"}</span></div>
      <div className="section-label"><span>CAMBIOS · {dirty.length}</span></div>
      <div className="changed-files">
        {dirty.map((file) => <button key={file.id} type="button" onClick={() => openFile(file.id)}><span className="change-mark">M</span><span>{file.path}</span></button>)}
        {!dirty.length && <div className="empty-panel"><CircleCheck size={28} /><p>Todo está guardado.</p></div>}
      </div>
      <button className="primary-wide" type="button" disabled={!dirty.length} onClick={() => void saveAllFiles()}><Save size={15} /> Guardar todos los cambios</button>
      <p className="panel-note">En la web, cada edición se conserva en IndexedDB. En Desktop, Guardar escribe en el sistema de archivos real.</p>
    </div>
  );
};

const ArchitecturePanel = () => {
  const project = useIDEStore(selectActiveProject);
  const files = Object.values(project.files);
  const languageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach((file) => counts.set(file.language, (counts.get(file.language) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [files]);
  const folders = new Set(files.flatMap((file) => {
    const parts = file.path.split("/");
    return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
  }));
  const lines = files.reduce((sum, file) => sum + file.content.split("\n").length, 0);
  const total = files.length || 1;
  return (
    <div className="panel-content architecture-panel">
      <div className="side-heading"><div><span>MAPA DEL PROYECTO</span><strong>Arquitectura</strong></div><Workflow size={18} /></div>
      <div className="metric-grid"><div><strong>{files.length}</strong><span>archivos</span></div><div><strong>{folders.size}</strong><span>carpetas</span></div><div><strong>{lines.toLocaleString("es-ES")}</strong><span>líneas</span></div><div><strong>{languageCounts.length}</strong><span>lenguajes</span></div></div>
      <div className="section-label"><span>DISTRIBUCIÓN</span></div>
      <div className="language-bars">
        {languageCounts.map(([languageId, count]) => {
          const language = getLanguage(languageId);
          return <div key={languageId}><span><i style={{ background: language.color }} />{language.label}<small>{count}</small></span><div><i style={{ width: `${(count / total) * 100}%`, background: language.color }} /></div></div>;
        })}
      </div>
      <div className="section-label"><span>PUNTOS DE ENTRADA</span></div>
      <div className="entrypoints">
        {files.filter((file) => /(^|\/)(index|main|app|program|application)\.[^.]+$/i.test(file.path)).slice(0, 12).map((file) => <button key={file.id} type="button" onClick={() => useIDEStore.getState().openFile(file.id)}><Box size={14} /><span>{file.path}</span></button>)}
      </div>
    </div>
  );
};

export function SidePanel() {
  const activity = useIDEStore((state) => state.activeActivity);
  if (activity === "search") return <SearchPanel />;
  if (activity === "run") return <RunPanel />;
  if (activity === "source") return <SourcePanel />;
  if (activity === "architecture") return <ArchitecturePanel />;
  return <ExplorerPanel />;
}
