import { supabase } from '@lib/supabase/client';
import type { FeedPost, PostComment, AuthorPreview } from './types';

const POST_PAGE_SIZE = 20;
const MEDIA_BUCKET = 'community-media';

interface RawPost {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  type: FeedPost['type'];
}

async function hydratePosts(rows: RawPost[], viewerId: string): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const [profilesRes, likesRes, commentsRes, myLikesRes, mySavesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_url')
      .in('user_id', userIds),
    supabase.from('post_likes').select('post_id').in('post_id', ids),
    supabase.from('post_comments').select('post_id').in('post_id', ids),
    supabase.from('post_likes').select('post_id').eq('user_id', viewerId).in('post_id', ids),
    supabase.from('post_saves').select('post_id').eq('user_id', viewerId).in('post_id', ids),
  ]);

  const profilesById = new Map<string, AuthorPreview>();
  (profilesRes.data ?? []).forEach((p) => profilesById.set(p.user_id, p as AuthorPreview));

  const likeCount = new Map<string, number>();
  (likesRes.data ?? []).forEach((row) => {
    likeCount.set(row.post_id, (likeCount.get(row.post_id) ?? 0) + 1);
  });
  const commentCount = new Map<string, number>();
  (commentsRes.data ?? []).forEach((row) => {
    commentCount.set(row.post_id, (commentCount.get(row.post_id) ?? 0) + 1);
  });
  const myLiked = new Set<string>((myLikesRes.data ?? []).map((r) => r.post_id));
  const mySaved = new Set<string>((mySavesRes.data ?? []).map((r) => r.post_id));

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    content: r.content,
    image_url: r.image_url,
    created_at: r.created_at,
    type: r.type,
    author: profilesById.get(r.user_id) ?? null,
    like_count: likeCount.get(r.id) ?? 0,
    comment_count: commentCount.get(r.id) ?? 0,
    liked_by_me: myLiked.has(r.id),
    saved_by_me: mySaved.has(r.id),
  }));
}

export async function fetchFeed(viewerId: string, before?: string): Promise<FeedPost[]> {
  let query = supabase
    .from('posts')
    .select('id, user_id, content, image_url, created_at, type')
    .order('created_at', { ascending: false })
    .limit(POST_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return hydratePosts((data ?? []) as RawPost[], viewerId);
}

export async function fetchPostById(viewerId: string, postId: string): Promise<FeedPost | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, content, image_url, created_at, type')
    .eq('id', postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await hydratePosts([data as RawPost], viewerId);
  return post ?? null;
}

export async function fetchSavedPosts(viewerId: string): Promise<FeedPost[]> {
  const { data: saves, error: savesErr } = await supabase
    .from('post_saves')
    .select('post_id, created_at')
    .eq('user_id', viewerId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (savesErr) throw savesErr;
  const ids = (saves ?? []).map((s) => s.post_id);
  if (ids.length === 0) return [];
  const { data: rows, error } = await supabase
    .from('posts')
    .select('id, user_id, content, image_url, created_at, type')
    .in('id', ids);
  if (error) throw error;
  const ordered = ids
    .map((id) => (rows ?? []).find((r) => r.id === id))
    .filter(Boolean) as RawPost[];
  return hydratePosts(ordered, viewerId);
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id, post_id, user_id, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', userIds);
  const byId = new Map<string, AuthorPreview>();
  (profiles ?? []).forEach((p) => byId.set(p.user_id, p as AuthorPreview));
  return rows.map((r) => ({ ...r, author: byId.get(r.user_id) ?? null }));
}

export async function addComment(userId: string, postId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, user_id: userId, content });
  if (error) throw error;
}

export async function likePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}

export async function unlikePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function savePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase.from('post_saves').insert({ post_id: postId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}

export async function unsavePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase
    .from('post_saves')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deletePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId);
  if (error) throw error;
}

async function uploadImage(userId: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const safeExt = /^[a-z0-9]{1,6}$/.test(ext) ? ext : 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const res = await fetch(localUri);
  const arrayBuffer = await res.arrayBuffer();
  const contentType =
    safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createPost(input: {
  userId: string;
  content: string;
  imageUri?: string | null;
}): Promise<string> {
  const trimmed = input.content.trim();
  let imageUrl: string | null = null;
  if (input.imageUri) {
    imageUrl = await uploadImage(input.userId, input.imageUri);
  }
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: input.userId,
      content: trimmed.length === 0 ? null : trimmed,
      image_url: imageUrl,
      type: imageUrl ? 'photo' : 'text',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}
