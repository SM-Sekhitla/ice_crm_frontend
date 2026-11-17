import { useSyncExternalStore } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PwaState = {
  online: boolean;
  installed: boolean;
  installable: boolean;
  updateReady: boolean;
};
let prompt: InstallPrompt | null = null;
let registration: ServiceWorkerRegistration | undefined;
let started = false;
let applyingUpdate = false;
const listeners = new Set<() => void>();
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
let state: PwaState = {
  online: navigator.onLine,
  installed: standalone(),
  installable: false,
  updateReady: false,
};
function change(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
export function usePwa() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}
export function startPwa() {
  if (started) return;
  started = true;
  window.addEventListener("online", () => change({ online: true }));
  window.addEventListener("offline", () => change({ online: false }));
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    change({ installable: true });
  });
  window.addEventListener("appinstalled", () => {
    prompt = null;
    change({ installed: true, installable: false });
  });
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", () => {
      change({ installed: standalone() });
    });
  if (
    !import.meta.env.PROD ||
    !("serviceWorker" in navigator) ||
    !window.isSecureContext
  )
    return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (applyingUpdate) window.location.reload();
  });
  const register = async () => {
    try {
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      if (registration.waiting) change({ updateReady: true });
      registration.addEventListener("updatefound", () => {
        const worker = registration?.installing;
        worker?.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          )
            change({ updateReady: true });
        });
      });
      // Pick up deployments when returning to an installed app.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && navigator.onLine)
          void registration?.update().catch(() => {});
      });
    } catch {
      // Installation is optional; ordinary browser access remains available.
    }
  };
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
}
export async function installPwa() {
  const available = prompt;
  if (!available) return;
  await available.prompt();
  const choice = await available.userChoice;
  if (prompt === available) prompt = null;
  change({
    installable: false,
    ...(choice.outcome === "accepted" ? { installed: true } : {}),
  });
}
export function applyPwaUpdate() {
  if (!registration?.waiting) return;
  applyingUpdate = true;
  registration.waiting.postMessage({ type: "APPLY_UPDATE" });
}
