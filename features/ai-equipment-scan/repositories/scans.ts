// Upload + persist scan artifacts.
//
// Flow:
//   1. Compress + upload the captured photo to equipment-scans/{userId}/{id}.jpg
//   2. Create a short-lived signed URL so the edge function (and OpenAI's vision
//      fetch) can read it without the bucket being public.
//   3. After the scan, persist into user_saved_equipment when the user taps "save".

import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';
import { uuidV4 as uuid } from '@lib/ids';
import type { EquipmentScanResponse } from '@lib/llm';

const BUCKET = 'equipment-scans';
const SIGN_EXPIRY_SECONDS = 600;

export async function uploadScanImage(
  userId: string,
  uri: string,
): Promise<{ path: string; signedUrl: string }> {
  const id = uuid();
  const path = `${userId}/${id}.jpg`;
  // RN's fetch(uri).blob() returns a 0-byte body — use arrayBuffer() to read
  // the file contents (same pattern used by meal-parse / edit-profile uploads).
  const res = await fetch(uri);
  const arrayBuffer = await res.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGN_EXPIRY_SECONDS);
  if (sErr || !signed) throw sErr ?? new Error('sign_failed');
  return { path, signedUrl: signed.signedUrl };
}

export async function saveScanForUser(
  userId: string,
  result: EquipmentScanResponse,
  scannedImageUrl: string | null,
): Promise<void> {
  if (!result.equipment) return;
  await mapSb(
    supabase
      .from('user_saved_equipment')
      .insert({
        user_id: userId,
        equipment_name: result.equipment.name_en,
        equipment_data: result,
        scanned_image_url: scannedImageUrl,
      })
      .select('id')
      .single(),
  );
}

export interface SavedEquipmentRow {
  id: string;
  equipment_name: string;
  equipment_data: EquipmentScanResponse;
  scanned_image_url: string | null;
  saved_at: string;
}

export async function listSavedEquipment(userId: string): Promise<SavedEquipmentRow[]> {
  const rows = await mapSb(
    supabase
      .from('user_saved_equipment')
      .select('id, equipment_name, equipment_data, scanned_image_url, saved_at')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false }),
  );
  return rows as unknown as SavedEquipmentRow[];
}

export async function deleteSavedEquipment(id: string): Promise<void> {
  const { error } = await supabase.from('user_saved_equipment').delete().eq('id', id);
  if (error) throw error;
}
