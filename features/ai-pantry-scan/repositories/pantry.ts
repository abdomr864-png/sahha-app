// Pantry persistence + image upload + "log this suggestion" write path.
//
// Image upload mirrors meal-parse / equipment-scan: RN's fetch().blob() returns
// a 0-byte body, so we read arrayBuffer() and upload that, then hand the vision
// step a short-lived signed URL (the bucket is private).

import { supabase } from '@lib/supabase/client';
import type { MealSuggestion } from '@lib/llm';
import type { PantryUIItem } from '../types';

const BUCKET = 'pantry-scans';
const SIGN_EXPIRY_SECONDS = 600;

/** Upload each captured photo and return a signed URL the edge function can read. */
export async function uploadPantryImages(userId: string, uris: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const uri of uris) {
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const res = await fetch(uri);
    const arrayBuffer = await res.arrayBuffer();
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_EXPIRY_SECONDS);
    if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error('sign_failed');
    urls.push(signed.data.signedUrl);
  }
  return urls;
}

export interface PantryRow {
  id: string;
  food_db_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  source: 'scan' | 'manual';
  confidence: number | null;
  added_at: string;
}

export async function listPantry(userId: string): Promise<PantryRow[]> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('id, food_db_id, name, quantity, unit, source, confidence, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PantryRow[];
}

/**
 * Replace the user's pantry with the confirmed set. The pantry is "last
 * confirmed" — re-scanning or editing overwrites it, which also gives the
 * offline view something stable to show.
 */
export async function savePantry(userId: string, items: PantryUIItem[]): Promise<void> {
  await supabase.from('pantry_items').delete().eq('user_id', userId);
  if (items.length === 0) return;
  const rows = items.map((it) => ({
    user_id: userId,
    food_db_id: it.foodDbId,
    name: it.name,
    quantity: it.quantity,
    unit: it.unit,
    source: it.source,
    confidence: it.confidence,
  }));
  const { error } = await supabase.from('pantry_items').insert(rows);
  if (error) throw error;
}

/**
 * Log a suggestion to the existing intake log (meals + meal_items), using the
 * CODE-COMPUTED macros only. Mirrors the meal-parse save path so the home
 * nutrition rings update through the same cache keys.
 */
export async function logSuggestionAsMeal(userId: string, s: MealSuggestion): Promise<void> {
  const { data: mealRow, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      name: s.title,
      meal_type: null,
      eaten_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !mealRow) throw error ?? new Error('meal_insert_failed');

  if (s.items.length > 0) {
    const { error: itemsErr } = await supabase.from('meal_items').insert(
      s.items.map((it) => ({
        meal_id: mealRow.id,
        food_id: it.food_db_id,
        custom_name: it.name,
        calories: it.macros.kcal,
        protein_g: it.macros.protein,
        carbs_g: it.macros.carbs,
        fat_g: it.macros.fat,
        quantity_g: it.quantity_g,
      })),
    );
    if (itemsErr) throw itemsErr;
  }
}
