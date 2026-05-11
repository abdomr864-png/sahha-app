// Latest scan result, held client-side for the camera → results navigation.
// Not persisted: scan results are short-lived; saved equipment lives in the DB.

import { create } from 'zustand';
import type { EquipmentScanResponse } from '@lib/llm';

interface State {
  result: EquipmentScanResponse | null;
  scannedImageUrl: string | null;
  setResult(r: EquipmentScanResponse, imageUrl: string): void;
  clear(): void;
}

export const useScanResultStore = create<State>((set) => ({
  result: null,
  scannedImageUrl: null,
  setResult: (result, scannedImageUrl) => set({ result, scannedImageUrl }),
  clear: () => set({ result: null, scannedImageUrl: null }),
}));
