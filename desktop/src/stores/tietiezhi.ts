import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TietiezhiState {
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
}

export const useTietiezhiStore = create<TietiezhiState>()(
  persist(
    (set) => ({
      selectedDeviceId: "local",
      setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
    }),
    {
      name: "tietiezhi-companion",
      partialize: (state) => ({ selectedDeviceId: state.selectedDeviceId }),
    },
  ),
);
