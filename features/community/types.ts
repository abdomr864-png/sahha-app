export interface AuthorPreview {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface FeedPost {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  type: 'workout' | 'pr' | 'photo' | 'text';
  author: AuthorPreview | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: AuthorPreview | null;
}
