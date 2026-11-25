"use client";

import { useSyncExternalStore } from "react";

/** Subscribe to a localStorage key (same-tab updates via a custom event, cross-tab via "storage"). */
const EVENT = "af-local-storage";

export function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function useLocalStorage(key: string): string | null | undefined {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      window.addEventListener(EVENT, cb);
      return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener(EVENT, cb);
      };
    },
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => undefined, // server / pre-hydration: unknown
  );
}

/** Whether <html> currently has the dark class. */
export function useIsDark(): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => null,
  );
}
