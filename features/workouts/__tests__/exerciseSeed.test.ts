import * as fs from 'fs';
import * as path from 'path';

const SEED = path.resolve(__dirname, '../../../supabase/migrations/0012_seed_exercises.sql');

describe('exercise seed', () => {
  const sql = fs.readFileSync(SEED, 'utf8');
  const rowRegex = /^\s*\('([^']+)',\s*'((?:[^'\\]|\\.)+)',\s*'((?:[^'\\]|\\.)+)',\s*'(\w+)',/gm;
  const rows: { en: string; fr: string; ar: string; group: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(sql))) {
    rows.push({ en: m[1]!, fr: m[2]!, ar: m[3]!, group: m[4]! });
  }

  it('contains at least 50 rows', () => {
    expect(rows.length).toBeGreaterThanOrEqual(50);
  });

  it('all rows have all three locale names populated', () => {
    for (const r of rows) {
      expect(r.en.length).toBeGreaterThan(0);
      expect(r.fr.length).toBeGreaterThan(0);
      expect(r.ar.length).toBeGreaterThan(0);
    }
  });

  it('covers the major muscle groups', () => {
    const groups = new Set(rows.map((r) => r.group));
    for (const g of ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']) {
      expect(groups.has(g)).toBe(true);
    }
  });

  it('is re-runnable (uses on conflict do nothing)', () => {
    expect(sql).toMatch(/on conflict do nothing/i);
  });
});
