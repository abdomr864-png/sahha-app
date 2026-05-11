import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Header, Icon, Screen } from '@features/shared';
import {
  Avatar,
  communityRepo,
  useCommunityStore,
  type FeedPost,
  type PostComment,
} from '@features/community';
import { useSession } from '@features/auth';

export default function PostDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;

  const cached = useCommunityStore((s) => s.posts.find((p) => p.id === id));
  const toggleLike = useCommunityStore((s) => s.toggleLike);
  const toggleSave = useCommunityStore((s) => s.toggleSave);
  const applyDelete = useCommunityStore((s) => s.applyDelete);

  const [post, setPost] = useState<FeedPost | null>(cached ?? null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(!cached);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !id) return;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          communityRepo.fetchPostById(userId, id),
          communityRepo.fetchComments(id),
        ]);
        if (cancelled) return;
        setPost(p);
        setComments(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, id]);

  const send = async () => {
    if (!userId || !id || text.trim().length === 0) return;
    setSending(true);
    try {
      await communityRepo.addComment(userId, id, text.trim());
      setText('');
      const c = await communityRepo.fetchComments(id);
      setComments(c);
      if (post) setPost({ ...post, comment_count: c.length });
    } finally {
      setSending(false);
    }
  };

  const removePost = async () => {
    if (!userId || !id) return;
    await communityRepo.deletePost(userId, id);
    applyDelete(id);
    router.back();
  };

  if (loading) {
    return (
      <Screen>
        <Header title={t('post.title')} showBack />
        <View className="items-center pt-10">
          <ActivityIndicator color="#FF4D2E" />
        </View>
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <Header title={t('post.title')} showBack />
        <Text className="text-ink-subtle">{t('post.notFound')}</Text>
      </Screen>
    );
  }

  const isOwner = post.user_id === userId;
  const name = post.author?.display_name || post.author?.username || 'Unknown';

  return (
    <Screen>
      <Header
        title={t('post.title')}
        showBack
        right={
          isOwner ? (
            <Pressable onPress={removePost} hitSlop={10}>
              <Icon name="trash" size={20} color="#F87171" />
            </Pressable>
          ) : null
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={
            <View className="mb-4">
              <View className="flex-row items-center mb-3">
                <Avatar url={post.author?.avatar_url} name={name} size={40} />
                <View className="ml-3">
                  <Text className="text-ink font-bold">{name}</Text>
                  <Text className="text-ink-subtle text-xs">
                    {new Date(post.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
              {post.image_url ? (
                <Image
                  source={{ uri: post.image_url }}
                  className="w-full rounded-2xl mb-3"
                  style={{ aspectRatio: 1 }}
                />
              ) : null}
              {post.content ? (
                <Text className="text-ink text-[15px] leading-5 mb-3">{post.content}</Text>
              ) : null}
              <View className="flex-row items-center pb-3 border-b border-border">
                <Pressable
                  onPress={() => userId && toggleLike(userId, post.id)}
                  className="flex-row items-center mr-5 py-1"
                >
                  <Icon
                    name="heart"
                    size={22}
                    color={post.liked_by_me ? '#FF4D2E' : '#F4F4F5'}
                    filled={post.liked_by_me}
                  />
                  <Text className="text-ink ml-1.5 font-semibold">{post.like_count}</Text>
                </Pressable>
                <View className="flex-row items-center mr-5 py-1">
                  <Icon name="message" size={22} />
                  <Text className="text-ink ml-1.5 font-semibold">{post.comment_count}</Text>
                </View>
                <View className="flex-1" />
                <Pressable onPress={() => userId && toggleSave(userId, post.id)} className="py-1">
                  <Icon
                    name="bookmark"
                    size={22}
                    color={post.saved_by_me ? '#FACC15' : '#F4F4F5'}
                    filled={post.saved_by_me}
                  />
                </Pressable>
              </View>
              <Text className="text-ink-muted text-[10px] font-bold tracking-widest mt-4">
                {t('post.comments').toUpperCase()}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const cName = item.author?.display_name || item.author?.username || 'Unknown';
            return (
              <View className="flex-row mb-4">
                <Avatar url={item.author?.avatar_url} name={cName} size={32} />
                <View className="ml-3 flex-1">
                  <Text className="text-ink font-bold text-sm">{cName}</Text>
                  <Text className="text-ink text-[14px] leading-5 mt-0.5">{item.content}</Text>
                  <Text className="text-ink-subtle text-xs mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text className="text-ink-subtle text-center py-6">{t('post.noComments')}</Text>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        />

        <View className="flex-row items-center pt-2 pb-2 border-t border-border">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('post.commentPlaceholder')}
            placeholderTextColor="#A1A1AA"
            className="flex-1 text-ink bg-bg-raised border border-border rounded-2xl px-4 py-3"
            maxLength={1000}
          />
          <Pressable
            onPress={send}
            disabled={sending || text.trim().length === 0}
            className={`ml-2 w-12 h-12 rounded-full items-center justify-center ${
              text.trim().length === 0 ? 'bg-bg-raised border border-border' : 'bg-accent'
            }`}
          >
            <Icon name="send" size={18} color={text.trim().length === 0 ? '#A1A1AA' : '#FFFFFF'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
