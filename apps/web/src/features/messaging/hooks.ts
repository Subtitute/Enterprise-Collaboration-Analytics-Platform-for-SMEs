import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { connectMessagingSocket, disconnectMessagingSocket } from '@/lib/socket';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import type { ChatMessage, ConversationWithOwner } from '@/types';
import {
  CONVERSATION_CREATORS_UPDATED_EVENT,
  createConversation,
  deleteMessage,
  fetchConversations,
  fetchMessages,
  getKnownConversationCreator,
  markConversationRead,
  rememberConversationCreator,
  sendMessage,
  updateConversationParticipants,
} from './api';
import type { CreateConversationPayload, FetchMessagesParams, UpdateParticipantsPayload } from './api';

const CONVERSATIONS_KEY = ['messaging', 'conversations'] as const;
const MESSAGES_PAGE_SIZE = 50;
const messagesKey = (conversationId: string) => ['messaging', 'messages', conversationId] as const;

export function useConversationsQuery() {
  return useQuery({ queryKey: CONVERSATIONS_KEY, queryFn: fetchConversations });
}

/** Tong so tin nhan chua doc tren TAT CA cuoc tro chuyen - dung cho badge o Sidebar (hien tren
 *  MOI trang, khong chi trang Nhan tin, mirror NotificationBell o Topbar). */
export function useUnreadMessagesCount(): number {
  const { data } = useConversationsQuery();
  return (data ?? []).reduce((sum, c) => sum + c.unreadCount, 0);
}

export function useCreateConversation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConversationPayload) => createConversation(payload),
    onSuccess: (conversation) => {
      rememberConversationCreator(conversation.id, conversation.createdBy);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
    onError: (error) => toast.error(t('messaging:toast.createConversationError'), extractErrorMessage(error)),
  });
}

export function useMessagesQuery(conversationId: string | undefined) {
  return useQuery({
    queryKey: messagesKey(conversationId ?? ''),
    queryFn: () => fetchMessages(conversationId as string, { limit: MESSAGES_PAGE_SIZE }),
    enabled: Boolean(conversationId),
    // 28/09/2026: cache nay duoc "nuoi song" boi socket (useMessagingSocket ben duoi), KHONG phai
    // polling - staleTime dai + khong tu refetch khi focus lai cua so de tranh 1 refetch nen (goi
    // lai queryFn KHONG kem beforeMessageId) am tham GHI DE mat cac trang tin nhan CU HON nguoi
    // dung da tai qua useLoadOlderMessages() ben duoi.
    staleTime: Infinity,
    refetchOnMount: false,
  });
}

/** Tai cac tin nhan CU HON (cuon len dau doan chat) - noi cursor beforeMessageId, xem
 *  messages.service.ts:listMessages(). Tra ve hasMore (uoc luong: trang vua tai < kich thuoc trang
 *  nghia la da het, khong co field dem tong so tu backend). */
export function useLoadOlderMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setHasMore(true);
  }, [conversationId]);

  const mutation = useMutation({
    mutationFn: (beforeMessageId: string) => {
      if (!conversationId) return Promise.resolve([] as ChatMessage[]);
      const params: FetchMessagesParams = { limit: MESSAGES_PAGE_SIZE, beforeMessageId };
      return fetchMessages(conversationId, params);
    },
    onSuccess: (olderMessages) => {
      if (!conversationId) return;
      if (olderMessages.length < MESSAGES_PAGE_SIZE) setHasMore(false);
      if (olderMessages.length === 0) return;
      queryClient.setQueryData<ChatMessage[]>(messagesKey(conversationId), (current = []) => {
        const existingIds = new Set(current.map((m) => m.id));
        const newOnes = olderMessages.filter((m) => !existingIds.has(m.id));
        return [...newOnes, ...current];
      });
    },
    onError: (error) => toast.error(t('messaging:toast.loadOlderError'), extractErrorMessage(error)),
  });

  return { ...mutation, hasMore };
}

export function useSendMessage(conversationId: string) {
  const { t } = useTranslation();
  return useMutation({
    // 28/09/2026: KHONG cap nhat cache tin nhan o day (kem ca onSuccess) - message:new tu socket
    // (useMessagingSocket ben duoi) la nguon duy nhat de them tin nhan vao danh sach, tranh hien
    // thi trung 2 lan (REST response + socket event) cho chinh nguoi gui.
    mutationFn: (body: string) => sendMessage(conversationId, body),
    onError: (error) => toast.error(t('messaging:toast.sendError'), extractErrorMessage(error)),
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

export function useUpdateParticipants(conversationId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateParticipantsPayload) => updateConversationParticipants(conversationId, payload),
    onSuccess: (conversation) => {
      rememberConversationCreator(conversation.id, conversation.createdBy);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      toast.success(t('messaging:toast.participantsUpdated'));
    },
    onError: (error) => toast.error(t('messaging:toast.participantsUpdateError'), extractErrorMessage(error)),
  });
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (messageId: string) => deleteMessage(conversationId, messageId),
    onSuccess: (_result, messageId) => {
      // 28/09/2026: backend KHONG phat socket event khi xoa (chi soft-delete, xem
      // messages.service.ts:deleteMessage - khong co gateway.emit* nao o day) - tu cap nhat cache
      // CUC BO cho nguoi vua xoa; nguoi tham gia khac se thay tin nhan bien mat o lan tai lai ke
      // tiep (GET .../messages da loc deletedAt IS NULL), KHONG realtime cho ho - gioi han cua
      // chinh backend, khong sua duoc tu FE.
      queryClient.setQueryData<ChatMessage[]>(messagesKey(conversationId), (current = []) =>
        current.filter((m) => m.id !== messageId),
      );
    },
    onError: (error) => toast.error(t('messaging:toast.deleteMessageError'), extractErrorMessage(error)),
  });
}

/** true neu nguoi dang dang nhap la nguoi tao cuoc tro chuyen GROUP nay, THEO HIEU BIET CUC BO
 *  cua trinh duyet nay (xem ghi chu tai getKnownConversationCreator/rememberConversationCreator,
 *  api.ts) - dung KET HOP voi permission MESSAGE_MANAGE_GROUP de gate nut "Quan ly thanh vien",
 *  dung dieu kien OR ma backend tu kiem tra. */
export function useIsKnownConversationCreator(conversationId: string | undefined): boolean {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const handler = () => forceRerender((n) => n + 1);
    window.addEventListener(CONVERSATION_CREATORS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CONVERSATION_CREATORS_UPDATED_EVENT, handler);
  }, []);

  if (!conversationId || !currentUserId) return false;
  return getKnownConversationCreator(conversationId) === currentUserId;
}

/** Ket noi WS nhan tin realtime - goi 1 LAN DUY NHAT o AppShell (mirror useNotificationSocket) de
 *  badge o Sidebar cap nhat duoc tren MOI trang, khong chi trang Nhan tin. ConversationThread
 *  (mo 1 cuoc tro chuyen cu the) dung getMessagingSocket() de emit joinConversation/
 *  leaveConversation tren CHINH socket nay, KHONG ket noi lai (xem ghi chu tai lib/socket.ts). */
export function useMessagingSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      disconnectMessagingSocket();
      return;
    }
    const socket = connectMessagingSocket(accessToken);

    const onNewMessage = ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
      // Gateway day event nay QUA CA room hoi thoai LAN room ca nhan cua tung nguoi tham gia (xem
      // messaging.gateway.ts:emitNewMessage) - nguoi dang mo DUNG cuoc tro chuyen nay (da join room)
      // se nhan 2 lan, dedupe theo id truoc khi them.
      queryClient.setQueryData<ChatMessage[]>(messagesKey(conversationId), (current) => {
        if (!current) return current; // Chua tung mo cuoc tro chuyen nay - khong tao cache moi o day.
        if (current.some((m) => m.id === message.id)) return current;
        return [...current, message];
      });
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    };
    const onConversationChanged = ({ conversation }: { conversation: ConversationWithOwner }) => {
      rememberConversationCreator(conversation.id, conversation.createdBy);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    };

    socket.on('message:new', onNewMessage);
    socket.on('conversation:new', onConversationChanged);
    socket.on('conversation:updated', onConversationChanged);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('conversation:new', onConversationChanged);
      socket.off('conversation:updated', onConversationChanged);
    };
  }, [accessToken, queryClient]);
}
