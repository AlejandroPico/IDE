import type { IDEFile, RunResult, WorkspaceProject } from "../core/types";
import { createId } from "../core/types";
import { getLanguage } from "../core/languages";
import { isTauriRuntime, runNativeFile } from "./desktop";

let pythonWorker: Worker | null = null;

const runJavaScript = (code: string, runtime = "JavaScript · Web Worker"): Promise<RunResult> =>
  new Promise((resolve) => {
    const started = performance.now();
    const workerSource = `
      self.onmessage = async ({ data }) => {
        const stdout = [];
        const stderr = [];
        const stringify = (value) => {
          if (typeof value === "string") return value;
          try { return JSON.stringify(value, null, 2); } catch { return String(value); }
        };
        self.console = {
          log: (...args) => stdout.push(args.map(stringify).join(" ")),
          info: (...args) => stdout.push(args.map(stringify).join(" ")),
          warn: (...args) => stderr.push("WARN " + args.map(stringify).join(" ")),
          error: (...args) => stderr.push(args.map(stringify).join(" "))
        };
        try {
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const value = await new AsyncFunction(data.code)();
          if (value !== undefined) stdout.push(stringify(value));
          self.postMessage({ ok: true, stdout: stdout.join("\\n"), stderr: stderr.join("\\n") });
        } catch (error) {
          self.postMessage({ ok: false, stdout: stdout.join("\\n"), stderr: error?.stack || String(error) });
        }
      };
    `;
    const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    const worker = new Worker(url);
    const timeout = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ ok: false, runtime, stdout: "", stderr: "La ejecución superó el límite de 8 segundos y fue detenida.", durationMs: performance.now() - started, exitCode: null });
    }, 8000);
    worker.onmessage = (event: MessageEvent<{ ok: boolean; stdout: string; stderr: string }>) => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ ...event.data, runtime, durationMs: performance.now() - started, exitCode: event.data.ok ? 0 : 1 });
    };
    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ ok: false, runtime, stdout: "", stderr: event.message, durationMs: performance.now() - started, exitCode: 1 });
    };
    worker.postMessage({ code });
  });

const runTypeScript = async (code: string): Promise<RunResult> => {
  const started = performance.now();
  try {
    const swc = await import("@swc/wasm-web");
    await swc.default();
    const output = swc.transformSync(code, {
      filename: "main.ts",
      jsc: {
        parser: { syntax: "typescript", tsx: true, decorators: true },
        target: "es2022",
        transform: { react: { runtime: "automatic" } }
      },
      module: { type: "es6" },
      sourceMaps: false
    });
    return runJavaScript(output.code, "TypeScript 7 · SWC WebAssembly → JavaScript");
  } catch (error) {
    return {
      ok: false,
      runtime: "TypeScript 7 · SWC WebAssembly",
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - started,
      exitCode: 1
    };
  }
};

const pythonRuntime = (): Worker => {
  pythonWorker ??= new Worker(new URL("../workers/python.worker.ts", import.meta.url), { type: "module" });
  return pythonWorker;
};

const runPython = (code: string, onStatus?: (message: string) => void): Promise<RunResult> =>
  new Promise((resolve) => {
    const worker = pythonRuntime();
    const id = createId("python-run");
    const listener = (event: MessageEvent<{ id: string; type: string; text?: string } & RunResult>) => {
      if (event.data.id !== id) return;
      if (event.data.type === "status") {
        onStatus?.(event.data.text ?? "Preparando Python…");
        return;
      }
      worker.removeEventListener("message", listener);
      resolve(event.data);
    };
    worker.addEventListener("message", listener);
    worker.postMessage({ id, code });
  });

const escapeScriptClosingTag = (content: string): string => content.replace(/<\/script/gi, "<\\/script");

export const buildWebPreview = (project: WorkspaceProject, activeFile?: IDEFile): string => {
  const files = Object.values(project.files);
  const htmlFile = activeFile?.language === "html" ? activeFile : files.find((file) => /(^|\/)index\.html?$/i.test(file.path)) ?? files.find((file) => file.language === "html");
  let html = htmlFile?.content ?? "<!doctype html><html><body><main id=\"app\"></main></body></html>";
  const htmlDirectory = htmlFile?.path.split("/").slice(0, -1).join("/") ?? "";
  const relative = (path: string): string => htmlDirectory && path.startsWith(`${htmlDirectory}/`) ? path.slice(htmlDirectory.length + 1) : path;
  const cssFiles = files.filter((file) => file.language === "css");
  const jsFiles = files.filter((file) => file.language === "javascript" || file.language === "typescript");

  for (const file of cssFiles) {
    const path = relative(file.path);
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkPattern = new RegExp(`<link[^>]+href=["'](?:\\./)?${escaped}["'][^>]*>`, "gi");
    if (linkPattern.test(html)) html = html.replace(linkPattern, `<style data-ide-source="${file.path}">${file.content}</style>`);
    else html = html.replace(/<\/head>/i, `<style data-ide-source="${file.path}">${file.content}</style></head>`);
  }
  for (const file of jsFiles) {
    const path = relative(file.path);
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const scriptPattern = new RegExp(`<script[^>]+src=["'](?:\\./)?${escaped}["'][^>]*><\\/script>`, "gi");
    const source = file.language === "typescript"
      ? `console.warn("El archivo ${file.path} requiere transpilarse; ejecútalo desde su pestaña TypeScript.");`
      : escapeScriptClosingTag(file.content);
    if (scriptPattern.test(html)) html = html.replace(scriptPattern, `<script data-ide-source="${file.path}">${source}</script>`);
    else html = html.replace(/<\/body>/i, `<script data-ide-source="${file.path}">${source}</script></body>`);
  }
  const bridge = `<script>(function(){const send=(stream,args)=>parent.postMessage({source:"ide-preview",stream,text:args.map(v=>{try{return typeof v==="string"?v:JSON.stringify(v)}catch{return String(v)}}).join(" ")},"*");for(const key of ["log","info","warn","error"]){const original=console[key];console[key]=(...args)=>{send(key,args);original.apply(console,args)}}window.addEventListener("error",e=>send("error",[e.message]));parent.postMessage({source:"ide-preview",stream:"ready",text:"Vista preparada"},"*")})();<\/script>`;
  return html.replace(/<head>/i, `<head><base href="./">${bridge}`);
};

export const runFile = async (
  project: WorkspaceProject,
  file: IDEFile,
  onStatus?: (message: string) => void
): Promise<RunResult> => {
  const language = getLanguage(file.language);
  if (language.webRuntime === "browser") {
    const started = performance.now();
    return {
      ok: true,
      runtime: "Web Platform · iframe aislado",
      stdout: "Vista web generada.",
      stderr: "",
      durationMs: performance.now() - started,
      previewHtml: buildWebPreview(project, file),
      exitCode: 0
    };
  }
  if (language.webRuntime === "javascript") return runJavaScript(file.content);
  if (language.webRuntime === "typescript") return runTypeScript(file.content);
  if (language.webRuntime === "python") return runPython(file.content, onStatus);
  if (isTauriRuntime()) return runNativeFile(project.nativeRoot, file.path, file.language, file.content);
  return {
    ok: false,
    runtime: "Navegador",
    stdout: "",
    stderr: `${language.label} necesita ${language.desktopRuntime}. Abre este proyecto en IDE Desktop para compilarlo y ejecutarlo con el toolchain local.`,
    durationMs: 0,
    exitCode: null
  };
};
