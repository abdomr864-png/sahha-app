import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Icon, Spinner } from '@features/shared';
import { aiClient } from '@lib/llm';
import type { AIError } from '@lib/llm/client';
import { useMessages } from '../hooks/useConversations';

interface Props {
  /** undefined for a brand-new chat. */
  conversationId?: string;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending?: boolean;
}

export function Conversation({ conversationId: initialId }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | undefined>(initialId);
  const history = useMessages(conversationId);

  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);

  const merged = useMemo<UIMessage[]>(() => {
    const base: UIMessage[] = (history.data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }));
    if (pendingUserMsg) {
      base.push({ id: 'pending-user', role: 'user', content: pendingUserMsg });
    }
    if (streaming != null) {
      base.push({
        id: 'streaming',
        role: 'assistant',
        content: streaming,
        pending: true,
      });
    }
    return base;
  }, [history.data, pendingUserMsg, streaming]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [merged.length, streaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setErrorCode(null);
    setRetryText(null);
    setPendingUserMsg(trimmed);
    setStreaming('');
    setDraft('');

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const locale = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';

    let assembled = '';
    let newId = conversationId;

    await aiClient.streamChat(
      { conversation_id: conversationId, message: trimmed, locale },
      {
        signal: abortRef.current.signal,
        onConversation: (id) => {
          newId = id;
          if (!conversationId) setConversationId(id);
        },
        onToken: (chunk) => {
          assembled += chunk;
          setStreaming(assembled);
        },
        onDone: () => {
          setStreaming(null);
          setPendingUserMsg(null);
          qc.invalidateQueries({ queryKey: ['ai-messages', newId] });
          qc.invalidateQueries({ queryKey: ['ai-conversations'] });
          if (!conversationId && newId) {
            // Replace URL so a refresh resumes the chat.
            router.setParams({ id: newId });
          }
        },
        onError: (err: AIError) => {
          setStreaming(null);
          setPendingUserMsg(null);
          setErrorCode(err.code);
          setRetryText(trimmed);
        },
      },
    );
  };

  const onLongPress = (text: string) => {
    Alert.alert(t('ai.coach.message', 'Message'), undefined, [
      { text: t('ai.coach.share', 'Share / copy'), onPress: () => Share.share({ message: text }) },
      { text: t('ai.coach.report', 'Report'), style: 'destructive', onPress: () => {} },
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
    ]);
  };

  if (history.isPending && conversationId) return <Spinner />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <FlatList
        ref={listRef}
        data={merged}
        keyExtractor={(m) => m.id}
        contentContainerClassName="px-4 pt-2 pb-4"
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => onLongPress(item.content)}
            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              item.role === 'user'
                ? 'bg-accent self-end'
                : 'bg-bg-raised border border-border self-start'
            }`}
          >
            <Text className={item.role === 'user' ? 'text-accent-contrast' : 'text-ink'} selectable>
              {item.content || (item.pending ? '…' : '')}
            </Text>
          </Pressable>
        )}
      />

      {errorCode ? (
        <View className="mx-4 mb-2 p-3 rounded-2xl bg-bg-raised border border-danger">
          <Text className="text-danger text-sm mb-2">{t(`errors.ai.${errorCode}`, errorCode)}</Text>
          {retryText ? (
            <Pressable onPress={() => send(retryText)} className="self-start">
              <Text className="text-accent font-bold">{t('common.retry', 'Retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row items-end px-4 pb-4 pt-2 gap-2">
        <View className="flex-1 bg-bg-raised border border-border rounded-2xl px-4 py-3">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('ai.coach.placeholder', 'Ask your coach…')}
            placeholderTextColor="#A1A1AA"
            className="text-ink text-base"
            multiline
            style={{ maxHeight: 120 }}
            editable={!streaming}
          />
        </View>
        <Pressable
          onPress={() => send(draft)}
          disabled={!!streaming || draft.trim().length === 0}
          className={`w-12 h-12 rounded-2xl items-center justify-center ${
            streaming || draft.trim().length === 0 ? 'bg-bg-raised' : 'bg-accent'
          }`}
        >
          <Icon name="arrow-up" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
