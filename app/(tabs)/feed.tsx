import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, Screen } from '@features/shared';
import { PostCard, useCommunityStore } from '@features/community';
import { useRequireAuth, useSession } from '@features/auth';

export default function Feed() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;

  const posts = useCommunityStore((s) => s.posts);
  const loading = useCommunityStore((s) => s.loading);
  const refreshing = useCommunityStore((s) => s.refreshing);
  const error = useCommunityStore((s) => s.error);
  const load = useCommunityStore((s) => s.load);
  const refresh = useCommunityStore((s) => s.refresh);
  const toggleLike = useCommunityStore((s) => s.toggleLike);
  const toggleSave = useCommunityStore((s) => s.toggleSave);
  const requireAuth = useRequireAuth();

  // Visual filter tabs (Sahha design). Selection is cosmetic until the feed
  // backend supports server-side filtering.
  const [activeFilter, setActiveFilter] = useState(0);
  const filters = [
    t('feed.filterForYou', { defaultValue: 'For you' }),
    t('feed.filterFollowing', { defaultValue: 'Following' }),
    t('feed.filterPRs', { defaultValue: 'PRs' }),
    t('feed.filterNutrition', { defaultValue: 'Nutrition' }),
  ];

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  // Guests still see the public feed below; reads don't need a session.
  // Mutating actions (post/like/save/comment) flow through requireAuth.
  const onCreate = () =>
    void requireAuth(
      () => router.push('/create-post'),
      t('auth.gate.postPrompt', { defaultValue: 'Sign in to share your progress.' }),
    );
  const onLike = (postId: string) =>
    void requireAuth(
      () => {
        if (userId) toggleLike(userId, postId);
      },
      t('auth.gate.likePrompt', { defaultValue: 'Sign in to like posts.' }),
    );
  const onSave = (postId: string) =>
    void requireAuth(
      () => {
        if (userId) toggleSave(userId, postId);
      },
      t('auth.gate.savePrompt', { defaultValue: 'Sign in to save posts.' }),
    );
  const onComment = (postId: string) =>
    void requireAuth(
      () => router.push(`/post/${postId}`),
      t('auth.gate.commentPrompt', { defaultValue: 'Sign in to join the conversation.' }),
    );

  return (
    <Screen padded={false} glow>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <View>
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-1">
            {t('feed.kicker')}
          </Text>
          <Text className="text-ink text-3xl font-extrabold tracking-tight">{t('tabs.feed')}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/saved-posts')}
          hitSlop={10}
          className="w-11 h-11 rounded-full bg-bg-raised border border-border items-center justify-center"
        >
          <Icon name="bookmark" size={20} />
        </Pressable>
      </View>

      {/* Filter chips — Sahha design */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          gap: 8,
          paddingBottom: 14,
          alignItems: 'center',
        }}
      >
        {filters.map((label, i) => {
          const active = activeFilter === i;
          return (
            <Pressable
              key={label}
              onPress={() => setActiveFilter(i)}
              className={`px-4 py-2 rounded-full border ${
                active ? 'bg-ink border-ink' : 'bg-bg-elevated border-border'
              }`}
            >
              <Text className={`text-sm font-semibold ${active ? 'text-bg' : 'text-ink-subtle'}`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onOpen={() => router.push(`/post/${item.id}`)}
            onLike={() => onLike(item.id)}
            onSave={() => onSave(item.id)}
            onComment={() => onComment(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => userId && refresh(userId)}
            tintColor="#FF4D2E"
          />
        }
        ListEmptyComponent={
          loading ? (
            <View className="items-center pt-20">
              <ActivityIndicator color="#FF4D2E" />
            </View>
          ) : (
            <View className="items-center pt-16 px-6">
              <View className="w-16 h-16 rounded-3xl bg-accent/10 border border-accent/30 items-center justify-center mb-4">
                <Icon name="users" size={28} color="#FF4D2E" />
              </View>
              <Text className="text-ink text-lg font-extrabold tracking-tight">
                {error ? t('feed.errorTitle') : t('feed.emptyTitle')}
              </Text>
              <Text className="text-ink-subtle text-sm mt-2 text-center max-w-[260px]">
                {error ?? t('feed.emptyHint')}
              </Text>
              <Pressable onPress={onCreate} className="mt-5 px-5 py-3 rounded-2xl bg-accent">
                <Text className="text-white font-bold">{t('feed.createPost')}</Text>
              </Pressable>
            </View>
          )
        }
      />

      <Pressable
        onPress={onCreate}
        className="absolute bottom-28 right-5 w-14 h-14 rounded-full overflow-hidden items-center justify-center"
        style={{
          shadowColor: '#FF4D2E',
          shadowOpacity: 0.5,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <LinearGradient
          colors={
            ['#FF8A2B', '#FF4D2E', '#FF2D55'] as unknown as readonly [string, string, ...string[]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Icon name="plus" size={26} color="#FFFFFF" />
      </Pressable>
    </Screen>
  );
}
