import { del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

export const indexedDbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  }
};

export const isStorageAvailable = (): boolean =>
  typeof indexedDB !== "undefined" && typeof localStorage !== "undefined";
