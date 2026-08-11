import {
  Braces,
  Clipboard,
  Copy,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Play,
  Save,
  Scissors,
  SearchCode,
  SplitSquareHorizontal,
  Sparkles,
  Trash2,
  Type,
  WandSparkles
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { ComponentType } from "react";
import { selectActiveProject, useIDEStore } from "../store/ideStore";
import { detachEditor } from "../services/windowing";
import { openWorkspace, runActiveFile, saveActiveFile } from "../services/ideActions";

interface ContextAction {
  label: string;
  icon: ComponentType<{ size?: number }>;
  shortcut?: string;
  danger?: boolean;
  separator?: boolean;
  action: () => void | Promise<void>;
}

const editorAction = (action: string): void => {
  window.dispatchEvent(new CustomEvent("ide:editor-action", { detail: { action } }));
};

export function ContextMenu() {
  const menu = useIDEStore((state) => state.contextMenu);
  const project = useIDEStore(selectActiveProject);
  const setContextMenu = useIDEStore((state) => state.setContextMenu);
  const createFile = useIDEStore((state) => state.createFile);
  const createFolderWithFile = useIDEStore((state) => state.createFolderWithFile);
  const deleteFile = useIDEStore((state) => state.deleteFile);
  const renameFile = useIDEStore((state) => state.renameFile);
  const openFile = useIDEStore((state) => state.openFile);
  const splitEditor = useIDEStore((state) => state.splitEditor);
  const setModal = useIDEStore((state) => state.setModal);
  const openFloatingWindow = useIDEStore((state) => state.openFloatingWindow);
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [inputMode, setInputMode] = useState<"rename" | "file" | "folder" | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    setInputMode(null);
    setDeleteArmed(false);
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({ x: Math.min(menu.x, window.innerWidth - rect.width - 8), y: Math.min(menu.y, window.innerHeight - rect.height - 28) });
  }, [menu, inputMode, deleteArmed]);

  if (!menu) return null;
  const targetFile = menu.targetId ? project.files[menu.targetId] : undefined;
  const closeAfter = (action: () => void | Promise<void>) => async () => {
    await action();
    setContextMenu(null);
  };
  const detach = async () => {
    if (!targetFile) return;
    const opened = await detachEditor(targetFile.id, targetFile.name);
    if (!opened) openFloatingWindow({ title: targetFile.name, kind: "editor", fileId: targetFile.id, x: 140, y: 90, width: 820, height: 580, minimized: false, maximized: false });
  };
  const deleteTarget = () => {
    if (!deleteArmed) { setDeleteArmed(true); return; }
    if (menu.scope === "folder" && menu.targetPath) {
      Object.values(project.files).filter((file) => file.path.startsWith(`${menu.targetPath}/`)).forEach((file) => deleteFile(file.id));
    } else if (targetFile) deleteFile(targetFile.id);
    setContextMenu(null);
  };

  const commonEditor: ContextAction[] = [
    { label: "Ejecutar archivo", icon: Play, shortcut: "F5", action: closeAfter(runActiveFile) },
    { label: "Ir a definición", icon: SearchCode, shortcut: "F12", separator: true, action: closeAfter(() => editorAction("definition")) },
    { label: "Renombrar símbolo", icon: Type, shortcut: "F2", action: closeAfter(() => editorAction("rename")) },
    { label: "Formatear documento", icon: WandSparkles, shortcut: "Shift Alt F", action: closeAfter(() => editorAction("format")) },
    { label: "Cortar", icon: Scissors, shortcut: "Ctrl X", separator: true, action: closeAfter(() => editorAction("cut")) },
    { label: "Copiar", icon: Copy, shortcut: "Ctrl C", action: closeAfter(() => editorAction("copy")) },
    { label: "Pegar", icon: Clipboard, shortcut: "Ctrl V", action: closeAfter(() => editorAction("paste")) }
  ];
  const fileActions: ContextAction[] = [
    { label: "Abrir", icon: FolderOpen, action: closeAfter(() => targetFile && openFile(targetFile.id)) },
    { label: "Abrir en otra ventana", icon: ExternalLink, action: closeAfter(detach) },
    { label: "Abrir a un lado", icon: SplitSquareHorizontal, action: closeAfter(() => targetFile && splitEditor(targetFile.id)) },
    { label: "Renombrar ruta", icon: Type, shortcut: "F2", separator: true, action: () => setInputMode("rename") },
    { label: deleteArmed ? "Pulsa de nuevo para eliminar" : "Eliminar", icon: Trash2, danger: true, separator: true, action: deleteTarget }
  ];
  const folderActions: ContextAction[] = [
    { label: "Nuevo archivo aquí", icon: FilePlus2, action: () => setInputMode("file") },
    { label: "Nueva subcarpeta", icon: FolderPlus, action: () => setInputMode("folder") },
    { label: deleteArmed ? "Pulsa de nuevo para eliminar todo" : "Eliminar carpeta", icon: Trash2, danger: true, separator: true, action: deleteTarget }
  ];
  const workspaceActions: ContextAction[] = [
    { label: "Nuevo proyecto", icon: Sparkles, action: closeAfter(() => setModal("projectWizard", true)) },
    { label: "Nuevo archivo", icon: FilePlus2, action: () => setInputMode("file") },
    { label: "Nueva carpeta", icon: FolderPlus, action: () => setInputMode("folder") },
    { label: "Abrir carpeta", icon: FolderOpen, separator: true, action: closeAfter(openWorkspace) },
    { label: "Guardar", icon: Save, shortcut: "Ctrl S", action: closeAfter(saveActiveFile) },
    { label: "Ejecutar", icon: Play, shortcut: "F5", action: closeAfter(runActiveFile) },
    { label: "Paleta de órdenes", icon: Braces, shortcut: "Ctrl Shift P", separator: true, action: closeAfter(() => setModal("commandPalette", true)) }
  ];
  const actions = menu.scope === "editor" ? commonEditor : menu.scope === "file" || menu.scope === "tab" ? fileActions : menu.scope === "folder" ? folderActions : workspaceActions;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("value") ?? "").trim();
    if (!value) return;
    if (inputMode === "rename" && targetFile) renameFile(targetFile.id, value);
    if (inputMode === "file") createFile(menu.scope === "folder" && menu.targetPath ? `${menu.targetPath}/${value}` : value);
    if (inputMode === "folder") createFolderWithFile(menu.scope === "folder" && menu.targetPath ? `${menu.targetPath}/${value}` : value);
    setContextMenu(null);
  };

  return (
    <div className="context-menu" ref={ref} role="menu" style={{ left: position.x, top: position.y }} onPointerDown={(event) => event.stopPropagation()}>
      <div className="context-menu__header"><span>{menu.scope === "workspace" ? project.name : menu.targetPath ?? "Editor"}</span><small>{menu.scope}</small></div>
      {inputMode && (
        <form className="context-menu__input" onSubmit={submit}>
          <input autoFocus name="value" defaultValue={inputMode === "rename" ? targetFile?.path : ""} placeholder={inputMode === "file" ? "nuevo.ts" : inputMode === "folder" ? "carpeta" : "ruta/archivo.ext"} onKeyDown={(event) => event.key === "Escape" && setInputMode(null)} />
        </form>
      )}
      {!inputMode && actions.map((item, index) => {
        const Icon = item.icon;
        return <div key={`${item.label}-${index}`}>{item.separator && <div className="menu-separator" />}<button type="button" role="menuitem" className={item.danger ? "danger" : ""} onClick={() => void item.action()}><span><Icon size={15} />{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}</button></div>;
      })}
    </div>
  );
}
