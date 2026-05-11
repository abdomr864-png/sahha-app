import { Image, Pressable, Text, View } from 'react-native';
import { Icon } from '@features/shared';
import { Avatar } from './Avatar';
import type { FeedPost } from '../types';

interface Props {
  post: FeedPost;
  onOpen: () => void;
  onLike: () => void;
  onSave: () => void;
  onComment: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString();
}

export function PostCard({ post, onOpen, onLike, onSave, onComment }: Props) {
  const name = post.author?.display_name || post.author?.username || 'Unknown';

  return (
    <View className="bg-bg-raised border border-border rounded-3xl mb-4 overflow-hidden">
      <View className="flex-row items-center px-4 pt-4 pb-3">
        <Avatar url={post.author?.avatar_url} name={name} size={36} />
        <View className="ml-3 flex-1">
          <Text className="text-ink font-bold text-sm" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-ink-subtle text-xs">{relativeTime(post.created_at)}</Text>
        </View>
      </View>

      <Pressable onPress={onOpen}>
        {post.image_url ? (
          <Image
            source={{ uri: post.image_url }}
            className="w-full bg-bg-subtle"
            style={{ aspectRatio: 1 }}
            resizeMode="cover"
          />
        ) : null}
        {post.content ? (
          <View className="px-4 py-3">
            <Text className="text-ink text-[15px] leading-5" numberOfLines={post.image_url ? 3 : 8}>
              {post.content}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <View className="flex-row items-center px-4 pb-4 pt-2">
        <Pressable onPress={onLike} className="flex-row items-center mr-4 py-1">
          <Icon
            name="heart"
            size={22}
            color={post.liked_by_me ? '#FF4D2E' : '#F4F4F5'}
            filled={post.liked_by_me}
          />
          <Text className="text-ink ml-1.5 text-sm font-semibold">{post.like_count}</Text>
        </Pressable>
        <Pressable onPress={onComment} className="flex-row items-center mr-4 py-1">
          <Icon name="message" size={22} />
          <Text className="text-ink ml-1.5 text-sm font-semibold">{post.comment_count}</Text>
        </Pressable>
        <View className="flex-1" />
        <Pressable onPress={onSave} className="py-1">
          <Icon
            name="bookmark"
            size={22}
            color={post.saved_by_me ? '#FACC15' : '#F4F4F5'}
            filled={post.saved_by_me}
          />
        </Pressable>
      </View>
    </View>
  );
}
