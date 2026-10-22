import { create } from "zustand";
import { isIos, isStandalone } from "#/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** hidden: installed or unsupported · prompt: native prompt ready · ios: show Share steps */
type InstallMode = "hidden" | "prompt" | "ios";

interface InstallState {
  mode: InstallMode;
  deferred: BeforeInstallPromptEvent | null;
  iosHelpOpen: boolean;
  setIosHelpOpen: (open: boolean) => void;
  install: () => Promise<void>;
}

export const useInstallStore = create<InstallState>()((set, get) => ({
  mode: "hidden",
  deferred: null,
  iosHelpOpen: false,
  setIosHelpOpen: (iosHelpOpen) => set({ iosHelpOpen }),
  install: async () => {
    const { mode, deferred } = get();
    if (mode === "ios") return set({ iosHelpOpen: true });
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    set({ deferred: null, mode: choice.outcome === "accepted" ? "hidden" : "prompt" });
  },
}));

/**
 * Call once at startup. `beforeinstallprompt` fires a single time, early, so it
 * is captured here rather than in whichever component happens to be mounted.
 */
export function listenForInstall() {
  if (isStandalone()) return;
  if (isIos()) {
    useInstallStore.setState({ mode: "ios" });
    return;
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    useInstallStore.setState({ deferred: e as BeforeInstallPromptEvent, mode: "prompt" });
  });
  window.addEventListener("appinstalled", () => useInstallStore.setState({ mode: "hidden", deferred: null }));
}
