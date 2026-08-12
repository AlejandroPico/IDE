export type ThemeId =
  | "obsidian"
  | "graphite"
  | "aurora"
  | "violet"
  | "midnight"
  | "forest"
  | "paper"
  | "sand"
  | "rose"
  | "arctic"
  | "blueprint"
  | "auto";

export type ActivityId =
  | "project"
  | "structure"
  | "explorer"
  | "search"
  | "run"
  | "source"
  | "architecture";

export type BottomPanelId = "console" | "problems" | "preview" | "output";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface IDEFile {
  id: string;
  path: string;
  name: string;
  content: string;
  language: string;
  dirty: boolean;
  readOnly?: boolean;
  size?: number;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  templateId: string;
  files: Record<string, IDEFile>;
  nativeRoot?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EditorGroup {
  id: string;
  tabs: string[];
  activeFileId: string | null;
}

export interface CodeDiagnostic {
  id: string;
  fileId: string;
  filePath: string;
  message: string;
  source: string;
  severity: DiagnosticSeverity;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
}

export interface ConsoleEntry {
  id: string;
  stream: "command" | "stdout" | "stderr" | "system";
  text: string;
  timestamp: string;
}

export interface RunResult {
  ok: boolean;
  runtime: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  previewHtml?: string;
  exitCode?: number | null;
}

export interface TerminalResult {
  ok: boolean;
  shell: string;
  stdout: string;
  stderr: string;
  cwd: string;
  durationMs: number;
  exitCode?: number | null;
  clear?: boolean;
}

export interface ToolchainStatus {
  id: string;
  name: string;
  executable: string;
  available: boolean;
  version: string;
}

export interface GitFileChange {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  conflicted: boolean;
}

export interface GitStatus {
  available: boolean;
  repository: boolean;
  root: string;
  branch: string;
  upstream: string;
  ahead: number;
  behind: number;
  changes: GitFileChange[];
  message: string;
}

export interface GitActionResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export interface IDESettings {
  theme: ThemeId;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
  formatOnSave: boolean;
  reducedMotion: boolean;
  showWhitespace: boolean;
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  language: string;
  framework: string;
  category: "web" | "backend" | "systems" | "general" | "data";
  description: string;
  accent: string;
  webRunnable: boolean;
  desktopRunnable: boolean;
  tags: string[];
  files: TemplateFile[];
}

export interface SearchResult {
  fileId: string;
  filePath: string;
  line: number;
  column: number;
  preview: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  scope: "editor" | "file" | "folder" | "workspace" | "tab";
  targetId?: string;
  targetPath?: string;
}

export interface FloatingWindowState {
  id: string;
  title: string;
  kind: "preview" | "editor" | "diagnostics" | "toolchains";
  fileId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
}

export interface ReleaseAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  assets: ReleaseAsset[];
}

export const createId = (prefix = "id"): string => {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
};
