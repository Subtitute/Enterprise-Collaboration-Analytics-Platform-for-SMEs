import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import type { ChatMessage, Conversation, ConversationType, ConversationWithOwner } from '@/types';

export interface CreateConversationPayload {
  type: ConversationType;
  participantUserIds: string[];
  name?: string;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await apiClient.get<Conversation[]>('/conversations');
  return data;
}

export async function createConversation(payload: CreateConversationPayload): Promise<ConversationWithOwner> {
  const { data } = await apiClient.post<ConversationWithOwner>('/conversations', payload);
  return data;
}

export interface FetchMessagesParams {
  limit?: number;
  beforeMessageId?: string;
}

// Backend tra ve tang dan theo createdAt (cu -> moi) - xem messages.service.ts:listMessages().
export async function fetchMessages(conversationId: string, params: FetchMessagesParams = {}): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<ChatMessage[]>(`/conversations/${conversationId}/messages`, { params });
  return data;
}

export async function sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const { data } = await apiClient.post<ChatMessage>(`/conversations/${conversationId}/messages`, { body });
  return data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient.patch(`/conversations/${conversationId}/read`);
}

export interface UpdateParticipantsPayload {
  addUserIds?: string[];
  removeUserIds?: string[];
}

// GROUP-only o backend (400 cho DIRECT) - chi goi tu UI khi conversation.type === 'GROUP'.
export async function updateConversationParticipants(
  conversationId: string,
  payload: UpdateParticipantsPayload,
): Promise<ConversationWithOwner> {
  const { data } = await apiClient.patch<ConversationWithOwner>(`/conversations/${conversationId}/participants`, payload);
  return data;
}

// Xoa mem CUA CHINH NGUOI GUI (khong nam trong 6 endpoint dac ta REST goc - xem
// messages.service.ts:deleteMessage) - "thu hoi tin nhan", nice-to-have.
export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  await apiClient.delete(`/conversations/${conversationId}/messages/${messageId}`);
}

// 28/09/2026: GET /conversations (ConversationListItem) CO CHU DINH khong tra ve createdBy (xem
// ghi chu tai ConversationWithOwner trong types/index.ts), nhung UI can biet "nguoi tao nhom" de
// gate nut "Quan ly thanh vien" giong dung dieu kien OR ma backend tu kiem tra
// (ConversationsService.updateParticipants(): isOwner || MESSAGE_MANAGE_GROUP). Cach duy nhat FE
// biet duoc createdBy la tu 3 nguon: (a) response tao cuoc tro chuyen, (b) response cap nhat thanh
// vien, (c) payload socket conversation:new/conversation:updated - ca 3 deu la ConversationWithOwner.
// Luu lai CUC BO (localStorage, mirror dung pattern getLocalNotifications/saveLocalNotification o
// features/notifications/api.ts) de "nho" qua cac lan tai lai trang cho DEN KHI mot trong 3 su
// kien tren xay ra it nhat 1 lan trong trinh duyet nay - gioi han da biet: nguoi dung MOI dang
// nhap lan dau (chua tung nhan 1 trong 3 su kien tren) vao 1 nhom da co san se KHONG thay nut nay
// cho toi khi co thay doi thanh vien tiep theo, du ho co the la nguoi tao that su. Day la gioi han
// cua chinh REST contract (khong sua duoc backend), khong phai loi FE.
const CONVERSATION_CREATOR_CACHE_PREFIX = 'ec_conversation_creators_';
export const CONVERSATION_CREATORS_UPDATED_EVENT = 'ec_conversation_creators_updated';

function conversationCreatorCacheKey(userId: string): string {
  return `${CONVERSATION_CREATOR_CACHE_PREFIX}${userId}`;
}

export function getKnownConversationCreator(conversationId: string): string | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(conversationCreatorCacheKey(userId));
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return map[conversationId] ?? null;
  } catch {
    return null;
  }
}

export function rememberConversationCreator(conversationId: string, createdBy: string): void {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  try {
    const key = conversationCreatorCacheKey(userId);
    const raw = localStorage.getItem(key);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (map[conversationId] === createdBy) return;
    map[conversationId] = createdBy;
    localStorage.setItem(key, JSON.stringify(map));
    window.dispatchEvent(new Event(CONVERSATION_CREATORS_UPDATED_EVENT));
  } catch {
    // ignore
  }
}
