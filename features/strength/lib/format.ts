export type WeightUnit = 'kg' | 'lb';

const LB_PER_KG = 2.20462;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

/**
 * Round a kilogram value for display in the user's unit: whole numbers at/above
 * 100, one decimal below. Matches the rounding used on the Progress tab.
 */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const v = kgToUnit(kg, unit);
  return v >= 100 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString();
}

/** Round a kilogram delta (e.g. "12.5 more") in the user's unit. */
export function formatWeightDelta(kg: number, unit: WeightUnit): string {
  const v = kgToUnit(Math.max(0, kg), unit);
  return v >= 100 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString();
}
