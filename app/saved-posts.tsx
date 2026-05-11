import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Header, Screen } from '@features/shared';
import { PostCard, communityRepo, useCommunityStore, type FeedPost } from '@features/community';
import { useSession } from '@features/auth';

export default function SavedPosts() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;
  const toggleLike = useCommunityStore((s) => s.toggleLike);
  const toggleSave = useCommunityStore((s) => s.toggleSave);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    setLoading(true);
    communityRepo
      .fetchSavedPosts(userId)
      .then((p) => {
        if (!cancelled) setPosts(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <Screen padded={false}>
      <View className="px-5 pt-4">
        <Header title={t('saved.title')} showBack />
      </View>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onOpen={() => router.push(`/post/${item.id}`)}
            onLike={() => userId && toggleLike(userId, item.id)}
            onSave={() => {
              if (!userId) return;
              toggleSave(userId, item.id);
              setPosts((prev) => prev.filter((p) => p.id !== item.id));
            }}
            onComment={() => router.push(`/post/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View className="items-center pt-16">
              <ActivityIndicator color="#FF4D2E" />
            </View>
          ) : (
            <Text className="text-ink-subtle text-center pt-16">{t('saved.empty')}</Text>
          )
        }
      />
    </Screen>
  );
}
