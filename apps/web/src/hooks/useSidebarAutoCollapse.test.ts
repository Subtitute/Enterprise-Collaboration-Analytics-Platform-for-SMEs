// 25/07/2026: test moi cho useSidebarAutoCollapse (xem hooks/useSidebarAutoCollapse.ts) - hook
// nay sua phat hien MAJOR trong dot kiem tra: Sidebar chua bao gio tu dong thu gon o do rong
// tablet (768-1023px) nhu Wireframe.md muc 10 yeu cau, du ui.store.ts da co san
// setSidebarCollapsed(collapsed, byUser) + hasUserSidebarPreference duoc thiet ke san cho dung
// muc dich nay. jsdom khong co san window.matchMedia nen phai tu dung 1 ban gia (fake) co the
// "kich hoat" thay doi breakpoint bang tay qua dispatch().
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUIStore } from '@/stores/ui.store';
import { useSidebarAutoCollapse, TABLET_MEDIA_QUERY } from './useSidebarAutoCollapse';

class FakeMediaQueryList {
  matches: boolean;
  media = TABLET_MEDIA_QUERY;
  private listeners: Array<(e: MediaQueryListEvent) => void> = [];

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(_type: string, cb: (e: MediaQueryListEvent) => void) {
    this.listeners.push(cb);
  }

  removeEventListener(_type: string, cb: (e: MediaQueryListEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }

  /** Gia lap trinh duyet bao thay doi breakpoint (vao/ra khoi khoang tablet). */
  dispatch(matches: boolean) {
    this.matches = matches;
    for (const cb of this.listeners) cb({ matches } as MediaQueryListEvent);
  }

  get listenerCount() {
    return this.listeners.length;
  }
}

function resetUIStore() {
  useUIStore.setState({ sidebarCollapsed: false, hasUserSidebarPreference: false, mobileSidebarOpen: false });
}

describe('useSidebarAutoCollapse', () => {
  let fakeMql: FakeMediaQueryList;

  beforeEach(() => {
    resetUIStore();
    fakeMql = new FakeMediaQueryList(false);
    window.matchMedia = vi.fn().mockReturnValue(fakeMql) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('thu gon Sidebar ngay khi mount neu man hinh dang o do rong tablet', () => {
    fakeMql = new FakeMediaQueryList(true); // mo phong: tai mount, man hinh da o trong khoang tablet
    window.matchMedia = vi.fn().mockReturnValue(fakeMql) as unknown as typeof window.matchMedia;

    renderHook(() => useSidebarAutoCollapse());

    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(useUIStore.getState().hasUserSidebarPreference).toBe(false);
  });

  it('thu gon khi vao khoang tablet, mo rong lai khi ra khoi khoang do', () => {
    renderHook(() => useSidebarAutoCollapse());
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);

    fakeMql.dispatch(true); // vao khoang 768-1023px
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    fakeMql.dispatch(false); // ra khoi khoang do (ve desktop hoac mobile)
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('KHONG ghi de len lua chon thu cong cua nguoi dung (hasUserSidebarPreference=true)', () => {
    renderHook(() => useSidebarAutoCollapse());

    // Nguoi dung tu bam nut mo rong lai sau khi da vao tablet - danh dau la lua chon thu cong.
    useUIStore.getState().setSidebarCollapsed(false, true);
    expect(useUIStore.getState().hasUserSidebarPreference).toBe(true);

    fakeMql.dispatch(true); // van dang trong khoang tablet, gia lap 1 lan resize/xoay man hinh khac
    expect(useUIStore.getState().sidebarCollapsed).toBe(false); // giu nguyen lua chon cua nguoi dung

    fakeMql.dispatch(false);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false); // van khong bi auto-collapse can thiep
  });

  it('go dang ky listener khi unmount', () => {
    const { unmount } = renderHook(() => useSidebarAutoCollapse());
    expect(fakeMql.listenerCount).toBe(1);

    unmount();

    expect(fakeMql.listenerCount).toBe(0);
  });
});
