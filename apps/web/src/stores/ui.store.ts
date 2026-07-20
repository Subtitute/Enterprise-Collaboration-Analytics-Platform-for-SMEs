import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  /** True sau khi nguoi dung tu tay bam nut thu gon/mo rong it nhat 1 lan - luc do khong con auto-detect theo kich thuoc man hinh nua. */
  hasUserSidebarPreference: boolean;
  mobileSidebarOpen: boolean;
  setSidebarCollapsed: (collapsed: boolean, byUser?: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      hasUserSidebarPreference: false,
      mobileSidebarOpen: false,
      setSidebarCollapsed: (collapsed, byUser = false) =>
        set({ sidebarCollapsed: collapsed, hasUserSidebarPreference: byUser || get().hasUserSidebarPreference }),
      toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed, hasUserSidebarPreference: true }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
    }),
    {
      name: 'ecap-ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, hasUserSidebarPreference: state.hasUserSidebarPreference }),
    },
  ),
);
