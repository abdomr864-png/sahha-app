/**
 * Local-timezone calendar-day key (YYYY-MM-DD). Readiness is a "daily" feature,
 * so every day boundary uses the user's local midnight — never UTC. Mirrors the
 * localDay helper in useRecovery so the two systems agree on "today".
 */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
