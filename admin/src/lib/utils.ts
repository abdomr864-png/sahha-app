import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date | null | undefined, opts?: { time?: boolean }) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toISOString().slice(0, 10);
  if (!opts?.time) return date;
  return `${date} ${d.toISOString().slice(11, 16)} UTC`;
}

export function formatNumber(value: unknown) {
  if (value == null) return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString();
}

export function truncate(s: unknown, max = 80) {
  if (s == null) return '—';
  const str = typeof s === 'string' ? s : JSON.stringify(s);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}
