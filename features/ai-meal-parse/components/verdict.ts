import type { MealVerdict } from '../hooks/useMealHistory';

export interface VerdictStyle {
  bg: string;
  border: string;
  text: string;
  dot: string;
  emoji: string;
}

/** Shared verdict palette so the result, history strip, and detail screen match. */
export const VERDICT_STYLE: Record<MealVerdict, VerdictStyle> = {
  good: {
    bg: 'bg-emerald-900/30',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    dot: '#2EE6A6',
    emoji: '✓',
  },
  ok: {
    bg: 'bg-amber-900/30',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    dot: '#F5C451',
    emoji: '~',
  },
  bad: {
    bg: 'bg-rose-900/30',
    border: 'border-rose-500/40',
    text: 'text-rose-300',
    dot: '#FF4D6D',
    emoji: '!',
  },
};
