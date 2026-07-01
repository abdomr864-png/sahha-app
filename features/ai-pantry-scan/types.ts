// Local UI model for an ingredient during the confirm step. Bridges the scan
// response, the manual-add path, and the persisted pantry row.
export interface PantryUIItem {
  // Stable local key for list rendering + edits (not the DB id).
  key: string;
  name: string;
  // Matched food-DB row; null means "couldn't match — search to add".
  foodDbId: string | null;
  quantity: number | null;
  unit: string | null;
  // Vision confidence 0..1; null for manual entries.
  confidence: number | null;
  source: 'scan' | 'manual';
}

export type Step = 'scan' | 'confirm' | 'suggest';
