// 24/10/2026: test khung hoi-dap Chat bot - trong luc cho tra loi: nut gui + o nhap bi khoa, double-click
// chi gui DUNG 1 cau hoi (tranh 409 CHATBOT_CONVERSATION_BUSY), hien "Dang xu ly...", hien nguon tai
// lieu; loi tu backend hien ngay trong panel va tra lai noi dung vao o nhap.
// 27/10/2026: chip nguon mo FilePreviewModal (lay metadata GET /files/:id qua useFilePreview that, chi
// mock lop api) thay vi tab moi; tep khong con/khong co quyen -> toast loi, khong mo modal.
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { t } from '@/i18n';
import { toast } from '@/stores/toast.store';
import type { FileItem } from '@/types';
import type { ChatbotMessage } from '../api';

const mocks = vi.hoisted(() => ({
  messages: [] as ChatbotMessage[],
  createConversation: vi.fn(),
  ask: vi.fn(),
  fetchFile: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useChatbotMessages: () => ({ data: mocks.messages, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateChatbotConversation: () => ({ mutateAsync: mocks.createConversation }),
  useAskChatbot: () => ({ mutateAsync: mocks.ask }),
}));
vi.mock('@/features/documents/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/documents/api')>()),
  fetchFile: mocks.fetchFile,
}));
// Modal xem truoc thay bang ban rut gon - noi dung ben trong modal co test rieng cua no.
vi.mock('@/features/documents/components/FilePreviewModal', () => ({
  FilePreviewModal: ({ file, open }: { file: FileItem | null; open: boolean }) =>
    open && file ? <div role="dialog" aria-label={file.name} /> : null,
}));

import { ChatbotThread } from './ChatbotThread';

function renderThread(conversationId: string | null = 'conv-1') {
  const onConversationCreated = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatbotThread
        conversationId={conversationId}
        onConversationCreated={onConversationCreated}
        onBusyChange={vi.fn()}
        inputRef={createRef<HTMLTextAreaElement>()}
      />
    </QueryClientProvider>,
  );
  return { onConversationCreated, input: screen.getByRole('textbox'), send: screen.getByRole('button', { name: 'Gửi câu hỏi' }) };
}

describe('ChatbotThread', () => {
  beforeEach(() => {
    mocks.messages = [];
    mocks.createConversation.mockReset();
    mocks.ask.mockReset();
    mocks.fetchFile.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dang cho tra loi: khoa nut gui + o nhap, double-click chi gui 1 lan, hien trang thai xu ly', async () => {
    let resolveAsk: (value: unknown) => void = () => undefined;
    mocks.ask.mockReturnValue(new Promise((resolve) => (resolveAsk = resolve)));
    const { input, send } = renderThread();

    fireEvent.change(input, { target: { value: 'Tôi có việc gì?' } });
    fireEvent.click(send);
    fireEvent.click(send);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mocks.ask).toHaveBeenCalledTimes(1);
    expect(mocks.ask).toHaveBeenCalledWith({ conversationId: 'conv-1', question: 'Tôi có việc gì?' });
    expect(send).toBeDisabled();
    expect(input).toBeDisabled();
    expect(screen.getByText('Đang xử lý…')).toBeInTheDocument();

    await act(async () => resolveAsk({ usage: { usedToday: 3, dailyLimit: 30 } }));
    expect(screen.queryByText('Đang xử lý…')).not.toBeInTheDocument();
    expect(screen.getByText('Đã dùng 3/30 câu hỏi hôm nay')).toBeInTheDocument();
  });

  it('cau hoi dau tien cua hoi thoai moi: tao hoi thoai truoc roi moi hoi', async () => {
    mocks.createConversation.mockResolvedValue({ id: 'new-conv' });
    mocks.ask.mockResolvedValue({ usage: { usedToday: 1, dailyLimit: 30 } });
    const { input, send, onConversationCreated } = renderThread(null);

    fireEvent.change(input, { target: { value: 'Xin chào' } });
    await act(async () => fireEvent.click(send));

    expect(onConversationCreated).toHaveBeenCalledWith('new-conv');
    expect(mocks.ask).toHaveBeenCalledWith({ conversationId: 'new-conv', question: 'Xin chào' });
  });

  it('loi het luot hoi/ngay: hien thong bao da dich trong panel, tra lai cau hoi vao o nhap', async () => {
    const response = {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { message: 'Ban da dung het 30 cau hoi', errorCode: 'CHATBOT_DAILY_LIMIT_EXCEEDED', errorParams: { limit: 30 } },
    };
    mocks.ask.mockRejectedValue(new AxiosError('429', 'ERR_BAD_REQUEST', undefined, undefined, response));
    const { input, send } = renderThread();

    fireEvent.change(input, { target: { value: 'Câu hỏi 31' } });
    await act(async () => fireEvent.click(send));

    expect(screen.getByRole('alert')).toHaveTextContent('Bạn đã dùng hết 30 câu hỏi cho Trợ lý ECAP hôm nay');
    expect(input).toHaveValue('Câu hỏi 31');
    expect(send).not.toBeDisabled();
  });

  function withCitation() {
    mocks.messages = [
      { id: 'u1', role: 'user', content: 'Quy định làm từ xa?', citations: [], toolCalls: [], createdAt: '2026-10-24T01:00:00Z' },
      {
        id: 'a1',
        role: 'assistant',
        content: 'Theo [Quy-dinh.pdf]:\n* Tối đa **2 ngày**/tuần',
        citations: [{ fileId: 'f-1', fileName: 'Quy-dinh.pdf' }],
        toolCalls: [{ name: 'search_documents', args: { query: 'lam viec tu xa' } }],
        createdAt: '2026-10-24T01:00:03Z',
      },
    ];
  }
  const sourceChipName = () => t('chatbot:thread.openSource', { name: 'Quy-dinh.pdf' });

  it('cau tra loi hien nguon tai lieu (bam de xem trong modal, khong mo tab moi) va cong cu da tra cuu', async () => {
    withCitation();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    mocks.fetchFile.mockResolvedValue({
      id: 'f-1',
      name: 'Quy-dinh.pdf',
      folderId: 'fo-1',
      mimeType: 'application/pdf',
      createdAt: '2026-10-24T01:00:00Z',
      updatedAt: '2026-10-24T01:00:00Z',
    } satisfies FileItem);
    renderThread();

    expect(screen.getByText('2 ngày').tagName).toBe('STRONG');
    expect(screen.getByText(t('chatbot:thread.usedTools', { tools: t('chatbot:tools.search_documents') }))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: sourceChipName() }));

    expect(await screen.findByRole('dialog', { name: 'Quy-dinh.pdf' })).toBeInTheDocument();
    expect(mocks.fetchFile).toHaveBeenCalledWith('f-1');
    expect(openSpy).not.toHaveBeenCalled();
  });

  // 28/10/2026: dong panel (Esc) khi chip nguon con dang tai metadata -> modal khong tu mo len sau do.
  it('dong panel khi chip nguon dang tai: huy lan mo, modal khong bat len sau khi panel da dong', async () => {
    withCitation();
    let resolveFile: (file: FileItem) => void = () => undefined;
    mocks.fetchFile.mockReturnValue(new Promise<FileItem>((resolve) => (resolveFile = resolve)));
    const client = new QueryClient();
    const thread = (panelOpen: boolean) => (
      <QueryClientProvider client={client}>
        <ChatbotThread
          conversationId="conv-1"
          onConversationCreated={vi.fn()}
          onBusyChange={vi.fn()}
          inputRef={createRef<HTMLTextAreaElement>()}
          panelOpen={panelOpen}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(thread(true));
    const chip = screen.getByRole('button', { name: sourceChipName() });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-busy', 'true');

    rerender(thread(false));
    await act(async () =>
      resolveFile({ id: 'f-1', name: 'Quy-dinh.pdf', folderId: 'fo-1', mimeType: 'application/pdf', createdAt: '2026-10-24T01:00:00Z', updatedAt: '2026-10-24T01:00:00Z' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chip).not.toHaveAttribute('aria-busy', 'true');
  });

  it('chip nguon cua tep da bi xoa/khong con quyen: toast loi da dich, khong mo modal', async () => {
    withCitation();
    const toastSpy = vi.spyOn(toast, 'error');
    const response = {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { message: 'Khong tim thay file', errorCode: 'FILE_NOT_FOUND' },
    };
    mocks.fetchFile.mockRejectedValue(new AxiosError('404', 'ERR_BAD_REQUEST', undefined, undefined, response));
    renderThread();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: sourceChipName() })));

    expect(mocks.fetchFile).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith(t('documents:hooks.openFileError'), t('errors:FILE_NOT_FOUND'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
