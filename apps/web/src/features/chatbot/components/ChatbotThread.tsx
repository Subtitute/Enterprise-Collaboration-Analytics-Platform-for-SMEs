import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { AlertCircleIcon, FileTextIcon, SendIcon, SparklesIcon } from '@/components/ui/Icons';
import { extractErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useDownloadFile } from '@/features/documents/hooks';
import { CHATBOT_QUESTION_MAX_LENGTH } from '../api';
import type { ChatbotMessage } from '../api';
import { useAskChatbot, useChatbotMessages, useCreateChatbotConversation } from '../hooks';
import { ChatbotAnswer } from './ChatbotAnswer';

const SUGGESTION_KEYS = ['tasks', 'leave', 'documents'] as const;

interface ChatbotThreadProps {
  conversationId: string | null;
  onConversationCreated: (conversationId: string) => void;
  onBusyChange: (busy: boolean) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
}

/**
 * 24/10/2026: khung hoi-dap cua Chat bot noi bo. KHONG streaming (backend tra cau tra loi cuoi sau
 * cac vong goi tool) - trong luc cho hien cau hoi vua gui + trang thai "Dang xu ly...". Loi (het luot
 * hoi/ngay, AI qua tai...) hien NGAY TRONG panel (khong qua toast) va tra lai noi dung vao o nhap de
 * nguoi dung bam gui lai. Hoi thoai moi chi duoc tao o backend khi gui cau hoi DAU TIEN.
 */
export function ChatbotThread({ conversationId, onConversationCreated, onBusyChange, inputRef }: ChatbotThreadProps) {
  const { t } = useTranslation();
  const messagesQuery = useChatbotMessages(conversationId);
  const createConversation = useCreateChatbotConversation();
  const askChatbot = useAskChatbot();
  const { openFile } = useDownloadFile();

  const [input, setInput] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ usedToday: number; dailyLimit: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Chot DONG BO chong gui trung (double-click/giu Enter): `pendingQuestion` la state nen 2 lan bam
  // trong cung 1 nhip render deu con thay gia tri cu - backend se tu choi lan 2 bang 409
  // CHATBOT_CONVERSATION_BUSY, nhung UI chan truoc de nguoi dung binh thuong khong bao gio gap loi do.
  const inFlightRef = useRef(false);

  const messages = messagesQuery.data ?? [];
  const isBusy = pendingQuestion !== null;

  useEffect(() => {
    onBusyChange(isBusy);
  }, [isBusy, onBusyChange]);

  // Cuon xuong cuoi moi khi co tin nhan moi/trang thai cho/loi moi.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, pendingQuestion, errorMessage]);

  async function submit(text: string) {
    const question = text.trim();
    if (!question || isBusy || inFlightRef.current) return;
    inFlightRef.current = true;
    setErrorMessage(null);
    setPendingQuestion(question);
    setInput('');
    try {
      let targetId = conversationId;
      if (!targetId) {
        targetId = (await createConversation.mutateAsync()).id;
        onConversationCreated(targetId);
      }
      const result = await askChatbot.mutateAsync({ conversationId: targetId, question });
      setUsage(result.usage);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setInput(question);
    } finally {
      inFlightRef.current = false;
      setPendingQuestion(null);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing: dang go bo go dau tieng Viet/Nhat (IME) - Enter luc nay la chot ky tu, KHONG gui.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit(input);
    }
  }

  const showWelcome = !conversationId && !isBusy && messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {showWelcome && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <SparklesIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-text-primary">{t('chatbot:thread.welcomeTitle')}</p>
                <p className="mt-0.5 text-[12px] leading-[18px] text-text-secondary">{t('chatbot:thread.welcomeDescription')}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{t('chatbot:thread.suggestionsLabel')}</p>
              {SUGGESTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void submit(t(`chatbot:thread.suggestions.${key}`))}
                  className="block w-full rounded-radius-md border border-border-subtle bg-white px-3 py-2 text-left text-[12px] text-text-primary transition-colors hover:border-accent hover:bg-accent-soft cursor-pointer"
                >
                  {t(`chatbot:thread.suggestions.${key}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messagesQuery.isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {messagesQuery.isError && (
          <div className="flex items-center justify-between gap-2 rounded-radius-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
            <span>{t('chatbot:thread.loadError')}</span>
            <button type="button" onClick={() => void messagesQuery.refetch()} className="font-semibold underline cursor-pointer">
              {t('chatbot:thread.retry')}
            </button>
          </div>
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <UserBubble key={message.id} content={message.content} />
          ) : (
            <AssistantBubble key={message.id} message={message} onOpenSource={(fileId) => openFile(fileId, 'inline')} />
          ),
        )}

        {pendingQuestion && (
          <>
            <UserBubble content={pendingQuestion} />
            <div className="flex items-center gap-2 text-[12px] text-text-secondary" role="status">
              <Spinner size="sm" />
              {t('chatbot:thread.processing')}
            </div>
          </>
        )}

        {errorMessage && (
          <div role="alert" className="flex items-start gap-2 rounded-radius-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] leading-[18px] text-rose-800">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border-subtle bg-white p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={CHATBOT_QUESTION_MAX_LENGTH}
            rows={2}
            disabled={isBusy}
            placeholder={t('chatbot:thread.placeholder')}
            aria-label={t('chatbot:thread.placeholder')}
            className="min-h-[52px] flex-1 resize-none rounded-[8px] border border-border-strong px-3 py-2 text-[13px] text-text-primary focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => void submit(input)}
            disabled={!input.trim() || isBusy}
            aria-label={t('chatbot:thread.send')}
            title={t('chatbot:thread.send')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-text-primary text-white transition-colors hover:bg-black cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-text-tertiary">
          <span className="truncate">
            {usage ? t('chatbot:thread.usage', { used: usage.usedToday, limit: usage.dailyLimit }) : t('chatbot:thread.disclaimer')}
          </span>
          <span className="shrink-0 font-mono tabular-nums">
            {t('chatbot:thread.charCount', { count: input.length, max: CHATBOT_QUESTION_MAX_LENGTH })}
          </span>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[12px] rounded-br-[4px] bg-text-primary px-3 py-2 text-[13px] leading-[20px] text-white">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ message, onOpenSource }: { message: ChatbotMessage; onOpenSource: (fileId: string) => void }) {
  const { t } = useTranslation();
  const toolNames = [...new Set(message.toolCalls.map((call) => call.name))];
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-1.5">
        <div className="rounded-[12px] rounded-bl-[4px] bg-bg-subtle px-3 py-2 text-[13px] leading-[20px] text-text-primary">
          <ChatbotAnswer content={message.content} />
        </div>
        {message.citations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-[11px] font-semibold text-text-tertiary">{t('chatbot:thread.sources')}:</span>
            {message.citations.map((citation) => (
              <button
                key={citation.fileId}
                type="button"
                onClick={() => onOpenSource(citation.fileId)}
                aria-label={t('chatbot:thread.openSource', { name: citation.fileName })}
                title={t('chatbot:thread.openSource', { name: citation.fileName })}
                className={cn(
                  'inline-flex max-w-full items-center gap-1 rounded-full border border-border-subtle bg-white px-2 py-0.5',
                  'text-[11px] text-text-primary transition-colors hover:border-accent hover:text-accent cursor-pointer',
                )}
              >
                <FileTextIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{citation.fileName}</span>
              </button>
            ))}
          </div>
        )}
        {toolNames.length > 0 && (
          <p className="px-1 text-[11px] text-text-tertiary">
            {t('chatbot:thread.usedTools', {
              tools: toolNames.map((name) => t(`chatbot:tools.${name}`, { defaultValue: name })).join(', '),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
