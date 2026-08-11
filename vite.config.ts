import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves from /IDE/, while Tauri needs relative asset paths.
  base: process.env.TAURI_ENV_PLATFORM ? "./" : "/IDE/",
  plugins: [react()],
  worker: { format: "es" },
  build: {
    target: "es2024",
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor") || id.includes("@monaco-editor/react")) return "monaco";
          if (id.includes("jszip")) return "archive";
          if (id.includes("@swc/wasm-web")) return "typescript-runtime";
          return undefined;
        }
      }
    }
  }
});
