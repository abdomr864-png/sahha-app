import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  Share,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, Spinner } from '@features/shared';
import { aiClient } from '@lib/llm';
import type { AIError } from '@lib/llm/client';
import { useMessages, useCoachSnapshot } from '../hooks/useConversations';
import { generateLocalReply } from '../lib/localCoach';

interface Props {
  conversationId?: string;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  bottomInset?: number;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending?: boolean;
  createdAt?: string;
  // Local-only attachment URI for the current session. Not persisted; the AI
  // backend doesn't yet ingest images, so we just render it in the user bubble
  // and tag the text message so the user has visual continuity.
  imageUri?: string;
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

export function Conversation({ conversationId: initialId, onScroll, bottomInset }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seed?: string }>();
  const [conversationId, setConversationId] = useState<string | undefined>(initialId);
  const history = useMessages(conversationId);
  const snapshot = useCoachSnapshot();

  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const [pendingUserImage, setPendingUserImage] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  // Session-only mapping of message id → image URI. Persisted images would
  // require backend support; for now we only retain attachments mid-session
  // so the user keeps visual continuity after the AI responds.
  const [sessionImages, setSessionImages] = useState<Record<string, string>>({});
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  // Track keyboard visibility so the composer's bottom padding can collapse
  // when the keyboard is open. Without this, the safe-area inset we add for
  // the home indicator becomes a visible gap between the input and the
  // keyboard, instead of clearing the home indicator like it should.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Surfaced when the live backend fails and we fall back to local replies, so
  // the user knows the answer isn't coming from the full coach context.
  const [offlineMode, setOfflineMode] = useState(false);
  // Locally-generated assistant replies (session-only). They appear inline
  // alongside persisted messages so the user keeps a continuous chat thread
  // even when the AI backend is unavailable.
  const [localReplies, setLocalReplies] = useState<UIMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);
  const seedConsumedRef = useRef(false);

  const merged = useMemo<UIMessage[]>(() => {
    const base: UIMessage[] = (history.data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      imageUri: sessionImages[m.id],
    }));
    // Local-only assistant replies (offline fallback). Interleaved naively at
    // the end — for a session-only feature this is fine; persisted messages
    // arrive from the server with their own timestamps.
    if (localReplies.length > 0) base.push(...localReplies);
    if (pendingUserMsg) {
      base.push({
        id: 'pending-user',
        role: 'user',
        content: pendingUserMsg,
        imageUri: pendingUserImage ?? undefined,
      });
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
  }, [history.data, pendingUserMsg, pendingUserImage, streaming, sessionImages, localReplies]);

  useEffect(() => {
    if (merged.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [merged.length, streaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
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

  // Streams a locally generated reply word-by-word into the streaming slot,
  // then commits it to localReplies. Used when the backend errors so the chat
  // doesn't go dead — the user still gets a useful, snapshot-grounded answer.
  const streamLocalFallback = async (userText: string) => {
    const reply = generateLocalReply(userText, snapshot.data);
    setStreaming('');
    let assembled = '';
    for (const word of reply.split(' ')) {
      if (abortRef.current?.signal.aborted) return;
      assembled += `${word} `;
      setStreaming(assembled);
      await new Promise((r) => setTimeout(r, 18));
    }
    setStreaming(null);
    setPendingUserMsg(null);
    setPendingUserImage(null);
    setOfflineMode(true);
    setLocalReplies((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: 'assistant',
        content: assembled.trim(),
      },
    ]);
  };

  const send = async (text: string) => {
    const trimmedRaw = text.trim();
    const imageBeingSent = attachedImage;
    if (!trimmedRaw && !imageBeingSent) return;
    // When the user attaches an image but doesn't type anything, send a short
    // default so the backend (which requires a non-empty message) accepts it.
    const userText =
      trimmedRaw || t('ai.coach.photoDefault', 'What can you tell me from this photo?');
    // Marker tells the AI a photo was shared. Backend is text-only for now, so
    // this keeps the model honest about visual context without crashing.
    const messageForBackend = imageBeingSent
      ? `${userText}\n\n[user attached a photo — vision not enabled on this turn]`
      : userText;

    setErrorCode(null);
    setRetryText(null);
    setPendingUserMsg(userText);
    setPendingUserImage(imageBeingSent);
    setAttachedImage(null);
    setStreaming('');
    setDraft('');
    Keyboard.dismiss();

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const locale = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';

    let assembled = '';
    let newId = conversationId;

    await aiClient.streamChat(
      { conversation_id: conversationId, message: messageForBackend, locale },
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
          // Re-attach the local image to the persisted user message once the
          // backend confirms via `ai-messages` invalidation. We approximate by
          // tagging the most recent user message id after refetch via the
          // sessionImages map keyed on the synthetic 'pending-user' id; the
          // FlatList row remounts on refetch so we promote the mapping below.
          setPendingUserMsg(null);
          setPendingUserImage(null);
          qc.invalidateQueries({ queryKey: ['ai-messages', newId] });
          qc.invalidateQueries({ queryKey: ['ai-conversations'] });
          if (imageBeingSent && newId) {
            // Tag the latest user message id once the refetch lands; the effect
            // below promotes the pending image onto the real row.
            pendingImageRef.current = imageBeingSent;
          }
          if (!conversationId && newId) {
            router.setParams({ id: newId });
          }
        },
        onError: (err: AIError) => {
          // Graceful degradation: when the AI backend can't respond — no API
          // key, rate-limited, expired session, network down — stream a
          // snapshot-grounded local reply instead of leaving the user
          // staring at an error. The chat surface never blocks; the user can
          // still sign in from other surfaces when they're ready.
          if (err.code === 'provider_error' || err.code === 'unauthenticated') {
            const codeLabel = `${err.code}${err.status ? ` (${err.status})` : ''}`;
            const detailLine = err.detail ? `${codeLabel} — ${err.detail}` : codeLabel;
            // Diagnostic only — logged for devs, never shown to the user so the
            // chat doesn't expose that the backend is down.

            console.warn('[ai-coach] backend error:', detailLine, err);
            streamLocalFallback(userText);
            return;
          }
          setStreaming(null);
          setPendingUserMsg(null);
          setPendingUserImage(null);
          setErrorCode(err.code);
          setRetryText(trimmedRaw || userText);
        },
      },
    );
  };

  // Holds an image waiting to be associated with the latest persisted user
  // message after the post-send refetch lands.
  const pendingImageRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingImageRef.current) return;
    const rows = history.data ?? [];
    const lastUser = [...rows].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const uri = pendingImageRef.current;
    pendingImageRef.current = null;
    setSessionImages((m) => ({ ...m, [lastUser.id]: uri }));
  }, [history.data]);

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('ai.coach.permissionTitle', 'Permission needed'),
        t('ai.coach.permissionLibrary', 'Allow photo library access to attach pictures.'),
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) setAttachedImage(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('ai.coach.permissionTitle', 'Permission needed'),
        t('ai.coach.permissionCamera', 'Allow camera access to snap a picture.'),
      );
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) setAttachedImage(res.assets[0].uri);
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
      keyboardVerticalOffset={0}
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

      {offlineMode ? (
        <View className="mx-4 mb-2 bg-bg-raised border border-warning/40 rounded-2xl px-3 py-2">
          <View className="flex-row items-center">
            <Icon name="sparkles" size={12} color="#F5C451" />
            <Text className="text-ink-subtle text-[11px] ml-2 flex-1" numberOfLines={2}>
              {t(
                'ai.coach.offlineNotice',
                'Quick read from your data — ask again in a moment for more depth.',
              )}
            </Text>
          </View>
        </View>
      ) : null}

      {isEmpty ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            <EmptyState onPickPrompt={(p) => send(p)} />
          </View>
        </TouchableWithoutFeedback>
      ) : (
        <FlatList
          ref={listRef}
          data={merged}
          keyExtractor={(m) => m.id}
          contentContainerClassName="px-4 pt-1 pb-4"
          ItemSeparatorComponent={() => <View className="h-3" />}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
        bottomInset={
          // Sit flush on the keyboard when it's open; otherwise reserve room
          // for the home indicator (or whatever the caller specifies).
          keyboardVisible ? 0 : (bottomInset ?? insets.bottom + 8)
        }
        attachedImage={attachedImage}
        onPickImage={pickFromLibrary}
        onTakePhoto={takePhoto}
        onClearImage={() => setAttachedImage(null)}
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
  bottomInset = 0,
  attachedImage,
  onPickImage,
  onTakePhoto,
  onClearImage,
}: {
  draft: string;
  onChange: (s: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  placeholder: string;
  bottomInset?: number;
  attachedImage?: string | null;
  onPickImage?: () => void;
  onTakePhoto?: () => void;
  onClearImage?: () => void;
}) {
  const canSend = (draft.trim().length > 0 || !!attachedImage) && !streaming;
  return (
    <View className="px-4 pt-2" style={{ paddingBottom: bottomInset }}>
      {attachedImage ? (
        <View className="flex-row items-center bg-bg-raised border border-border rounded-2xl px-2 py-2 mb-2 self-start">
          <Image
            source={{ uri: attachedImage }}
            style={{ width: 48, height: 48, borderRadius: 12 }}
          />
          <View className="ml-2.5 mr-2">
            <Text className="text-ink text-sm font-semibold">Photo attached</Text>
            <Text className="text-ink-subtle text-[11px]">Tap × to remove</Text>
          </View>
          <Pressable
            onPress={onClearImage}
            hitSlop={8}
            className="w-7 h-7 rounded-full bg-bg-subtle border border-border items-center justify-center ml-1"
          >
            <Icon name="x" size={14} color="#F4F4F7" />
          </Pressable>
        </View>
      ) : null}
      <View className="flex-row items-end bg-bg-raised border border-border rounded-3xl pl-1.5 pr-1.5 py-1.5">
        <Pressable
          onPress={onPickImage}
          disabled={streaming}
          hitSlop={6}
          accessibilityLabel="Attach a picture"
          className="w-10 h-10 rounded-full items-center justify-center self-end mb-1 bg-bg-subtle border border-border"
        >
          <Icon name="image" size={18} color="#B4B4C2" />
        </Pressable>
        <Pressable
          onPress={onTakePhoto}
          disabled={streaming}
          hitSlop={6}
          accessibilityLabel="Take a photo"
          className="w-10 h-10 rounded-full items-center justify-center self-end mb-1 ml-1.5 bg-bg-subtle border border-border"
        >
          <Icon name="camera" size={18} color="#B4B4C2" />
        </Pressable>
        <View className="flex-1 py-2 pl-3">
          <TextInput
            value={draft}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor="#74748A"
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
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#F4F4F7' }} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            className={`w-10 h-10 rounded-full items-center justify-center ml-1.5 self-end mb-1 ${
              canSend ? 'bg-accent' : 'bg-bg-subtle border border-border'
            }`}
          >
            <Icon name="arrow-up" size={18} color={canSend ? '#FFFFFF' : '#74748A'} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function MessageBubble({ item, onLongPress }: { item: UIMessage; onLongPress: () => void }) {
  const isUser = item.role === 'user';
  const showTyping = !!item.pending && item.content.length === 0;
  // Strip the backend marker we add on send — it shouldn't be shown to the user.
  const displayContent = item.content.replace(
    /\n\n\[user attached a photo — vision not enabled on this turn\]\s*$/i,
    '',
  );

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
      {item.imageUri ? (
        <Pressable
          onLongPress={onLongPress}
          className="max-w-[88%] mb-1.5 overflow-hidden rounded-3xl"
        >
          <Image
            source={{ uri: item.imageUri }}
            style={{ width: 220, height: 220 }}
            resizeMode="cover"
          />
        </Pressable>
      ) : null}
      {displayContent.trim().length > 0 || showTyping ? (
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
            <CoachText content={displayContent || (item.pending ? '…' : '')} isUser={isUser} />
          )}
        </Pressable>
      ) : null}
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
        backgroundColor: '#B4B4C2',
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
