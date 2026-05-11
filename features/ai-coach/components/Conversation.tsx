import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, Spinner } from '@features/shared';
import { aiClient } from '@lib/llm';
import type { AIError } from '@lib/llm/client';
import { useMessages, useCoachSnapshot } from '../hooks/useConversations';

interface Props {
  conversationId?: string;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending?: boolean;
  createdAt?: string;
}

const EMPTY_PROMPTS: {
  icon: 'dumbbell' | 'apple' | 'heart' | 'target' | 'flame' | 'sparkles';
  key: string;
  fb: string;
  hintKey: string;
  hintFb: string;
}[] = [
  {
    icon: 'dumbbell',
    key: 'ai.coach.emptyPrompts.planToday',
    fb: 'Plan a workout for me today',
    hintKey: 'ai.coach.emptyPrompts.planTodayHint',
    hintFb: 'Calibrated to your last 7 days',
  },
  {
    icon: 'apple',
    key: 'ai.coach.emptyPrompts.macros',
    fb: 'How are my macros looking?',
    hintKey: 'ai.coach.emptyPrompts.macrosHint',
    hintFb: 'Calories, protein, what to eat next',
  },
  {
    icon: 'heart',
    key: 'ai.coach.emptyPrompts.recovery',
    fb: 'Am I recovered enough to train hard?',
    hintKey: 'ai.coach.emptyPrompts.recoveryHint',
    hintFb: 'Sleep, mood, and stress check',
  },
  {
    icon: 'target',
    key: 'ai.coach.emptyPrompts.progress',
    fb: 'Review my progress so far',
    hintKey: 'ai.coach.emptyPrompts.progressHint',
    hintFb: 'PRs, volume, what to push next',
  },
];

export function Conversation({ conversationId: initialId }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ seed?: string }>();
  const [conversationId, setConversationId] = useState<string | undefined>(initialId);
  const history = useMessages(conversationId);
  const snapshot = useCoachSnapshot();

  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);
  const seedConsumedRef = useRef(false);

  const merged = useMemo<UIMessage[]>(() => {
    const base: UIMessage[] = (history.data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
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
    if (merged.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [merged.length, streaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Auto-send a seeded prompt when arriving with ?seed=... from a quick chip.
  useEffect(() => {
    if (seedConsumedRef.current) return;
    if (conversationId) return;
    const seed = typeof params.seed === 'string' ? params.seed : null;
    if (!seed) return;
    seedConsumedRef.current = true;
    send(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.seed]);

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

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(null);
    setPendingUserMsg(null);
  };

  // Don't show the spinner unless we are actively fetching an existing
  // conversation. For brand-new chats `enabled: false` makes the query stay
  // in `pending`, which would otherwise hide the empty state forever.
  if (history.isPending && history.isFetching && conversationId) return <Spinner />;

  const isEmpty = merged.length === 0;
  const snap = snapshot.data;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Context strip — only meaningful once we have real signal */}
      {snap && (snap.workouts_7d > 0 || snap.current_streak > 0) ? (
        <View className="mx-4 mb-2 mt-1 flex-row items-center bg-bg-raised border border-accent/25 rounded-full px-3 py-2">
          <View className="w-5 h-5 rounded-full bg-accent/20 items-center justify-center">
            <Icon name="sparkles" size={11} color="#22D3EE" />
          </View>
          <Text className="text-ink-subtle text-[11px] ml-2 flex-1" numberOfLines={1}>
            {snap.workouts_7d > 0
              ? t('ai.coach.contextWithWorkouts', {
                  defaultValue: 'Using your last 7 days · {{n}} workouts · {{streak}}d streak',
                  n: snap.workouts_7d,
                  streak: snap.current_streak,
                })
              : t('ai.coach.contextNoWorkouts', 'Using your profile, sleep, and nutrition data.')}
          </Text>
        </View>
      ) : null}

      {isEmpty ? (
        <EmptyState onPickPrompt={(p) => send(p)} />
      ) : (
        <FlatList
          ref={listRef}
          data={merged}
          keyExtractor={(m) => m.id}
          contentContainerClassName="px-4 pt-1 pb-4"
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <MessageBubble item={item} onLongPress={() => onLongPress(item.content)} />
          )}
        />
      )}

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

      <Composer
        draft={draft}
        onChange={setDraft}
        onSend={() => send(draft)}
        onStop={stopStreaming}
        streaming={streaming != null}
        placeholder={t('ai.coach.placeholder', 'Ask your coach…')}
      />
    </KeyboardAvoidingView>
  );
}

function Composer({
  draft,
  onChange,
  onSend,
  onStop,
  streaming,
  placeholder,
}: {
  draft: string;
  onChange: (s: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  placeholder: string;
}) {
  const canSend = draft.trim().length > 0 && !streaming;
  return (
    <View className="px-4 pb-4 pt-2">
      <View className="flex-row items-end bg-bg-raised border border-border rounded-3xl pl-4 pr-1.5 py-1.5">
        <View className="flex-1 py-2">
          <TextInput
            value={draft}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor="#71717A"
            className="text-ink text-base"
            multiline
            style={{ maxHeight: 140, minHeight: 22 }}
            editable={!streaming}
          />
        </View>
        {streaming ? (
          <Pressable
            onPress={onStop}
            className="w-10 h-10 rounded-full items-center justify-center bg-bg-subtle border border-border ml-1.5 self-end mb-1"
          >
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#F4F4F5' }} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            className={`w-10 h-10 rounded-full items-center justify-center ml-1.5 self-end mb-1 ${
              canSend ? 'bg-accent' : 'bg-bg-subtle border border-border'
            }`}
          >
            <Icon name="arrow-up" size={18} color={canSend ? '#FFFFFF' : '#71717A'} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function MessageBubble({ item, onLongPress }: { item: UIMessage; onLongPress: () => void }) {
  const isUser = item.role === 'user';
  const showTyping = !!item.pending && item.content.length === 0;

  return (
    <View className={isUser ? 'items-end' : 'items-start'}>
      {!isUser ? (
        <View className="flex-row items-center mb-1.5 ml-1">
          <View className="w-5 h-5 rounded-full bg-accent/20 items-center justify-center mr-1.5">
            <Icon name="sparkles" size={10} color="#22D3EE" />
          </View>
          <Text className="text-ink-subtle text-[10px] font-bold uppercase tracking-wider">
            Coach
          </Text>
        </View>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        className={`max-w-[88%] px-4 py-3 ${
          isUser
            ? 'bg-accent rounded-3xl rounded-br-md'
            : 'bg-bg-raised border border-border rounded-3xl rounded-bl-md'
        }`}
      >
        {showTyping ? (
          <TypingDots />
        ) : (
          <CoachText content={item.content || (item.pending ? '…' : '')} isUser={isUser} />
        )}
      </Pressable>
    </View>
  );
}

function CoachText({ content, isUser }: { content: string; isUser: boolean }) {
  const text = content.trim();
  const blocks = text.split(/\n\n+/);
  const baseClass = isUser
    ? 'text-accent-contrast text-base leading-6'
    : 'text-ink text-base leading-6';

  return (
    <View>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const isBulletBlock = lines.every((l) => /^\s*[-•*]\s+/.test(l));
        if (isBulletBlock) {
          return (
            <View key={i} className={i === 0 ? '' : 'mt-2.5'}>
              {lines.map((line, j) => (
                <View key={j} className="flex-row pr-2 mt-1">
                  <Text className={baseClass}>• </Text>
                  <Text className={`${baseClass} flex-1`} selectable>
                    {renderInline(line.replace(/^\s*[-•*]\s+/, ''), baseClass)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} className={`${baseClass} ${i === 0 ? '' : 'mt-2.5'}`} selectable>
            {renderInline(block, baseClass)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(text: string, baseClass: string) {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Text key={`b${key++}`} className={`${baseClass} font-bold`}>
        {m[1]}
      </Text>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function TypingDots() {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const make = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 360,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 360,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
    const anims = [make(a, 0), make(b, 120), make(c, 240)];
    anims.forEach((x) => x.start());
    return () => anims.forEach((x) => x.stop());
  }, [a, b, c]);

  const dot = (v: Animated.Value) => (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#A1A1AA',
        marginHorizontal: 2,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [
          {
            translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
          },
        ],
      }}
    />
  );

  return (
    <View className="flex-row items-center py-1">
      {dot(a)}
      {dot(b)}
      {dot(c)}
    </View>
  );
}

function EmptyState({ onPickPrompt }: { onPickPrompt: (prompt: string) => void }) {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View className="flex-1 px-5 pt-6">
      <View className="items-center mb-6">
        <View className="w-24 h-24 items-center justify-center mb-4">
          <Animated.View
            style={{
              position: 'absolute',
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: '#22D3EE',
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] }),
              transform: [
                {
                  scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] }),
                },
              ],
            }}
          />
          <View className="w-16 h-16 rounded-3xl bg-accent/20 border border-accent/40 items-center justify-center">
            <Icon name="sparkles" size={30} color="#22D3EE" />
          </View>
        </View>
        <Text className="text-ink text-2xl font-extrabold text-center tracking-tight">
          {t('ai.coach.startTitle', 'Coach is ready when you are')}
        </Text>
        <Text className="text-ink-subtle text-sm text-center mt-2 px-4">
          {t(
            'ai.coach.startSubtitle',
            'Ask about training, recovery, food, or motivation. I already know your stats.',
          )}
        </Text>
      </View>

      <View>
        {EMPTY_PROMPTS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => onPickPrompt(t(p.key, p.fb))}
            className="flex-row items-center bg-bg-raised border border-border rounded-2xl px-4 py-3.5 mb-2.5 active:opacity-90"
            style={({ pressed }) => [pressed ? { transform: [{ scale: 0.99 }] } : null]}
          >
            <View className="w-10 h-10 rounded-xl bg-accent/15 items-center justify-center mr-3">
              <Icon name={p.icon} size={18} color="#22D3EE" />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-[15px] font-semibold" numberOfLines={1}>
                {t(p.key, p.fb)}
              </Text>
              <Text className="text-ink-subtle text-xs mt-0.5" numberOfLines={1}>
                {t(p.hintKey, p.hintFb)}
              </Text>
            </View>
            <Icon name="arrow-up" size={14} color="#52525B" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
