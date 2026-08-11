import { detachNativeEditor, isTauriRuntime } from "./desktop";

interface ScreenDetailed {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary?: boolean;
}

interface ScreenDetails {
  screens: ScreenDetailed[];
  currentScreen: ScreenDetailed;
}

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetails>;
  }
}

const detachedUrl = (fileId: string): string => {
  const url = new URL(window.location.href);
  url.searchParams.set("detached", fileId);
  url.searchParams.delete("welcome");
  return url.toString();
};

export const detachEditor = async (fileId: string, title: string): Promise<boolean> => {
  if (isTauriRuntime()) {
    await detachNativeEditor(fileId, title);
    return true;
  }

  let features = "popup=yes,width=980,height=720,resizable=yes,scrollbars=no";
  if (window.getScreenDetails) {
    try {
      const details = await window.getScreenDetails();
      const secondary = details.screens.find((screen) => screen !== details.currentScreen && !screen.isPrimary)
        ?? details.screens.find((screen) => screen !== details.currentScreen);
      if (secondary) {
        const width = Math.min(1200, secondary.availWidth);
        const height = Math.min(850, secondary.availHeight);
        features += `,left=${secondary.availLeft},top=${secondary.availTop},width=${width},height=${height}`;
      }
    } catch {
      // El permiso multimonitor es opcional; se conserva el popup normal.
    }
  }
  const detached = window.open(detachedUrl(fileId), `ide-file-${fileId}`, features);
  return detached !== null;
};

export const isDetachedWindow = (): string | null =>
  new URLSearchParams(window.location.search).get("detached");
