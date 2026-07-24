import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";
import { errorMessage } from "@/lib/api";

export type UpdateStage =
  | "idle"
  | "checking"
  | "none"
  | "downloading"
  | "ready"
  | "installing"
  | "restart"
  | "error";

interface UpdaterState {
  stage: UpdateStage;
  version: string;
  body: string;
  percent: number | null;
  error: string;
  checkAndDownload: () => Promise<void>;
  applyUpdate: () => Promise<void>;
}

const UPDATES_ENABLED = import.meta.env.PROD && import.meta.env.MODE !== "store";

let downloadedUpdate: Update | null = null;
let activeCheck: Promise<void> | null = null;

async function closeDownloadedUpdate(): Promise<void> {
  const update = downloadedUpdate;
  downloadedUpdate = null;
  if (!update) return;

  try {
    await update.close();
  } catch {
    // The updater resource may already be released after a failed download.
  }
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  stage: "idle",
  version: "",
  body: "",
  percent: null,
  error: "",

  checkAndDownload: async () => {
    if (!UPDATES_ENABLED) {
      set({ stage: "none" });
      return;
    }
    if (activeCheck) return activeCheck;
    if (["checking", "downloading", "ready", "installing", "restart"].includes(get().stage)) {
      return;
    }

    const run = async () => {
      await closeDownloadedUpdate();
      set({
        stage: "checking",
        version: "",
        body: "",
        percent: null,
        error: "",
      });

      let update: Update | null = null;
      try {
        update = await check();
        if (!update) {
          set({ stage: "none" });
          return;
        }

        downloadedUpdate = update;
        set({
          stage: "downloading",
          version: update.version,
          body: update.body ?? "",
          percent: null,
        });

        let total = 0;
        let received = 0;
        await update.download((event) => {
          if (event.event === "Started") {
            total = event.data.contentLength ?? 0;
          } else if (event.event === "Progress") {
            received += event.data.chunkLength;
            set({
              percent:
                total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null,
            });
          }
        });

        set({ stage: "ready", percent: 100 });
      } catch (err) {
        if (downloadedUpdate === update) {
          await closeDownloadedUpdate();
        }
        set({
          stage: "error",
          percent: null,
          error: errorMessage(err),
        });
      }
    };

    activeCheck = run().finally(() => {
      activeCheck = null;
    });
    return activeCheck;
  },

  applyUpdate: async () => {
    const stage = get().stage;
    if (stage === "restart") {
      try {
        await relaunch();
      } catch (err) {
        set({ error: errorMessage(err) });
      }
      return;
    }
    if (stage !== "ready" || !downloadedUpdate) return;

    set({ stage: "installing", error: "" });
    try {
      await downloadedUpdate.install();
      set({ stage: "restart" });
      await relaunch();
    } catch (err) {
      set({
        stage: get().stage === "restart" ? "restart" : "ready",
        error: errorMessage(err),
      });
    }
  },
}));
