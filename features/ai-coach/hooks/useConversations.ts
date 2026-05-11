import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';

export interface ConversationRow {
  id: string;
  title: string | null;
  last_message_at: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export function useConversations() {
  return useQuery<ConversationRow[]>({
    queryKey: ['ai-conversations'],
    staleTime: 30_000,
    queryFn: async () => {
      const data = await mapSb(
        supabase
          .from('ai_conversations')
          .select('id, title, last_message_at, created_at')
          .order('last_message_at', { ascending: false })
          .limit(50),
      );
      return data as ConversationRow[];
    },
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery<MessageRow[]>({
    queryKey: ['ai-messages', conversationId],
    enabled: !!conversationId,
    staleTime: 0,
    queryFn: async () => {
      if (!conversationId) return [];
      const data = await mapSb(
        supabase
          .from('ai_messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      );
      return data as MessageRow[];
    },
  });
}
