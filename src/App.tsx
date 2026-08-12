import { useEffect, useMemo, useState } from "react";
import { MainShell } from "./components/Shell";
import { DetachedEditor } from "./components/EditorWorkspace";
import { useIDEStore } from "./store/ideStore";
import { isDetachedWindow } from "./services/windowing";
import { runActiveFile, saveActiveFile } from "./services/ideActions";

const Splash = () => (
  <div className="splash" role="status" aria-label="Iniciando IDE">
    <div className="splash__mark">
      <img src="./favicon.svg" alt="" />
      <div className="splash__scan" />
    </div>
    <div>
      <p>ENTORNO HÍBRIDO</p>
      <h1>IDE</h1>
      <span>Preparando el espacio de trabajo</span>
    </div>
  </div>
);

export default function App() {
  const settings = useIDEStore((state) => state.settings);
  const setModal = useIDEStore((state) => state.setModal);
  const toggleLeftPanel = useIDEStore((state) => state.toggleLeftPanel);
  const toggleBottomPanel = useIDEStore((state) => state.toggleBottomPanel);
  const setContextMenu = useIDEStore((state) => state.setContextMenu);
  const detachedFileId = useMemo(isDetachedWindow, []);
  const [splash, setSplash] = useState(() => !detachedFileId && sessionStorage.getItem("ide:splash") !== "seen");

  useEffect(() => {
    const resolved = settings.theme === "auto"
      ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "paper" : "obsidian")
      : settings.theme;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = ["paper", "sand", "rose", "arctic"].includes(resolved) ? "light" : "dark";
    document.documentElement.classList.toggle("reduced-motion", settings.reducedMotion);
  }, [settings.theme, settings.reducedMotion]);

  useEffect(() => {
    if (!splash) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("ide:splash", "seen");
      setSplash(false);
    }, 1050);
    return () => window.clearTimeout(timer);
  }, [splash]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const primary = event.ctrlKey || event.metaKey;
      if (primary && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setModal("commandPalette", true);
      } else if (primary && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setModal("commandPalette", true);
      } else if (primary && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActiveFile();
      } else if (primary && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleLeftPanel();
      } else if (primary && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggleBottomPanel();
      } else if (event.key === "F5" || (primary && event.key === "Enter")) {
        event.preventDefault();
        void runActiveFile();
      } else if (primary && event.key === ",") {
        event.preventDefault();
        setModal("settings", true);
      } else if (event.key === "Escape") {
        setContextMenu(null);
        setModal("commandPalette", false);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [setContextMenu, setModal, toggleBottomPanel, toggleLeftPanel]);

  useEffect(() => {
    const previewConsole = (event: MessageEvent<{ source?: string; stream?: string; text?: string }>) => {
      if (event.data?.source !== "ide-preview" || !event.data.text || event.data.stream === "ready") return;
      useIDEStore.getState().addConsoleEntry({
        stream: event.data.stream === "error" || event.data.stream === "warn" ? "stderr" : "stdout",
        text: `[vista] ${event.data.text}`
      });
    };
    window.addEventListener("message", previewConsole);
    return () => window.removeEventListener("message", previewConsole);
  }, []);

  if (splash) return <Splash />;
  if (detachedFileId) return <DetachedEditor fileId={detachedFileId} />;
  return <MainShell />;
}
