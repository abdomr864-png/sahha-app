// Pure ingredient-name matcher. Server-side ONLY (imported by the pantry-scan
// edge function) — it maps a fuzzy vision detection to a row in the curated food
// DB. No deps. Uses Unicode-aware normalization (Deno/V8 supports \p{L}).
//
// The model NEVER decides the food_db_id — it only emits a human name; this code
// resolves the name to a DB row (or leaves it unmatched for the confirm UI).

export interface MatchableFood {
  id: string;
  slug?: string | null;
  name: string;
  name_fr?: string | null;
  name_ar?: string | null;
  aliases?: string[] | null;
}

/** Lowercase, strip Latin + Arabic diacritics and punctuation, collapse spaces. */
export function normalizeName(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Latin combining diacritics
    .replace(/[ً-ْـ]/g, '') // Arabic harakat + tatweel
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

function candidateStrings(f: MatchableFood): string[] {
  const raw = [f.name, f.name_fr, f.name_ar, ...(f.aliases ?? [])].filter((s): s is string => !!s);
  return Array.from(new Set(raw.map(normalizeName).filter(Boolean)));
}

function scorePair(detectedNorm: string, detectedTokens: Set<string>, cand: string): number {
  if (!cand) return 0;
  if (cand === detectedNorm) return 1;
  if (cand.includes(detectedNorm) || detectedNorm.includes(cand)) return 0.85;
  const candTokens = cand.split(' ');
  const intersection = candTokens.filter((t) => detectedTokens.has(t)).length;
  if (intersection === 0) return 0;
  const union = new Set([...detectedTokens, ...candTokens]).size;
  const jaccard = union ? intersection / union : 0;
  // A single shared significant token still counts toward a partial match.
  const tokenShare = intersection / Math.max(detectedTokens.size, candTokens.length);
  return Math.max(jaccard, tokenShare * 0.7);
}

/**
 * Best food-DB row for a detected ingredient name, or null when nothing clears
 * the confidence threshold (the caller surfaces it as "couldn't match").
 */
export function matchFood<T extends MatchableFood>(detected: string, foods: T[]): T | null {
  const q = normalizeName(detected);
  if (!q) return null;
  const qTokens = new Set(q.split(' '));
  let best: T | null = null;
  let bestScore = 0;
  for (const f of foods) {
    for (const cand of candidateStrings(f)) {
      const s = scorePair(q, qTokens, cand);
      if (s > bestScore) {
        bestScore = s;
        best = f;
      }
    }
  }
  return bestScore >= 0.5 ? best : null;
}
