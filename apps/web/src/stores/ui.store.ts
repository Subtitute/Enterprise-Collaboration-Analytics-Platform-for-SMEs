import { create } from 'zustand';

// 24/10/2026: lop noi cua Chat bot noi bo o goc duoi-phai (features/chatbot/ChatbotWidget.tsx) -
// ToastContainer (components/ui/Toast.tsx) doc gia tri nay de day toast len TREN nut chat/ra NGOAI
// panel chat, khong bao gio de 2 lop noi chong len nhau.
export type ChatbotLayer = 'none' | 'launcher' | 'panel';

interface UIState {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  chatbotLayer: ChatbotLayer;
  setChatbotLayer: (layer: ChatbotLayer) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  chatbotLayer: 'none',
  setChatbotLayer: (layer) => set({ chatbotLayer: layer }),
}));
