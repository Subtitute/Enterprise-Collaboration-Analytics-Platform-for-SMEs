import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  askChatbot,
  createChatbotConversation,
  deleteChatbotConversation,
  fetchChatbotConversations,
  fetchChatbotMessages,
} from './api';
import type { ChatbotMessage } from './api';

// 24/10/2026: Chat bot noi bo - hook React Query cho features/chatbot (mirror features/messaging/hooks.ts).
const CONVERSATIONS_KEY = ['chatbot', 'conversations'] as const;
const messagesKey = (conversationId: string) => ['chatbot', 'messages', conversationId] as const;

export function useChatbotConversations(enabled: boolean) {
  return useQuery({ queryKey: CONVERSATIONS_KEY, queryFn: fetchChatbotConversations, enabled });
}

export function useChatbotMessages(conversationId: string | null) {
  return useQuery({
    queryKey: messagesKey(conversationId ?? ''),
    queryFn: () => fetchChatbotMessages(conversationId as string),
    enabled: Boolean(conversationId),
    // Tin nhan chi doi khi CHINH nguoi dung hoi (cache duoc cap nhat truc tiep o useAskChatbot) -
    // khong tu refetch khi focus lai cua so.
    staleTime: Infinity,
  });
}

export function useCreateChatbotConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createChatbotConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

/** Loi duoc component hien TRUC TIEP trong panel (khong qua toast) - xem ChatbotThread. */
export function useAskChatbot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, question }: { conversationId: string; question: string }) =>
      askChatbot(conversationId, question),
    onSuccess: (result) => {
      queryClient.setQueryData<ChatbotMessage[]>(messagesKey(result.conversation.id), (previous) => [
        ...(previous ?? []),
        result.userMessage,
        result.assistantMessage,
      ]);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useDeleteChatbotConversation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteChatbotConversation,
    onSuccess: (_data, conversationId) => {
      queryClient.removeQueries({ queryKey: messagesKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
    onError: (error) => toast.error(t('chatbot:toast.deleteError'), extractErrorMessage(error)),
  });
}
