import type { IDEFile, WorkspaceProject } from "../core/types";
import { createId } from "../core/types";
import { detectLanguage } from "../core/languages";

interface FileSystemFileHandle {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
}

interface FileSystemDirectoryHandle {
  kind: "directory";
  name: string;
  values: () => AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  }
}

const IGNORED_FOLDERS = new Set([".git", "node_modules", "dist", "build", "target", "bin", "obj", ".idea", ".vscode"]);
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "html", "htm", "css", "scss", "less", "js", "jsx", "mjs", "cjs", "ts", "tsx", "json", "jsonc",
  "yaml", "yml", "xml", "svg", "py", "java", "kt", "kts", "c", "h", "cpp", "cc", "cxx", "hpp", "cs", "rs", "go",
  "php", "rb", "sh", "bash", "zsh", "ps1", "bat", "cmd", "sql", "toml", "ini", "properties", "gradle", "gitignore",
  "env", "editorconfig", "dockerfile", "makefile"
]);

const downloadBlob = (blob: Blob, name: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const slug = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "proyecto";

export const exportProjectJson = (project: WorkspaceProject): void => {
  const cleanProject: WorkspaceProject = {
    ...project,
    files: Object.fromEntries(Object.values(project.files).map((file) => [file.id, { ...file, dirty: false }]))
  };
  downloadBlob(
    new Blob([JSON.stringify({ format: "alejandropico-ide", version: 1, project: cleanProject }, null, 2)], { type: "application/json" }),
    `${slug(project.name)}.ide.json`
  );
};

export const exportProjectZip = async (project: WorkspaceProject): Promise<void> => {
  const { default: JSZip } = await import("jszip");
  const archive = new JSZip();
  for (const file of Object.values(project.files)) archive.file(file.path, file.content);
  archive.file(".ide-project.json", JSON.stringify({ name: project.name, templateId: project.templateId, exportedAt: new Date().toISOString() }, null, 2));
  const blob = await archive.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(blob, `${slug(project.name)}.zip`);
};

export const importProjectJson = async (file: File): Promise<WorkspaceProject> => {
  const data = JSON.parse(await file.text()) as { format?: string; project?: WorkspaceProject };
  if (data.format !== "alejandropico-ide" || !data.project?.files) throw new Error("El archivo no es un proyecto .ide.json válido.");
  const now = new Date().toISOString();
  return {
    ...data.project,
    id: createId("project"),
    nativeRoot: undefined,
    createdAt: data.project.createdAt || now,
    updatedAt: now,
    files: Object.fromEntries(Object.values(data.project.files).map((file) => {
      const id = createId("file");
      return [id, { ...file, id, dirty: false, language: detectLanguage(file.path) }];
    }))
  };
};

const looksTextual = (name: string, file: File): boolean => {
  if (file.type.startsWith("text/") || file.type.includes("json") || file.type.includes("xml") || file.type.includes("javascript")) return true;
  const lower = name.toLowerCase();
  const extension = lower.includes(".") ? lower.split(".").pop() ?? "" : lower;
  return TEXT_EXTENSIONS.has(extension) || ["dockerfile", "makefile", "license", "readme"].includes(lower);
};

const PROJECT_MARKERS = new Set([
  ".git", "package.json", "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts",
  "cargo.toml", "pyproject.toml", "requirements.txt", "go.mod", "composer.json", "gemfile", "makefile",
  "cmakelists.txt", ".ide-project.json"
]);

const looksLikeProjectDirectory = async (directory: FileSystemDirectoryHandle): Promise<boolean> => {
  for await (const entry of directory.values()) {
    const name = entry.name.toLowerCase();
    if (PROJECT_MARKERS.has(name) || name.endsWith(".sln") || name.endsWith(".csproj")) return true;
  }
  return false;
};

const browserDirectoryToProject = async (handle: FileSystemDirectoryHandle): Promise<WorkspaceProject> => {
  const files: Record<string, IDEFile> = {};
  let count = 0;
  const walk = async (directory: FileSystemDirectoryHandle, prefix = ""): Promise<void> => {
    for await (const entry of directory.values()) {
      if (count >= 2500) return;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === "directory") {
        if (!IGNORED_FOLDERS.has(entry.name)) await walk(entry, path);
        continue;
      }
      const file = await entry.getFile();
      if (file.size > 2 * 1024 * 1024 || !looksTextual(entry.name, file)) continue;
      const id = createId("file");
      files[id] = {
        id,
        path,
        name: entry.name,
        content: await file.text(),
        language: detectLanguage(path),
        dirty: false,
        size: file.size
      };
      count += 1;
    }
  };
  await walk(handle);
  const now = new Date().toISOString();
  return {
    id: createId("project"),
    name: handle.name,
    description: "Carpeta importada mediante File System Access API.",
    templateId: "browser-folder",
    files,
    createdAt: now,
    updatedAt: now
  };
};

export const openBrowserFolder = async (): Promise<WorkspaceProject[] | null> => {
  if (!window.showDirectoryPicker) throw new Error("Este navegador no ofrece acceso directo a carpetas. Usa Importar proyecto o la aplicación Desktop.");
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
  if (await looksLikeProjectDirectory(handle)) return [await browserDirectoryToProject(handle)];
  const detected: FileSystemDirectoryHandle[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === "directory" && !IGNORED_FOLDERS.has(entry.name) && await looksLikeProjectDirectory(entry)) detected.push(entry);
  }
  const roots = detected.length ? detected.sort((a, b) => a.name.localeCompare(b.name)) : [handle];
  return Promise.all(roots.map(browserDirectoryToProject));
};

export const triggerFilePicker = (accept: string): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
