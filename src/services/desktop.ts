import type { RunResult, ToolchainStatus, WorkspaceProject } from "../core/types";
import { createId } from "../core/types";
import { detectLanguage } from "../core/languages";

interface NativeFile {
  path: string;
  content: string;
  size: number;
  read_only: boolean;
}

interface NativeWorkspace {
  root: string;
  name: string;
  files: NativeFile[];
}

export const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const invokeDesktop = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  if (!isTauriRuntime()) throw new Error("Esta función solo está disponible en la aplicación Desktop.");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
};

export const openNativeWorkspace = async (): Promise<WorkspaceProject | null> => {
  const workspace = await invokeDesktop<NativeWorkspace | null>("open_workspace");
  if (!workspace) return null;
  const now = new Date().toISOString();
  const files = Object.fromEntries(workspace.files.map((nativeFile) => {
    const id = createId("file");
    return [id, {
      id,
      path: nativeFile.path,
      name: nativeFile.path.split("/").pop() ?? nativeFile.path,
      content: nativeFile.content,
      language: detectLanguage(nativeFile.path),
      dirty: false,
      readOnly: nativeFile.read_only,
      size: nativeFile.size
    }];
  }));
  return {
    id: createId("project"),
    name: workspace.name,
    description: "Espacio de trabajo local abierto desde la aplicación Desktop.",
    templateId: "native-folder",
    files,
    nativeRoot: workspace.root,
    createdAt: now,
    updatedAt: now
  };
};

export const saveNativeFile = async (root: string, path: string, content: string): Promise<void> => {
  await invokeDesktop("save_text_file", { root, path, content });
};

export const discoverToolchains = async (): Promise<ToolchainStatus[]> =>
  invokeDesktop<ToolchainStatus[]>("detect_toolchains");

export const runNativeFile = async (
  root: string | undefined,
  path: string,
  language: string,
  content: string
): Promise<RunResult> => invokeDesktop<RunResult>("run_source", { root, path, language, content });

export const detachNativeEditor = async (fileId: string, title: string): Promise<void> => {
  await invokeDesktop("open_detached_editor", { fileId, title });
};

export const getNativePlatform = async (): Promise<string> => {
  if (!isTauriRuntime()) return navigator.platform;
  return invokeDesktop<string>("host_platform");
};
