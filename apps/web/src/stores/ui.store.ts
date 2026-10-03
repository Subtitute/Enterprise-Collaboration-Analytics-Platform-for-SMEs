import { create } from 'zustand';

interface UIState {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
}

// 03/10/2026: bo sidebarCollapsed/hasUserSidebarPreference/toggleSidebarCollapsed/setSidebarCollapsed
// va middleware persist (khong con truong nao can luu qua localStorage - khoa "ecap-ui" cu chi dung
// de luu 2 truong nay). Rail chinh (Sidebar.tsx) gio LUON thu gon mac dinh va chi mo rong tam thoi
// khi di chuot vao (state cuc bo "hovered" trong chinh component, khong con la lua chon nguoi dung
// can nho giua cac phien lam viec/kich thuoc man hinh nua - xem Sidebar.tsx).
export const useUIStore = create<UIState>()((set) => ({
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}));
