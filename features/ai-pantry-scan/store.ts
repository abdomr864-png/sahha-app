// Persist the last suggestions so the offline view can show "last suggestions"
// even when scanning is unavailable (offline guardrail). MMKV-backed via the
// shared offline storage.

import { storage } from '@lib/offline';
import type { MealSuggestionsResponse } from '@lib/llm';

const KEY = 'sahha.pantry.lastSuggestions.v1';

export function saveLastSuggestions(res: MealSuggestionsResponse): void {
  try {
    storage.setString(KEY, JSON.stringify(res));
  } catch {
    /* best-effort cache only */
  }
}

export function loadLastSuggestions(): MealSuggestionsResponse | null {
  try {
    const raw = storage.getString(KEY);
    return raw ? (JSON.parse(raw) as MealSuggestionsResponse) : null;
  } catch {
    return null;
  }
}
