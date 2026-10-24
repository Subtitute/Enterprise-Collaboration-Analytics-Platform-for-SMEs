import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types';

// 24/10/2026: Chat bot noi bo (Technical_Spec.md muc 23) - client cho `/api/v1/chatbot/*`
// (apps/analytics-service/src/chatbot). Hoi thoai la CA NHAN: backend tu loc theo nguoi dang nhap.

export interface ChatbotCitation {
  fileId: string;
  fileName: string;
}

export interface ChatbotToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatbotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ChatbotCitation[];
  toolCalls: ChatbotToolCall[];
  createdAt: string;
}

export interface ChatbotConversation {
  id: string;
  /** null cho toi khi co cau hoi dau tien (backend tu dat tieu de tu cau hoi do). */
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotAskResult {
  conversation: ChatbotConversation;
  userMessage: ChatbotMessage;
  assistantMessage: ChatbotMessage;
  usage: { usedToday: number; dailyLimit: number };
}

/** Khop @MaxLength cua AskQuestionDto (backend). */
export const CHATBOT_QUESTION_MAX_LENGTH = 1000;
// Backend tu gioi han 1 cau hoi trong 45s (TOTAL_BUDGET_MS) - de du bien cho mang/Gateway, khong
// de request "treo" vo han neu co su co phia sau.
const ASK_TIMEOUT_MS = 75_000;
const HISTORY_PAGE_SIZE = 50;

export async function fetchChatbotConversations(): Promise<ChatbotConversation[]> {
  const { data } = await apiClient.get<PaginatedResponse<ChatbotConversation>>('/chatbot/conversations', {
    params: { limit: HISTORY_PAGE_SIZE },
  });
  return data.data;
}

export async function createChatbotConversation(): Promise<ChatbotConversation> {
  const { data } = await apiClient.post<ChatbotConversation>('/chatbot/conversations');
  return data;
}

export async function fetchChatbotMessages(conversationId: string): Promise<ChatbotMessage[]> {
  const { data } = await apiClient.get<ChatbotMessage[]>(`/chatbot/conversations/${conversationId}/messages`);
  return data;
}

export async function askChatbot(conversationId: string, question: string): Promise<ChatbotAskResult> {
  const { data } = await apiClient.post<ChatbotAskResult>(
    `/chatbot/conversations/${conversationId}/messages`,
    { question },
    { timeout: ASK_TIMEOUT_MS },
  );
  return data;
}

export async function deleteChatbotConversation(conversationId: string): Promise<void> {
  await apiClient.delete(`/chatbot/conversations/${conversationId}`);
}
