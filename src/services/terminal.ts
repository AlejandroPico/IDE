import type { TerminalResult, WorkspaceProject } from "../core/types";
import { useIDEStore } from "../store/ideStore";
import { isTauriRuntime, runNativeTerminalCommand } from "./desktop";
import { runActiveFile, saveAllFiles } from "./ideActions";

export const TERMINAL_COMMANDS = [
  "help", "clear", "cls", "pwd", "cd", "ls", "dir", "cat", "type", "open",
  "run", "save", "projects", "theme", "echo", "date", "whoami"
];

export const terminalInitialCwd = (project: WorkspaceProject): string =>
  project.nativeRoot || `/${project.name.replaceAll("/", "-")}`;

const splitCommand = (value: string): string[] =>
  Array.from(value.matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g), (match) => match[1] ?? match[2] ?? match[3] ?? "");

const normaliseVirtualPath = (root: string, cwd: string, target = ""): string => {
  const source = target.startsWith("/") ? target : `${cwd}/${target}`;
  const parts: string[] = [];
  for (const part of source.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const resolved = `/${parts.join("/")}`;
  return resolved.startsWith(root) ? resolved : root;
};

const relativeToProject = (root: string, path: string): string =>
  path.slice(root.length).replace(/^\/+/, "");

const browserResult = (cwd: string, stdout = "", stderr = "", clear = false): TerminalResult => ({
  ok: !stderr,
  shell: "IDE Web Shell",
  stdout,
  stderr,
  cwd,
  durationMs: 0,
  exitCode: stderr ? 1 : 0,
  clear
});

const runBrowserCommand = async (commandLine: string, cwd: string, project: WorkspaceProject): Promise<TerminalResult> => {
  const [rawCommand = "", ...args] = splitCommand(commandLine);
  const command = rawCommand.toLowerCase();
  const root = terminalInitialCwd(project);
  const files = Object.values(project.files);
  const currentRelative = relativeToProject(root, cwd);

  if (command === "clear" || command === "cls") return browserResult(cwd, "", "", true);
  if (command === "help") return browserResult(cwd, [
    "IDE Web Shell · comandos disponibles",
    "",
    "  ls / dir [ruta]       Lista archivos y carpetas",
    "  cd <ruta>             Cambia la carpeta virtual",
    "  cat / type <archivo>  Muestra el contenido",
    "  open <archivo>        Abre el archivo en el editor",
    "  run                   Ejecuta el archivo activo",
    "  save                  Guarda todos los cambios",
    "  projects              Lista espacios de trabajo",
    "  theme <nombre>        Cambia el tema visual",
    "  pwd · echo · date · whoami · clear",
    "",
    "Para npm, Maven, Git, compiladores y comandos del sistema usa IDE Desktop."
  ].join("\n"));
  if (command === "pwd") return browserResult(cwd, cwd);
  if (command === "whoami") return browserResult(cwd, "developer@ide-web");
  if (command === "date") return browserResult(cwd, new Date().toString());
  if (command === "echo") return browserResult(cwd, args.join(" "));
  if (command === "projects") {
    const state = useIDEStore.getState();
    return browserResult(cwd, Object.values(state.projects).map((item) => `${item.id === state.activeProjectId ? "*" : " "} ${item.name}`).join("\n"));
  }
  if (command === "theme") {
    const theme = args[0] ?? "";
    const allowed = ["obsidian", "graphite", "aurora", "violet", "midnight", "forest", "paper", "sand", "rose", "arctic", "blueprint", "auto"] as const;
    if (!allowed.includes(theme as typeof allowed[number])) return browserResult(cwd, "", `Tema desconocido. Disponibles: ${allowed.join(", ")}`);
    useIDEStore.getState().updateSettings({ theme: theme as typeof allowed[number] });
    return browserResult(cwd, `Tema aplicado: ${theme}`);
  }
  if (command === "save") {
    await saveAllFiles();
    return browserResult(cwd, "Proyecto guardado en el almacenamiento local del navegador.");
  }
  if (command === "run") {
    await runActiveFile();
    return browserResult(cwd, "Ejecución enviada al runtime del IDE.");
  }
  if (command === "cd") {
    const next = args.length ? normaliseVirtualPath(root, cwd, args.join(" ")) : root;
    const relative = relativeToProject(root, next);
    const exists = !relative || files.some((file) => file.path.startsWith(`${relative}/`));
    return exists ? browserResult(next) : browserResult(cwd, "", `No existe la carpeta: ${args.join(" ")}`);
  }
  if (command === "ls" || command === "dir") {
    const target = normaliseVirtualPath(root, cwd, args.join(" "));
    const relative = relativeToProject(root, target);
    const entries = new Map<string, "archivo" | "carpeta">();
    for (const file of files) {
      if (relative && !file.path.startsWith(`${relative}/`) && file.path !== relative) continue;
      const rest = relative ? file.path.slice(relative.length).replace(/^\/+/, "") : file.path;
      if (!rest) continue;
      const [name, ...tail] = rest.split("/");
      entries.set(name!, tail.length ? "carpeta" : "archivo");
    }
    const output = [...entries].sort(([a], [b]) => a.localeCompare(b)).map(([name, kind]) => `${kind === "carpeta" ? "d" : "-"}  ${name}${kind === "carpeta" ? "/" : ""}`).join("\n");
    return output ? browserResult(cwd, output) : browserResult(cwd, "", `No hay contenido en ${target}`);
  }
  if (command === "cat" || command === "type" || command === "open") {
    if (!args.length) return browserResult(cwd, "", `Uso: ${command} <archivo>`);
    const target = relativeToProject(root, normaliseVirtualPath(root, cwd, args.join(" ")));
    const file = files.find((item) => item.path === target);
    if (!file) return browserResult(cwd, "", `No existe el archivo: ${target}`);
    if (command === "open") {
      useIDEStore.getState().openFile(file.id);
      return browserResult(cwd, `Abierto: ${file.path}`);
    }
    return browserResult(cwd, file.content);
  }

  const location = currentRelative ? `/${currentRelative}` : "/";
  return browserResult(cwd, "", `«${rawCommand}» no está disponible en Web Shell (${location}). Escribe help o usa IDE Desktop para comandos del sistema.`);
};

export const executeTerminalCommand = async (
  command: string,
  cwd: string,
  project: WorkspaceProject
): Promise<TerminalResult> => {
  if (["clear", "cls"].includes(command.trim().toLowerCase())) {
    return browserResult(cwd, "", "", true);
  }

  return isTauriRuntime()
    ? runNativeTerminalCommand(cwd || project.nativeRoot, command)
    : runBrowserCommand(command, cwd, project);
};
