/// <reference lib="webworker" />

interface PyodideApi {
  loadPackagesFromImports: (code: string) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
}

interface PyodideModule {
  loadPyodide: (options: { indexURL: string }) => Promise<PyodideApi>;
}

const VERSION = "314.0.4";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;
let runtimePromise: Promise<PyodideApi> | null = null;

const loadRuntime = (): Promise<PyodideApi> => {
  runtimePromise ??= import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`)
    .then((module) => (module as PyodideModule).loadPyodide({ indexURL: INDEX_URL }));
  return runtimePromise;
};

self.onmessage = async (event: MessageEvent<{ id: string; code: string }>) => {
  const started = performance.now();
  const stdout: string[] = [];
  const stderr: string[] = [];
  try {
    self.postMessage({ id: event.data.id, type: "status", text: "Descargando Python 3.14 (solo la primera vez)…" });
    const pyodide = await loadRuntime();
    pyodide.setStdout({ batched: (text) => stdout.push(text) });
    pyodide.setStderr({ batched: (text) => stderr.push(text) });
    await pyodide.loadPackagesFromImports(event.data.code);
    const value = await pyodide.runPythonAsync(event.data.code);
    if (value !== undefined && value !== null && !stdout.length) stdout.push(String(value));
    self.postMessage({
      id: event.data.id,
      type: "result",
      ok: true,
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
      durationMs: performance.now() - started,
      runtime: `Pyodide ${VERSION} · Python 3.14`
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      type: "result",
      ok: false,
      stdout: stdout.join("\n"),
      stderr: [...stderr, error instanceof Error ? error.stack ?? error.message : String(error)].filter(Boolean).join("\n"),
      durationMs: performance.now() - started,
      runtime: `Pyodide ${VERSION} · Python 3.14`
    });
  }
};

export {};
