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

const TYPE_LABEL: Record<FeedPost['type'], string | null> = {
  pr: 'PR',
  workout: 'Workout',
  photo: 'Photo',
  text: null,
};

export function PostCard({ post, onOpen, onLike, onSave, onComment }: Props) {
  const name = post.author?.display_name || post.author?.username || 'Unknown';
  const handle = post.author?.username ? `@${post.author.username}` : null;
  const time = relativeTime(post.created_at);
  const meta = handle ? `${handle} · ${time}` : time;
  const typeLabel = TYPE_LABEL[post.type];

  return (
    <View className="bg-bg-subtle border border-border rounded-3xl mb-3 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-3">
        <Avatar url={post.author?.avatar_url} name={name} size={42} />
        <View className="ml-3 flex-1">
          <Text className="text-ink font-bold text-[15px]" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-ink-muted text-xs mt-0.5" numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Pressable
          onPress={onOpen}
          hitSlop={8}
          accessibilityRole="button"
          className="w-9 h-9 rounded-full bg-bg-elevated border border-border items-center justify-center"
        >
          <Icon name="more" size={18} color="#B4B4C2" />
        </Pressable>
      </View>

      {/* Text */}
      {post.content ? (
        <Pressable onPress={onOpen} className="px-4 pb-3">
          <Text
            className="text-ink text-[15px]"
            style={{ lineHeight: 21 }}
            numberOfLines={post.image_url ? 4 : 10}
          >
            {post.content}
          </Text>
        </Pressable>
      ) : null}

      {/* Image */}
      {post.image_url ? (
        <Pressable onPress={onOpen} className="px-4 pb-3">
          <View
            className="rounded-2xl overflow-hidden border border-border bg-bg-elevated"
            style={{ aspectRatio: 16 / 11 }}
          >
            <Image
              source={{ uri: post.image_url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            {typeLabel ? (
              <View style={{ position: 'absolute', left: 12, bottom: 10 }}>
                <Text className="text-ink-subtle text-[11px] font-semibold">{typeLabel}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {/* Actions */}
      <View className="flex-row items-center px-4 pb-4 pt-1">
        <Pressable onPress={onLike} className="flex-row items-center mr-5 py-1">
          <Icon
            name="heart"
            size={20}
            color={post.liked_by_me ? '#FF4D6D' : '#74748A'}
            filled={post.liked_by_me}
          />
          <Text className="text-ink ml-1.5 text-[13px] font-semibold">{post.like_count}</Text>
        </Pressable>
        <Pressable onPress={onComment} className="flex-row items-center mr-5 py-1">
          <Icon name="message" size={20} color="#74748A" />
          <Text className="text-ink ml-1.5 text-[13px] font-semibold">{post.comment_count}</Text>
        </Pressable>
        <View className="flex-1" />
        <Pressable onPress={onSave} className="py-1">
          <Icon
            name="bookmark"
            size={20}
            color={post.saved_by_me ? '#FF7A1A' : '#74748A'}
            filled={post.saved_by_me}
          />
        </Pressable>
      </View>
    </View>
  );
}
