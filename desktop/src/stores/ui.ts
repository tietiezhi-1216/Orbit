import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SettingsCategory =
  | "providers"
  | "systemPrompt"
  | "skills"
  | "mcp"
  | "permissions"
  | "dictationModel"
  | "dictationHotkey"
  | "dictationPrompt"
  | "appearance"
  | "update"
  | "about";

export const SIDEBAR_MIN_PX = 200;
export const SIDEBAR_MAX_PX = 480;
export const SIDEBAR_DEFAULT_PX = 256; // = shadcn's 16rem

export const clampSidebarWidth = (px: number): number =>
  Math.min(SIDEBAR_MAX_PX, Math.max(SIDEBAR_MIN_PX, Math.round(px)));

interface UiState {
  /** Settings dialog visibility + active category. */
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  openSettings: (category?: SettingsCategory) => void;
  closeSettings: () => void;
  setSettingsCategory: (category: SettingsCategory) => void;
  /** Agents management dialog; `editingAgentId` preselects one for editing. */
  agentsOpen: boolean;
  editingAgentId: string | null;
  openAgents: (agentId?: string) => void;
  closeAgents: () => void;
  /** Sidebar width in px (drag-resizable, persisted). */
  sidebarWidth: number;
  setSidebarWidth: (px: number) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      settingsOpen: false,
      settingsCategory: "providers",
      openSettings: (category) =>
        set((s) => ({
          settingsOpen: true,
          settingsCategory: category ?? s.settingsCategory,
        })),
      closeSettings: () => set({ settingsOpen: false }),
      setSettingsCategory: (settingsCategory) => set({ settingsCategory }),
      agentsOpen: false,
      editingAgentId: null,
      openAgents: (agentId) =>
        set({ agentsOpen: true, editingAgentId: agentId ?? null }),
      closeAgents: () => set({ agentsOpen: false, editingAgentId: null }),
      sidebarWidth: SIDEBAR_DEFAULT_PX,
      setSidebarWidth: (px) => set({ sidebarWidth: clampSidebarWidth(px) }),
    }),
    {
      name: "tietiezhi-ui",
      partialize: (state) => ({ sidebarWidth: state.sidebarWidth }),
    },
  ),
);
