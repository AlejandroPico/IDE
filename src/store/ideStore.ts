import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ActivityId,
  BottomPanelId,
  CodeDiagnostic,
  ConsoleEntry,
  ContextMenuState,
  EditorGroup,
  FloatingWindowState,
  IDESettings,
  IDEFile,
  ToolchainStatus,
  WorkspaceProject
} from "../core/types";
import { createId } from "../core/types";
import { detectLanguage } from "../core/languages";
import { createProjectFromTemplate, createWelcomeProject } from "../core/templates";
import { indexedDbStorage } from "../services/storage";

interface IDEState {
  projects: Record<string, WorkspaceProject>;
  activeProjectId: string;
  editorGroups: EditorGroup[];
  activeGroupId: string;
  selectedFileId: string | null;
  activeActivity: ActivityId;
  bottomPanel: BottomPanelId;
  leftPanelOpen: boolean;
  bottomPanelOpen: boolean;
  leftPanelWidth: number;
  bottomPanelHeight: number;
  diagnostics: Record<string, CodeDiagnostic[]>;
  consoleEntries: ConsoleEntry[];
  previewHtml: string;
  running: boolean;
  toolchains: ToolchainStatus[];
  settings: IDESettings;
  commandPaletteOpen: boolean;
  projectWizardOpen: boolean;
  settingsOpen: boolean;
  downloadsOpen: boolean;
  aboutOpen: boolean;
  shortcutsOpen: boolean;
  contextMenu: ContextMenuState | null;
  floatingWindows: FloatingWindowState[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  getProject: () => WorkspaceProject;
  createProject: (templateId: string, name: string) => WorkspaceProject;
  importProject: (project: WorkspaceProject) => void;
  switchProject: (projectId: string) => void;
  renameProject: (name: string) => void;
  removeProject: (projectId: string) => void;
  setNativeRoot: (root?: string) => void;
  createFile: (path: string, content?: string) => IDEFile | null;
  createFolderWithFile: (path: string) => IDEFile | null;
  updateFile: (fileId: string, content: string, remote?: boolean) => void;
  renameFile: (fileId: string, path: string) => void;
  deleteFile: (fileId: string) => void;
  markFileSaved: (fileId: string) => void;
  markAllSaved: () => void;
  openFile: (fileId: string, groupId?: string) => void;
  closeTab: (fileId: string, groupId?: string) => void;
  setActiveGroup: (groupId: string) => void;
  splitEditor: (fileId?: string) => void;
  closeEditorGroup: (groupId: string) => void;
  setSelectedFile: (fileId: string | null) => void;
  setActivity: (activity: ActivityId) => void;
  setBottomPanel: (panel: BottomPanelId, open?: boolean) => void;
  toggleLeftPanel: () => void;
  toggleBottomPanel: () => void;
  setLeftPanelWidth: (width: number) => void;
  setBottomPanelHeight: (height: number) => void;
  setDiagnostics: (fileId: string, diagnostics: CodeDiagnostic[]) => void;
  addConsoleEntry: (entry: Omit<ConsoleEntry, "id" | "timestamp">) => void;
  clearConsole: () => void;
  setPreviewHtml: (html: string) => void;
  setRunning: (running: boolean) => void;
  setToolchains: (toolchains: ToolchainStatus[]) => void;
  updateSettings: (settings: Partial<IDESettings>) => void;
  setModal: (
    modal: "commandPalette" | "projectWizard" | "settings" | "downloads" | "about" | "shortcuts",
    open: boolean
  ) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  openFloatingWindow: (window: Omit<FloatingWindowState, "id" | "zIndex">) => void;
  updateFloatingWindow: (id: string, patch: Partial<FloatingWindowState>) => void;
  focusFloatingWindow: (id: string) => void;
  closeFloatingWindow: (id: string) => void;
}

const defaultSettings: IDESettings = {
  theme: "obsidian",
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  autoSave: true,
  formatOnSave: false,
  reducedMotion: false,
  showWhitespace: false
};

const welcomeProject = createWelcomeProject();
const firstWelcomeFile = Object.values(welcomeProject.files).find((file) => file.path === "index.html")
  ?? Object.values(welcomeProject.files)[0]!;

const createDefaultGroup = (fileId: string | null): EditorGroup => ({
  id: createId("group"),
  tabs: fileId ? [fileId] : [],
  activeFileId: fileId
});

const normalisePath = (path: string): string =>
  path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/").trim();

const broadcastFileUpdate = (projectId: string, fileId: string, content: string): void => {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("alejandropico-ide-workspace");
  channel.postMessage({ type: "file:update", projectId, fileId, content, sender: window.name });
  channel.close();
};

export const useIDEStore = create<IDEState>()(
  persist(
    (set, get) => ({
      projects: { [welcomeProject.id]: welcomeProject },
      activeProjectId: welcomeProject.id,
      editorGroups: [createDefaultGroup(firstWelcomeFile.id)],
      activeGroupId: "",
      selectedFileId: firstWelcomeFile.id,
      activeActivity: "explorer",
      bottomPanel: "console",
      leftPanelOpen: true,
      bottomPanelOpen: true,
      leftPanelWidth: 290,
      bottomPanelHeight: 220,
      diagnostics: {},
      consoleEntries: [
        {
          id: createId("console"),
          stream: "system",
          text: "Núcleo preparado. Abre un archivo y pulsa Ejecutar.",
          timestamp: new Date().toISOString()
        }
      ],
      previewHtml: "",
      running: false,
      toolchains: [],
      settings: defaultSettings,
      commandPaletteOpen: false,
      projectWizardOpen: false,
      settingsOpen: false,
      downloadsOpen: false,
      aboutOpen: false,
      shortcutsOpen: false,
      contextMenu: null,
      floatingWindows: [],
      hydrated: false,

      setHydrated: (value) => set({ hydrated: value }),

      getProject: () => {
        const state = get();
        return state.projects[state.activeProjectId] ?? Object.values(state.projects)[0] ?? welcomeProject;
      },

      createProject: (templateId, name) => {
        const project = createProjectFromTemplate(templateId, name);
        const firstFile = Object.values(project.files)[0];
        const group = createDefaultGroup(firstFile?.id ?? null);
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          activeProjectId: project.id,
          editorGroups: [group],
          activeGroupId: group.id,
          selectedFileId: firstFile?.id ?? null,
          projectWizardOpen: false,
          diagnostics: {},
          previewHtml: ""
        }));
        return project;
      },

      importProject: (project) => {
        const firstFile = Object.values(project.files)[0];
        const group = createDefaultGroup(firstFile?.id ?? null);
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          activeProjectId: project.id,
          editorGroups: [group],
          activeGroupId: group.id,
          selectedFileId: firstFile?.id ?? null,
          diagnostics: {},
          previewHtml: ""
        }));
      },

      switchProject: (projectId) => {
        const project = get().projects[projectId];
        if (!project) return;
        const firstFile = Object.values(project.files)[0];
        const group = createDefaultGroup(firstFile?.id ?? null);
        set({
          activeProjectId: projectId,
          editorGroups: [group],
          activeGroupId: group.id,
          selectedFileId: firstFile?.id ?? null,
          diagnostics: {},
          previewHtml: ""
        });
      },

      renameProject: (name) => set((state) => {
        const project = state.projects[state.activeProjectId];
        if (!project || !name.trim()) return state;
        return {
          projects: {
            ...state.projects,
            [project.id]: { ...project, name: name.trim(), updatedAt: new Date().toISOString() }
          }
        };
      }),

      removeProject: (projectId) => set((state) => {
        if (Object.keys(state.projects).length <= 1) return state;
        const projects = { ...state.projects };
        delete projects[projectId];
        if (state.activeProjectId !== projectId) return { projects };
        const nextProject = Object.values(projects)[0]!;
        const firstFile = Object.values(nextProject.files)[0];
        const group = createDefaultGroup(firstFile?.id ?? null);
        return {
          projects,
          activeProjectId: nextProject.id,
          editorGroups: [group],
          activeGroupId: group.id,
          selectedFileId: firstFile?.id ?? null
        };
      }),

      setNativeRoot: (root) => set((state) => {
        const project = state.projects[state.activeProjectId];
        if (!project) return state;
        return {
          projects: {
            ...state.projects,
            [project.id]: { ...project, nativeRoot: root, updatedAt: new Date().toISOString() }
          }
        };
      }),

      createFile: (rawPath, content = "") => {
        const path = normalisePath(rawPath);
        if (!path || path.endsWith("/")) return null;
        const state = get();
        const project = state.getProject();
        if (Object.values(project.files).some((file) => file.path.toLowerCase() === path.toLowerCase())) return null;
        const id = createId("file");
        const file: IDEFile = {
          id,
          path,
          name: path.split("/").pop() ?? path,
          content,
          language: detectLanguage(path),
          dirty: true,
          size: new Blob([content]).size
        };
        set((current) => ({
          projects: {
            ...current.projects,
            [project.id]: {
              ...project,
              files: { ...project.files, [id]: file },
              updatedAt: new Date().toISOString()
            }
          },
          selectedFileId: id
        }));
        get().openFile(id);
        return file;
      },

      createFolderWithFile: (rawPath) => {
        const folder = normalisePath(rawPath).replace(/\/$/, "");
        return get().createFile(`${folder}/.keep`, "");
      },

      updateFile: (fileId, content, remote = false) => {
        const state = get();
        const project = state.getProject();
        const file = project.files[fileId];
        if (!file || file.readOnly || file.content === content) return;
        set((current) => ({
          projects: {
            ...current.projects,
            [project.id]: {
              ...project,
              files: {
                ...project.files,
                [fileId]: { ...file, content, dirty: true, size: new Blob([content]).size }
              },
              updatedAt: new Date().toISOString()
            }
          }
        }));
        if (!remote) broadcastFileUpdate(project.id, fileId, content);
      },

      renameFile: (fileId, rawPath) => set((state) => {
        const path = normalisePath(rawPath);
        const project = state.projects[state.activeProjectId];
        const file = project?.files[fileId];
        if (!project || !file || !path) return state;
        if (Object.values(project.files).some((candidate) => candidate.id !== fileId && candidate.path.toLowerCase() === path.toLowerCase())) return state;
        return {
          projects: {
            ...state.projects,
            [project.id]: {
              ...project,
              files: {
                ...project.files,
                [fileId]: {
                  ...file,
                  path,
                  name: path.split("/").pop() ?? path,
                  language: detectLanguage(path),
                  dirty: true
                }
              },
              updatedAt: new Date().toISOString()
            }
          }
        };
      }),

      deleteFile: (fileId) => set((state) => {
        const project = state.projects[state.activeProjectId];
        if (!project?.files[fileId]) return state;
        const files = { ...project.files };
        delete files[fileId];
        const editorGroups = state.editorGroups.map((group) => {
          const tabs = group.tabs.filter((id) => id !== fileId);
          return { ...group, tabs, activeFileId: group.activeFileId === fileId ? (tabs.at(-1) ?? null) : group.activeFileId };
        });
        return {
          projects: {
            ...state.projects,
            [project.id]: { ...project, files, updatedAt: new Date().toISOString() }
          },
          editorGroups,
          selectedFileId: state.selectedFileId === fileId ? null : state.selectedFileId
        };
      }),

      markFileSaved: (fileId) => set((state) => {
        const project = state.projects[state.activeProjectId];
        const file = project?.files[fileId];
        if (!project || !file) return state;
        return {
          projects: {
            ...state.projects,
            [project.id]: { ...project, files: { ...project.files, [fileId]: { ...file, dirty: false } } }
          }
        };
      }),

      markAllSaved: () => set((state) => {
        const project = state.projects[state.activeProjectId];
        if (!project) return state;
        const files = Object.fromEntries(Object.values(project.files).map((file) => [file.id, { ...file, dirty: false }]));
        return { projects: { ...state.projects, [project.id]: { ...project, files } } };
      }),

      openFile: (fileId, requestedGroupId) => set((state) => {
        const groupId = requestedGroupId ?? state.activeGroupId ?? state.editorGroups[0]?.id;
        const editorGroups = state.editorGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            tabs: group.tabs.includes(fileId) ? group.tabs : [...group.tabs, fileId],
            activeFileId: fileId
          };
        });
        return { editorGroups, activeGroupId: groupId ?? "", selectedFileId: fileId };
      }),

      closeTab: (fileId, requestedGroupId) => set((state) => {
        const groupId = requestedGroupId ?? state.activeGroupId;
        return {
          editorGroups: state.editorGroups.map((group) => {
            if (group.id !== groupId) return group;
            const index = group.tabs.indexOf(fileId);
            const tabs = group.tabs.filter((id) => id !== fileId);
            const next = tabs[Math.min(Math.max(index - 1, 0), tabs.length - 1)] ?? null;
            return { ...group, tabs, activeFileId: group.activeFileId === fileId ? next : group.activeFileId };
          })
        };
      }),

      setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

      splitEditor: (fileId) => set((state) => {
        if (state.editorGroups.length >= 3) return state;
        const sourceGroup = state.editorGroups.find((group) => group.id === state.activeGroupId) ?? state.editorGroups[0];
        const selected = fileId ?? sourceGroup?.activeFileId ?? null;
        const group = createDefaultGroup(selected);
        return { editorGroups: [...state.editorGroups, group], activeGroupId: group.id };
      }),

      closeEditorGroup: (groupId) => set((state) => {
        if (state.editorGroups.length <= 1) return state;
        const editorGroups = state.editorGroups.filter((group) => group.id !== groupId);
        return {
          editorGroups,
          activeGroupId: state.activeGroupId === groupId ? editorGroups[0]!.id : state.activeGroupId
        };
      }),

      setSelectedFile: (fileId) => set({ selectedFileId: fileId }),
      setActivity: (activity) => set((state) => ({ activeActivity: activity, leftPanelOpen: state.activeActivity === activity ? !state.leftPanelOpen : true })),
      setBottomPanel: (panel, open = true) => set({ bottomPanel: panel, bottomPanelOpen: open }),
      toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
      toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
      setLeftPanelWidth: (width) => set({ leftPanelWidth: Math.min(520, Math.max(210, width)) }),
      setBottomPanelHeight: (height) => set({ bottomPanelHeight: Math.min(520, Math.max(130, height)) }),
      setDiagnostics: (fileId, diagnostics) => set((state) => ({ diagnostics: { ...state.diagnostics, [fileId]: diagnostics } })),
      addConsoleEntry: (entry) => set((state) => ({
        consoleEntries: [...state.consoleEntries.slice(-499), { ...entry, id: createId("console"), timestamp: new Date().toISOString() }]
      })),
      clearConsole: () => set({ consoleEntries: [] }),
      setPreviewHtml: (html) => set({ previewHtml: html }),
      setRunning: (running) => set({ running }),
      setToolchains: (toolchains) => set({ toolchains }),
      updateSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
      setModal: (modal, open) => set({
        [`${modal}Open`]: open
      } as Partial<IDEState>),
      setContextMenu: (menu) => set({ contextMenu: menu }),
      openFloatingWindow: (window) => set((state) => ({
        floatingWindows: [
          ...state.floatingWindows,
          { ...window, id: createId("window"), zIndex: 100 + state.floatingWindows.length }
        ]
      })),
      updateFloatingWindow: (id, patch) => set((state) => ({
        floatingWindows: state.floatingWindows.map((window) => window.id === id ? { ...window, ...patch } : window)
      })),
      focusFloatingWindow: (id) => set((state) => {
        const zIndex = Math.max(100, ...state.floatingWindows.map((window) => window.zIndex)) + 1;
        return { floatingWindows: state.floatingWindows.map((window) => window.id === id ? { ...window, zIndex } : window) };
      }),
      closeFloatingWindow: (id) => set((state) => ({ floatingWindows: state.floatingWindows.filter((window) => window.id !== id) }))
    }),
    {
      name: "alejandropico-ide-state-v1",
      version: 1,
      storage: createJSONStorage(() => indexedDbStorage),
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        editorGroups: state.editorGroups,
        activeGroupId: state.activeGroupId,
        selectedFileId: state.selectedFileId,
        activeActivity: state.activeActivity,
        bottomPanel: state.bottomPanel,
        leftPanelOpen: state.leftPanelOpen,
        bottomPanelOpen: state.bottomPanelOpen,
        leftPanelWidth: state.leftPanelWidth,
        bottomPanelHeight: state.bottomPanelHeight,
        settings: state.settings
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.activeGroupId && state.editorGroups[0]) state.activeGroupId = state.editorGroups[0].id;
        state.setHydrated(true);
      }
    }
  )
);

if (!useIDEStore.getState().activeGroupId && useIDEStore.getState().editorGroups[0]) {
  useIDEStore.setState({ activeGroupId: useIDEStore.getState().editorGroups[0]!.id });
}

if (typeof BroadcastChannel !== "undefined") {
  const workspaceChannel = new BroadcastChannel("alejandropico-ide-workspace");
  workspaceChannel.onmessage = (event: MessageEvent<{ type: string; projectId: string; fileId: string; content: string }>) => {
    if (event.data.type !== "file:update") return;
    const state = useIDEStore.getState();
    if (state.activeProjectId !== event.data.projectId) return;
    state.updateFile(event.data.fileId, event.data.content, true);
  };
}

export const selectActiveProject = (state: IDEState): WorkspaceProject =>
  state.projects[state.activeProjectId] ?? Object.values(state.projects)[0] ?? welcomeProject;

export const selectActiveFile = (state: IDEState): IDEFile | null => {
  const project = selectActiveProject(state);
  const group = state.editorGroups.find((candidate) => candidate.id === state.activeGroupId) ?? state.editorGroups[0];
  return group?.activeFileId ? project.files[group.activeFileId] ?? null : null;
};

export const selectDiagnosticTotals = (state: IDEState): { errors: number; warnings: number } => {
  const diagnostics = Object.values(state.diagnostics).flat();
  return {
    errors: diagnostics.filter((item) => item.severity === "error").length,
    warnings: diagnostics.filter((item) => item.severity === "warning").length
  };
};
