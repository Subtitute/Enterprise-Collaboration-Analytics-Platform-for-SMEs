// 24/10/2026: test khung hoi-dap Chat bot - trong luc cho tra loi: nut gui + o nhap bi khoa, double-click
// chi gui DUNG 1 cau hoi (tranh 409 CHATBOT_CONVERSATION_BUSY), hien "Dang xu ly...", hien nguon tai
// lieu; loi tu backend hien ngay trong panel va tra lai noi dung vao o nhap.
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ChatbotMessage } from '../api';

const mocks = vi.hoisted(() => ({
  messages: [] as ChatbotMessage[],
  createConversation: vi.fn(),
  ask: vi.fn(),
  openFile: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useChatbotMessages: () => ({ data: mocks.messages, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateChatbotConversation: () => ({ mutateAsync: mocks.createConversation }),
  useAskChatbot: () => ({ mutateAsync: mocks.ask }),
}));
vi.mock('@/features/documents/hooks', () => ({ useDownloadFile: () => ({ openFile: mocks.openFile }) }));

import { ChatbotThread } from './ChatbotThread';

function renderThread(conversationId: string | null = 'conv-1') {
  const onConversationCreated = vi.fn();
  render(
    <ChatbotThread
      conversationId={conversationId}
      onConversationCreated={onConversationCreated}
      onBusyChange={vi.fn()}
      inputRef={createRef<HTMLTextAreaElement>()}
    />,
  );
  return { onConversationCreated, input: screen.getByRole('textbox'), send: screen.getByRole('button', { name: 'Gửi câu hỏi' }) };
}

describe('ChatbotThread', () => {
  beforeEach(() => {
    mocks.messages = [];
    mocks.createConversation.mockReset();
    mocks.ask.mockReset();
    mocks.openFile.mockReset();
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

  it('cau tra loi hien nguon tai lieu (bam de mo file) va cong cu da tra cuu', () => {
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
    renderThread();

    expect(screen.getByText('2 ngày').tagName).toBe('STRONG');
    expect(screen.getByText('Đã tra cứu: tài liệu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở tài liệu Quy-dinh.pdf' }));
    expect(mocks.openFile).toHaveBeenCalledWith('f-1', 'inline');
  });
});
