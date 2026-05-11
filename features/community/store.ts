import { create } from 'zustand';
import * as repo from './repository';
import type { FeedPost } from './types';

interface State {
  posts: FeedPost[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  load: (viewerId: string) => Promise<void>;
  refresh: (viewerId: string) => Promise<void>;
  toggleLike: (viewerId: string, postId: string) => Promise<void>;
  toggleSave: (viewerId: string, postId: string) => Promise<void>;
  applyDelete: (postId: string) => void;
  upsert: (post: FeedPost) => void;
}

function patch(posts: FeedPost[], id: string, p: Partial<FeedPost>): FeedPost[] {
  return posts.map((post) => (post.id === id ? { ...post, ...p } : post));
}

export const useCommunityStore = create<State>((set, get) => ({
  posts: [],
  loading: false,
  refreshing: false,
  error: null,
  load: async (viewerId) => {
    if (get().posts.length > 0) return;
    set({ loading: true, error: null });
    try {
      const posts = await repo.fetchFeed(viewerId);
      set({ posts, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },
  refresh: async (viewerId) => {
    set({ refreshing: true, error: null });
    try {
      const posts = await repo.fetchFeed(viewerId);
      set({ posts, refreshing: false });
    } catch (e) {
      set({ refreshing: false, error: (e as Error).message });
    }
  },
  toggleLike: async (viewerId, postId) => {
    const post = get().posts.find((p) => p.id === postId);
    if (!post) return;
    const nextLiked = !post.liked_by_me;
    set({
      posts: patch(get().posts, postId, {
        liked_by_me: nextLiked,
        like_count: post.like_count + (nextLiked ? 1 : -1),
      }),
    });
    try {
      if (nextLiked) await repo.likePost(viewerId, postId);
      else await repo.unlikePost(viewerId, postId);
    } catch (e) {
      // rollback
      set({
        posts: patch(get().posts, postId, {
          liked_by_me: !nextLiked,
          like_count: post.like_count,
        }),
        error: (e as Error).message,
      });
    }
  },
  toggleSave: async (viewerId, postId) => {
    const post = get().posts.find((p) => p.id === postId);
    if (!post) return;
    const nextSaved = !post.saved_by_me;
    set({ posts: patch(get().posts, postId, { saved_by_me: nextSaved }) });
    try {
      if (nextSaved) await repo.savePost(viewerId, postId);
      else await repo.unsavePost(viewerId, postId);
    } catch (e) {
      set({
        posts: patch(get().posts, postId, { saved_by_me: !nextSaved }),
        error: (e as Error).message,
      });
    }
  },
  applyDelete: (postId) => {
    set({ posts: get().posts.filter((p) => p.id !== postId) });
  },
  upsert: (post) => {
    const exists = get().posts.some((p) => p.id === post.id);
    set({
      posts: exists
        ? get().posts.map((p) => (p.id === post.id ? post : p))
        : [post, ...get().posts],
    });
  },
}));
