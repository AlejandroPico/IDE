/// <reference lib="webworker" />

import { analyseCode, type DiagnosticRequest } from "../core/diagnosticsEngine";

interface WorkerRequest extends DiagnosticRequest {
  requestId: number;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const diagnostics = analyseCode(event.data);
  self.postMessage({ requestId: event.data.requestId, fileId: event.data.fileId, diagnostics });
};

export {};
