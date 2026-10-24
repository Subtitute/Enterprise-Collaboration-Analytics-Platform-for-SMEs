import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ClockIcon, PlusIcon, SparklesIcon, XIcon } from '@/components/ui/Icons';
import { ChatbotThread } from './ChatbotThread';
import { ChatbotHistory } from './ChatbotHistory';

interface ChatbotPanelProps {
  open: boolean;
  onClose: () => void;
}

const HEADER_BUTTON_CLASSES =
  'flex h-8 w-8 items-center justify-center rounded-radius-sm text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary cursor-pointer disabled:pointer-events-none disabled:opacity-40';

/**
 * 24/10/2026: noi dung panel Chat bot noi bo (nap LUOI tu ChatbotWidget.tsx). Van giu mounted khi
 * panel dong (chi an di) nen hoi thoai dang mo - ke ca 1 cau hoi DANG XU LY - khong bi mat khi nguoi
 * dung tam dong panel de xem trang khac. 2 che do: hoi-dap (ChatbotThread) va lich su (ChatbotHistory).
 */
export function ChatbotPanel({ open, onClose }: ChatbotPanelProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const handleBusyChange = useCallback((value: boolean) => setBusy(value), []);

  // Doi che do lam nut vua bam bien mat (vd nut "Lich su") - chu dong dat focus vao phan tu tuong ung
  // cua che do moi, khong de focus roi ve <body> (mat Esc + nguoi dung ban phim phai Tab lai tu dau).
  useEffect(() => {
    if (!open) return;
    if (view === 'chat') inputRef.current?.focus();
    else backButtonRef.current?.focus();
  }, [open, view]);

  function startNewChat() {
    setActiveConversationId(null);
    setView('chat');
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2.5">
        {view === 'history' ? (
          <button ref={backButtonRef} type="button" onClick={() => setView('chat')} aria-label={t('chatbot:panel.backToChat')} title={t('chatbot:panel.backToChat')} className={HEADER_BUTTON_CLASSES}>
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <SparklesIcon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight text-text-primary">
            {view === 'history' ? t('chatbot:panel.history') : t('chatbot:panel.title')}
          </p>
          {view === 'chat' && <p className="truncate text-[11px] text-text-tertiary">{t('chatbot:panel.subtitle')}</p>}
        </div>
        {view === 'chat' && (
          <button type="button" onClick={() => setView('history')} disabled={busy} aria-label={t('chatbot:panel.history')} title={t('chatbot:panel.history')} className={HEADER_BUTTON_CLASSES}>
            <ClockIcon className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={startNewChat} disabled={busy} aria-label={t('chatbot:panel.newChat')} title={t('chatbot:panel.newChat')} className={HEADER_BUTTON_CLASSES}>
          <PlusIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} aria-label={t('chatbot:panel.close')} title={t('chatbot:panel.close')} className={HEADER_BUTTON_CLASSES}>
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {view === 'chat' ? (
        <ChatbotThread
          conversationId={activeConversationId}
          onConversationCreated={setActiveConversationId}
          onBusyChange={handleBusyChange}
          inputRef={inputRef}
        />
      ) : (
        <ChatbotHistory
          activeConversationId={activeConversationId}
          onSelect={(conversationId) => {
            setActiveConversationId(conversationId);
            setView('chat');
          }}
          onDeleted={(conversationId) => {
            if (conversationId === activeConversationId) setActiveConversationId(null);
          }}
        />
      )}
    </>
  );
}
