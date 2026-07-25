// 25/07/2026: hook moi - tach rieng logic auto-collapse Sidebar o do rong tablet de de test doc
// lap (renderHook) va de goi tu AppShell.tsx (mount 1 lan duy nhat o goc layout). Xem Wireframe.md
// muc 10: "768px–1023px (tablet): Sidebar thu gọn còn icon". Truoc ban sua nay, ui.store.ts da co
// san setSidebarCollapsed(collapsed, byUser) va co flag hasUserSidebarPreference ro rang duoc thiet
// ke de phuc vu dung tinh nang nay, nhung khong co noi nao trong app thuc su lang nghe kich thuoc
// man hinh va goi no ca - sidebar chi thu gon/mo rong khi nguoi dung tu bam nut.
import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui.store';

/** Dung dung khoang Wireframe.md muc 10 quy dinh cho "tablet". */
export const TABLET_MEDIA_QUERY = '(min-width: 768px) and (max-width: 1023px)';

/**
 * Lang nghe kich thuoc man hinh: vao khoang tablet (768–1023px) thi tu dong thu gon Sidebar,
 * ra khoi khoang do (ve mobile hoac desktop) thi tu dong mo rong lai - NHUNG chi khi nguoi dung
 * CHUA tung tu tay bam nut thu gon/mo rong (hasUserSidebarPreference === false), de khong ghi de
 * len lua chon thu cong cua ho moi lan resize/xoay man hinh.
 */
export function useSidebarAutoCollapse(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mql = window.matchMedia(TABLET_MEDIA_QUERY);

    // Doc hasUserSidebarPreference truc tiep tu store (getState()) thay vi qua selector - gia tri
    // luon la moi nhat tai thoi diem su kien xay ra ma khong can dang ky lai listener moi lan
    // preference doi (viec doi preference khong tu no can auto-collapse/expand ngay lap tuc, chi
    // anh huong lan cheo breakpoint tiep theo).
    const applyForRange = (isTablet: boolean) => {
      const { hasUserSidebarPreference, setSidebarCollapsed } = useUIStore.getState();
      if (hasUserSidebarPreference) return;
      setSidebarCollapsed(isTablet, false);
    };

    applyForRange(mql.matches);

    const handleChange = (e: MediaQueryListEvent) => applyForRange(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);
}
