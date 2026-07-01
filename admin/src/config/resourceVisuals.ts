// Per-resource visual identity — icon, accent color, and one-line subtitle.
// Kept in its own module so resources.ts doesn't have to import lucide-react.

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Apple,
  Bot,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Droplets,
  Dumbbell,
  Flame,
  Gauge,
  Heart,
  History,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  MessagesSquare,
  Moon,
  Newspaper,
  Pill,
  Settings,
  Smile,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Video,
  Wand2,
  Watch,
} from 'lucide-react';

export type Accent = 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'cyan' | 'pink' | 'indigo';

export interface ResourceVisual {
  icon: LucideIcon;
  accent: Accent;
  /** Subtitle shown under the title in the hero. */
  blurb: string;
}

export const accentClasses: Record<
  Accent,
  { bg: string; text: string; ring: string; glow: string; gradient: string }
> = {
  // Sahha flame accent (#FF4D2E) — the app's primary brand color.
  emerald: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    ring: 'ring-orange-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(255,77,46,0.55)]',
    gradient: 'from-orange-500/20 via-orange-500/5 to-transparent',
  },
  blue: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    ring: 'ring-blue-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(59,130,246,0.5)]',
    gradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
  },
  violet: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-400',
    ring: 'ring-violet-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(139,92,246,0.5)]',
    gradient: 'from-violet-500/20 via-violet-500/5 to-transparent',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    ring: 'ring-amber-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(245,158,11,0.5)]',
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    ring: 'ring-rose-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)]',
    gradient: 'from-rose-500/20 via-rose-500/5 to-transparent',
  },
  cyan: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(6,182,212,0.5)]',
    gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
  },
  pink: {
    bg: 'bg-pink-500/15',
    text: 'text-pink-400',
    ring: 'ring-pink-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(236,72,153,0.5)]',
    gradient: 'from-pink-500/20 via-pink-500/5 to-transparent',
  },
  indigo: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    ring: 'ring-indigo-500/30',
    glow: 'shadow-[0_0_24px_-6px_rgba(99,102,241,0.5)]',
    gradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
  },
};

const fallback: ResourceVisual = {
  icon: Layers,
  accent: 'emerald',
  blurb: 'Manage records',
};

export const resourceVisuals: Record<string, ResourceVisual> = {
  profiles: { icon: Users, accent: 'emerald', blurb: 'User profiles mirrored from auth.users' },
  exercises: {
    icon: Dumbbell,
    accent: 'emerald',
    blurb: 'Exercise library with multilingual names',
  },
  programs: {
    icon: ClipboardList,
    accent: 'blue',
    blurb: 'User-owned and AI-generated training programs',
  },
  program_days: { icon: Layers, accent: 'blue', blurb: 'Per-week, per-day program structure' },
  program_exercises: {
    icon: Layers,
    accent: 'blue',
    blurb: 'Exercises within a program day with progression model',
  },
  workouts: {
    icon: Activity,
    accent: 'emerald',
    blurb: 'Logged training sessions with total volume',
  },
  workout_exercises: {
    icon: Layers,
    accent: 'emerald',
    blurb: 'Exercises within a logged workout',
  },
  workout_sets: { icon: Layers, accent: 'emerald', blurb: 'Set-by-set log: reps, weight, RPE' },
  personal_records: {
    icon: TrendingUp,
    accent: 'amber',
    blurb: 'Detected PRs — max weight, est. 1RM, set volume',
  },
  body_measurements: {
    icon: TrendingUp,
    accent: 'cyan',
    blurb: 'Weight, body fat, circumference tracking',
  },
  progress_photos: { icon: ImageIcon, accent: 'pink', blurb: 'Private progress photos in storage' },
  foods: { icon: Apple, accent: 'amber', blurb: 'Food database with barcodes and macros' },
  meals: { icon: Apple, accent: 'amber', blurb: 'Logged meals per user' },
  meal_items: { icon: Apple, accent: 'amber', blurb: 'Individual food items within a meal' },
  water_log: { icon: Droplets, accent: 'cyan', blurb: 'Water intake events' },
  supplements: { icon: Pill, accent: 'violet', blurb: 'User supplement schedules' },
  supplement_logs: { icon: Pill, accent: 'violet', blurb: 'Supplement intake history' },
  mood_log: { icon: Smile, accent: 'rose', blurb: 'Mood, energy, stress self-reports' },
  sleep_log: { icon: Moon, accent: 'indigo', blurb: 'Sleep sessions with quality score' },
  wearable_metrics: {
    icon: Watch,
    accent: 'cyan',
    blurb: 'HealthKit / Google Fit / manual metrics',
  },
  follows: { icon: UserPlus, accent: 'blue', blurb: 'Social follow graph' },
  posts: { icon: Newspaper, accent: 'blue', blurb: 'Workout, PR, photo, and text posts' },
  post_likes: { icon: Heart, accent: 'rose', blurb: 'Likes on posts' },
  post_comments: { icon: MessageSquare, accent: 'blue', blurb: 'Comment threads' },
  leaderboards_weekly: { icon: Trophy, accent: 'amber', blurb: 'Weekly leaderboard snapshots' },
  ai_conversations: {
    icon: MessagesSquare,
    accent: 'violet',
    blurb: 'AI coach conversation threads',
  },
  ai_messages: {
    icon: Bot,
    accent: 'violet',
    blurb: 'Individual AI coach messages with token usage',
  },
  ai_form_checks: { icon: Video, accent: 'pink', blurb: 'Uploaded form-check videos (30-day TTL)' },
  ai_program_adjustments: { icon: Wand2, accent: 'violet', blurb: 'AI program tweak suggestions' },
  user_streaks: { icon: Flame, accent: 'amber', blurb: 'Per-user streak state and weekly target' },
  streak_events: { icon: CalendarCheck, accent: 'amber', blurb: 'Day-by-day streak audit log' },
  exercise_progression_log: {
    icon: History,
    accent: 'cyan',
    blurb: 'Decisions: weight/rep/set progression',
  },
  next_session_suggestions: {
    icon: Sparkles,
    accent: 'violet',
    blurb: 'Pending in-session progression suggestions',
  },
  subscriptions: {
    icon: CreditCard,
    accent: 'emerald',
    blurb: 'Plan + status + provider customer mapping',
  },
  usage_counters: { icon: Gauge, accent: 'blue', blurb: 'Per-feature usage counters' },
  entitlement_rules: {
    icon: Settings,
    accent: 'indigo',
    blurb: 'Remote config of free vs premium limits',
  },
  plans: {
    icon: CreditCard,
    accent: 'emerald',
    blurb: 'Pricing tiers, copy, and per-feature limits',
  },
};

export function getResourceVisual(slug: string): ResourceVisual {
  return resourceVisuals[slug] ?? fallback;
}
