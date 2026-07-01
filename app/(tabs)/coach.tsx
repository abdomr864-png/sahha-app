import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Header, Icon, IconButton, Screen, Spinner } from '@features/shared';
import { Conversation, useConversations } from '@features/ai-coach';

// Estimated height of the collapsible header row (title + buttons + paddings).
// Used as the translate distance for the slide-up/down animation.
const HEADER_HEIGHT = 80;

export default function CoachTab() {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [newNonce, setNewNonce] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  const headerProgress = useRef(new Animated.Value(1)).current; // 1 = visible, 0 = hidden
  const lastY = useRef(0);
  const hiddenRef = useRef(false);

  const setHeaderVisible = (visible: boolean) => {
    if (hiddenRef.current === !visible) return;
    hiddenRef.current = !visible;
    Animated.timing(headerProgress, {
      toValue: visible ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    if (dy > 6 && y > 24) setHeaderVisible(false);
    else if (dy < -6 || y <= 8) setHeaderVisible(true);
    lastY.current = y;
  };

  const startNew = () => {
    setActiveId(undefined);
    setNewNonce((n) => n + 1);
    setHeaderVisible(true);
  };

  const pickHistory = (id: string) => {
    setActiveId(id);
    setHistoryOpen(false);
    setHeaderVisible(true);
  };

  const headerTranslate = headerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-HEADER_HEIGHT, 0],
  });

  return (
    <Screen padded={false}>
      <Animated.View
        style={{
          transform: [{ translateY: headerTranslate }],
          opacity: headerProgress,
        }}
        className="px-5 pt-4 pb-2"
      >
        <Header
          title={t('ai.coach.title', 'AI Coach')}
          right={
            <View className="flex-row" style={{ gap: 8 }}>
              <IconButton
                icon="history"
                onPress={() => setHistoryOpen(true)}
                accessibilityLabel={t('ai.coach.history', 'Recent conversations')}
              />
              <IconButton
                icon="plus"
                variant="accent"
                onPress={startNew}
                accessibilityLabel={t('ai.coach.newChat', 'Start a new chat')}
              />
            </View>
          }
        />
      </Animated.View>
      <View className="flex-1">
        <Conversation
          key={activeId ?? `new-${newNonce}`}
          conversationId={activeId}
          onScroll={onScroll}
        />
      </View>
      <HistoryModal
        visible={historyOpen}
        activeId={activeId}
        onClose={() => setHistoryOpen(false)}
        onPick={pickHistory}
        onNew={() => {
          setHistoryOpen(false);
          startNew();
        }}
      />
    </Screen>
  );
}

function HistoryModal({
  visible,
  activeId,
  onClose,
  onPick,
  onNew,
}: {
  visible: boolean;
  activeId: string | undefined;
  onClose: () => void;
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const q = useConversations();
  const data = q.data ?? [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.close', 'Close')}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: insets.top + 40,
            backgroundColor: '#14141C',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderColor: '#21212B',
          }}
        >
          <View className="self-center w-10 h-1 rounded-full bg-border-strong mt-3 mb-3" />
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Text className="text-ink text-xl font-extrabold tracking-tight">
              {t('ai.coach.history', 'Recent conversations')}
            </Text>
            <Pressable
              onPress={onNew}
              className="flex-row items-center bg-accent rounded-full px-3 py-2 active:opacity-90"
            >
              <Icon name="plus" size={14} color="#FFFFFF" />
              <Text className="text-accent-contrast font-bold ml-1.5 text-sm">
                {t('ai.coach.newChat', 'Start a new chat')}
              </Text>
            </Pressable>
          </View>

          {q.isPending ? (
            <View className="pt-10">
              <Spinner />
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(c) => c.id}
              contentContainerClassName="px-5 pb-10"
              ItemSeparatorComponent={() => <View className="h-2.5" />}
              ListEmptyComponent={
                <View className="items-center mt-10">
                  <View className="w-16 h-16 rounded-2xl bg-bg-raised border border-border items-center justify-center mb-4">
                    <Icon name="message" size={26} color="#B4B4C2" />
                  </View>
                  <Text className="text-ink-subtle text-sm text-center px-6">
                    {t(
                      'ai.coach.empty',
                      'No conversations yet. Pick a quick start above or just ask anything.',
                    )}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isActive = item.id === activeId;
                return (
                  <Pressable
                    onPress={() => onPick(item.id)}
                    className={`rounded-2xl p-4 active:opacity-90 border ${
                      isActive ? 'bg-accent/10 border-accent/50' : 'bg-bg-raised border-border'
                    }`}
                  >
                    <View className="flex-row items-start">
                      <View className="w-10 h-10 rounded-xl bg-accent/15 items-center justify-center mr-3 mt-0.5">
                        <Icon name="message" size={18} color="#22D3EE" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-ink text-base font-semibold" numberOfLines={1}>
                          {item.title ?? t('ai.coach.untitled', 'Conversation')}
                        </Text>
                        {item.last_message_preview ? (
                          <Text className="text-ink-subtle text-sm mt-1" numberOfLines={2}>
                            {item.last_message_preview}
                          </Text>
                        ) : null}
                        <View className="flex-row items-center mt-2">
                          <Text className="text-ink-subtle text-xs">
                            {formatRelative(item.last_message_at)}
                          </Text>
                          {item.message_count > 0 ? (
                            <>
                              <Text className="text-ink-subtle text-xs mx-1.5">•</Text>
                              <Text className="text-ink-subtle text-xs">
                                {item.message_count}{' '}
                                {item.message_count === 1
                                  ? t('ai.coach.messageOne', 'message')
                                  : t('ai.coach.messageMany', 'messages')}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                      <Icon
                        name={isActive ? 'check' : 'chevron-right'}
                        size={18}
                        color={isActive ? '#22D3EE' : '#52525B'}
                      />
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
