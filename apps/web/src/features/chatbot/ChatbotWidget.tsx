import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SparklesIcon, XIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';

// Nap LUOI noi dung panel (api/hooks/markdown...) - chi tai khi nguoi dung mo chat lan dau, khong lam
// nang bundle chinh cua AppShell cho nhung ai khong dung toi chat bot.
const ChatbotPanel = lazy(() => import('./components/ChatbotPanel').then((module) => ({ default: module.ChatbotPanel })));

export const CHATBOT_PANEL_ID = 'ecap-chatbot-panel';

// 24/10/2026: vi tri + thu tu xep lop (z-index) - phan tich tu cac lop noi da co trong AppShell:
// Topbar `sticky z-30` (popover thong bao/tim kiem/tai khoan nam TRONG stacking context nay nen thuc
// te chi cao toi z-30 o goc), thanh thao tac hang loat cua FileTable `fixed z-40`, Modal/MobileSidebar
// `z-50`, Dropdown `z-[60]`, Toast `z-[100]`. Chat bot dat z-[25]: NOI tren noi dung trang (ke ca nut
// dieu huong Kanban z-20) nhung LUON nam DUOI Topbar va moi popover/modal/drawer, nen khong bao gio
// che menu tren Topbar hay hop thoai xac nhan. Kich thuoc panel: tren man hinh >= sm rong 380px cach le
// phai 1.25rem - be rong lon nhat cua cot trai (rail 64px + SecondarySidebar 224px = 288px, chi hien o
// md+ >= 768px) cong 380px + le van < 768px nen panel khong bao gio de len Sidebar; chieu cao toi da
// (100vh - 9.5rem) giu mep tren panel luon thap hon day Topbar (h-14 = 3.5rem). Mobile: panel trai gan
// het chieu ngang giua Topbar va nut chat; nut chat dat cao (bottom-24) de khong de len thanh thao tac
// FileTable (bottom-6). Toast tu dich vi tri theo `chatbotLayer` (xem components/ui/Toast.tsx).
const LAUNCHER_CLASSES = cn(
  'fixed z-[25] bottom-24 right-4 sm:bottom-5 sm:right-5',
  'flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-md hover:bg-accent/90',
  'transition-all hover:scale-105 active:scale-95 cursor-pointer',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
);
// 26/10/2026 - Rà soát layout & responsive 390px: z-[25] không che Topbar (z-30), Modal (z-50); trên mobile panel cách top 4.5rem và bottom-40 không che Topbar/Toast
const PANEL_CLASSES = cn(
  'fixed z-[25] flex flex-col overflow-hidden rounded-radius-lg border border-border-subtle bg-bg-surface shadow-md animate-slide-up',
  'left-4 right-4 top-[4.5rem] bottom-40',
  'sm:left-auto sm:top-auto sm:right-5 sm:bottom-20 sm:w-[380px] sm:h-[min(600px,calc(100vh_-_9.5rem))]',
);

/**
 * 24/10/2026: nut chat noi + panel Chat bot noi bo (Technical_Spec.md muc 23.7) - gan 1 lan trong
 * AppShell nen co mat tren MOI trang da dang nhap. CHI hien voi nguoi co quyen `chatbot:use` (doc tu
 * JWT - chi de an/hien UI, backend van kiem tra quyen tren tung API).
 */
export function ChatbotWidget() {
  const { t } = useTranslation();
  const canUse = usePermissions().includes(PERMISSIONS.CHATBOT_USE);
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const setChatbotLayer = useUIStore((s) => s.setChatbotLayer);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatbotLayer(!canUse ? 'none' : open ? 'panel' : 'launcher');
  }, [canUse, open, setChatbotLayer]);
  useEffect(() => () => setChatbotLayer('none'), [setChatbotLayer]);

  if (!canUse) return null;

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  // Esc dong panel - chi khi su kien phat ra BEN TRONG DOM cua panel: hop thoai xac nhan xoa (Modal,
  // render qua portal) van "noi bot" su kien React len day nhung DOM cua no nam ngoai panel.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && panelRef.current?.contains(event.target as Node)) {
      event.stopPropagation();
      close();
    }
  }

  return (
    <>
      {hasOpened && (
        <div
          ref={panelRef}
          id={CHATBOT_PANEL_ID}
          role="dialog"
          aria-label={t('chatbot:panel.title')}
          // tabIndex -1: bam vao vung KHONG focus duoc trong panel (vd nen tin nhan) giu focus o panel thay
          // vi roi ve <body> - neu khong, Esc (handleKeyDown) se khong con nhan duoc su kien.
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className={cn(PANEL_CLASSES, 'focus:outline-none', !open && 'hidden')}
        >
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-text-tertiary">
                <Spinner size="sm" />
                {t('chatbot:panel.loading')}
              </div>
            }
          >
            <ChatbotPanel open={open} onClose={close} />
          </Suspense>
        </div>
      )}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          setHasOpened(true);
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-controls={hasOpened ? CHATBOT_PANEL_ID : undefined}
        aria-label={open ? t('chatbot:launcher.close') : t('chatbot:launcher.open')}
        title={open ? t('chatbot:launcher.close') : t('chatbot:launcher.open')}
        className={LAUNCHER_CLASSES}
      >
        {open ? <XIcon className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
      </button>
    </>
  );
}
