import { lazy, ComponentType } from "react";

// Handles "Failed to fetch dynamically imported module" after a new deploy
// invalidates old chunk hashes. Retry once, then force a one-time reload.
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const RELOAD_KEY = "__lazy_chunk_reloaded__";
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isChunkErr =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("error loading dynamically imported module");
      if (isChunkErr) {
        try {
          // Retry once
          return await factory();
        } catch {
          if (typeof window !== "undefined" && !sessionStorage.getItem(RELOAD_KEY)) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            window.location.reload();
            // Return a never-resolving promise while reloading
            return new Promise(() => {}) as any;
          }
        }
      }
      throw err;
    }
  });
}
