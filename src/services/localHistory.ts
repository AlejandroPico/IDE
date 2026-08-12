import { get, set } from "idb-keyval";
import type { WorkspaceProject } from "../core/types";

export interface LocalSnapshot {
  id: string;
  createdAt: string;
  label: string;
  files: Record<string, string>;
}

const keyFor = (projectId: string) => `alejandropico-ide-history:${projectId}`;

export const getLocalSnapshots = async (projectId: string): Promise<LocalSnapshot[]> =>
  (await get<LocalSnapshot[]>(keyFor(projectId))) ?? [];

export const createLocalSnapshot = async (project: WorkspaceProject, label?: string): Promise<LocalSnapshot[]> => {
  const current = await getLocalSnapshots(project.id);
  const snapshot: LocalSnapshot = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    label: label?.trim() || `Punto local ${current.length + 1}`,
    files: Object.fromEntries(Object.values(project.files).map((file) => [file.path, file.content]))
  };
  const next = [snapshot, ...current].slice(0, 8);
  await set(keyFor(project.id), next);
  return next;
};

export const changedSinceSnapshot = (project: WorkspaceProject, snapshot: LocalSnapshot): string[] => {
  const current = Object.fromEntries(Object.values(project.files).map((file) => [file.path, file.content]));
  return [...new Set([...Object.keys(current), ...Object.keys(snapshot.files)])]
    .filter((path) => current[path] !== snapshot.files[path])
    .sort();
};
