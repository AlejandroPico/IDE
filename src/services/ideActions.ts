import { selectActiveFile, selectActiveProject, useIDEStore } from "../store/ideStore";
import { isTauriRuntime, openNativeWorkspace, saveNativeFile } from "./desktop";
import { importProjectJson, openBrowserFolder, triggerFilePicker } from "./projectIO";
import { runFile } from "./runtime";

export const runActiveFile = async (): Promise<void> => {
  const state = useIDEStore.getState();
  const project = selectActiveProject(state);
  const file = selectActiveFile(state);
  if (!file || state.running) return;
  state.setRunning(true);
  state.setBottomPanel("console", true);
  state.addConsoleEntry({ stream: "command", text: `▶ Ejecutar ${file.path}` });
  try {
    const result = await runFile(project, file, (message) => {
      useIDEStore.getState().addConsoleEntry({ stream: "system", text: message });
    });
    const current = useIDEStore.getState();
    if (result.stdout) current.addConsoleEntry({ stream: "stdout", text: result.stdout });
    if (result.stderr) current.addConsoleEntry({ stream: "stderr", text: result.stderr });
    current.addConsoleEntry({
      stream: "system",
      text: `${result.ok ? "Finalizado" : "Interrumpido"} · ${result.runtime} · ${Math.round(result.durationMs)} ms${result.exitCode !== null && result.exitCode !== undefined ? ` · código ${result.exitCode}` : ""}`
    });
    if (result.previewHtml) {
      current.setPreviewHtml(result.previewHtml);
      current.setBottomPanel("preview", true);
    }
  } catch (error) {
    useIDEStore.getState().addConsoleEntry({ stream: "stderr", text: error instanceof Error ? error.message : String(error) });
  } finally {
    useIDEStore.getState().setRunning(false);
  }
};

export const saveActiveFile = async (): Promise<void> => {
  const state = useIDEStore.getState();
  const project = selectActiveProject(state);
  const file = selectActiveFile(state);
  if (!file) return;
  try {
    if (project.nativeRoot && isTauriRuntime()) await saveNativeFile(project.nativeRoot, file.path, file.content);
    state.markFileSaved(file.id);
    state.addConsoleEntry({ stream: "system", text: `Guardado · ${file.path}${project.nativeRoot ? " en disco" : " en IndexedDB"}` });
  } catch (error) {
    state.addConsoleEntry({ stream: "stderr", text: `No se pudo guardar ${file.path}: ${error instanceof Error ? error.message : String(error)}` });
  }
};

export const saveAllFiles = async (): Promise<void> => {
  const state = useIDEStore.getState();
  const project = selectActiveProject(state);
  const dirtyFiles = Object.values(project.files).filter((file) => file.dirty);
  try {
    if (project.nativeRoot && isTauriRuntime()) {
      for (const file of dirtyFiles) await saveNativeFile(project.nativeRoot, file.path, file.content);
    }
    state.markAllSaved();
    state.addConsoleEntry({ stream: "system", text: `${dirtyFiles.length || "Sin"} archivo${dirtyFiles.length === 1 ? "" : "s"} guardado${dirtyFiles.length === 1 ? "" : "s"}.` });
  } catch (error) {
    state.addConsoleEntry({ stream: "stderr", text: `Guardado incompleto: ${error instanceof Error ? error.message : String(error)}` });
  }
};

export const openWorkspace = async (): Promise<void> => {
  const state = useIDEStore.getState();
  try {
    const projects = isTauriRuntime() ? await openNativeWorkspace() : await openBrowserFolder();
    if (projects?.length) {
      projects.forEach((project) => useIDEStore.getState().importProject(project));
      useIDEStore.getState().switchProject(projects[0]!.id);
      const files = projects.reduce((total, project) => total + Object.keys(project.files).length, 0);
      state.addConsoleEntry({ stream: "system", text: `${projects.length === 1 ? "Espacio de trabajo abierto" : `${projects.length} proyectos detectados`} · ${files} archivos de texto` });
    }
  } catch (error) {
    state.addConsoleEntry({ stream: "stderr", text: error instanceof Error ? error.message : String(error) });
  }
};

export const importWorkspaceFile = async (): Promise<void> => {
  const file = await triggerFilePicker(".json,.ide.json,application/json");
  if (!file) return;
  try {
    const project = await importProjectJson(file);
    useIDEStore.getState().importProject(project);
    useIDEStore.getState().addConsoleEntry({ stream: "system", text: `Proyecto importado · ${project.name}` });
  } catch (error) {
    useIDEStore.getState().addConsoleEntry({ stream: "stderr", text: error instanceof Error ? error.message : String(error) });
  }
};
