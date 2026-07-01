// Auto-generated insight panels for any resource.
// Composed of small reusable widgets that each fire their own queries.

import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatNumber, cn } from '@/lib/utils';
import { type Accent } from '@/config/resourceVisuals';

// ─────────────────────────────────────────────────────────────────────────────
// Spec types
// ─────────────────────────────────────────────────────────────────────────────
export type InsightSpec =
  | {
      kind: 'enum';
      column: string;
      label: string;
      options: readonly string[];
      tone?: Accent;
      span?: 1 | 2;
    }
  | {
      kind: 'split';
      column: string;
      label: string;
      trueLabel?: string;
      falseLabel?: string;
      tone?: Accent;
    }
  | {
      kind: 'avg';
      column: string;
      label: string;
      suffix?: string;
      tone?: Accent;
    }
  | {
      kind: 'topvals';
      column: string;
      label: string;
      tone?: Accent;
      limit?: number;
      span?: 1 | 2;
    }
  | {
      kind: 'topusers';
      label: string;
      column?: string; // defaults to 'user_id'
      tone?: Accent;
      limit?: number;
      span?: 1 | 2;
    };

const accentBar: Record<Accent, string> = {
  emerald: 'bg-orange-400',
  blue: 'bg-blue-400',
  violet: 'bg-violet-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  cyan: 'bg-cyan-400',
  pink: 'bg-pink-400',
  indigo: 'bg-indigo-400',
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────
function Pane({
  title,
  span = 1,
  children,
}: {
  title: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <Card className={span === 2 ? 'lg:col-span-2' : ''}>
      <CardContent className="p-5">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Bar({ value, max, tone }: { value: number; max: number; tone: Accent }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div className={cn('h-full rounded-full', accentBar[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PaneLoading() {
  return (
    <div className="flex h-20 items-center justify-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EnumPanel — N head:true counts, one per option
// ─────────────────────────────────────────────────────────────────────────────
function EnumPanel({
  table,
  spec,
}: {
  table: string;
  spec: Extract<InsightSpec, { kind: 'enum' }>;
}) {
  const q = useQuery({
    queryKey: ['auto-enum', table, spec.column, spec.options],
    queryFn: async () => {
      const counts = await Promise.all(
        spec.options.map(async (o) => {
          const { count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq(spec.column, o);
          return [o, count ?? 0] as const;
        }),
      );
      return counts;
    },
  });

  return (
    <Pane title={spec.label} span={spec.span}>
      {q.isLoading || !q.data ? (
        <PaneLoading />
      ) : (
        <div className="space-y-2.5">
          {(() => {
            const data = [...q.data].sort((a, b) => b[1] - a[1]);
            const max = Math.max(...data.map(([, n]) => n), 1);
            return data.map(([k, n]) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="capitalize">{k}</span>
                  <span className="font-medium tabular-nums">{formatNumber(n)}</span>
                </div>
                <Bar value={n} max={max} tone={spec.tone ?? 'emerald'} />
              </div>
            ));
          })()}
        </div>
      )}
    </Pane>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SplitPanel — true vs false count + ratio
// ─────────────────────────────────────────────────────────────────────────────
function SplitPanel({
  table,
  spec,
}: {
  table: string;
  spec: Extract<InsightSpec, { kind: 'split' }>;
}) {
  const q = useQuery({
    queryKey: ['auto-split', table, spec.column],
    queryFn: async () => {
      const [t, f] = await Promise.all([
        supabase.from(table).select('*', { count: 'exact', head: true }).eq(spec.column, true),
        supabase.from(table).select('*', { count: 'exact', head: true }).eq(spec.column, false),
      ]);
      return { t: t.count ?? 0, f: f.count ?? 0 };
    },
  });

  return (
    <Pane title={spec.label}>
      {q.isLoading || !q.data ? (
        <PaneLoading />
      ) : (
        (() => {
          const total = q.data.t + q.data.f;
          const pct = total ? Math.round((q.data.t / total) * 100) : 0;
          return (
            <div className="space-y-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums">{pct}%</span>
                <span className="text-xs text-muted-foreground">{spec.trueLabel ?? 'true'}</span>
              </div>
              <Bar value={q.data.t} max={total || 1} tone={spec.tone ?? 'emerald'} />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatNumber(q.data.t)}
                  </span>{' '}
                  {spec.trueLabel ?? 'true'}
                </span>
                <span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatNumber(q.data.f)}
                  </span>{' '}
                  {spec.falseLabel ?? 'false'}
                </span>
              </div>
            </div>
          );
        })()
      )}
    </Pane>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AvgPanel — mean / min / max / count for a numeric column
// ─────────────────────────────────────────────────────────────────────────────
function AvgPanel({ table, spec }: { table: string; spec: Extract<InsightSpec, { kind: 'avg' }> }) {
  const q = useQuery({
    queryKey: ['auto-avg', table, spec.column],
    queryFn: async () => {
      const { data } = await supabase.from(table).select(spec.column).limit(5000);
      const rows = (data ?? []) as unknown as Array<Record<string, number | null>>;
      const vals = rows.map((r) => Number(r[spec.column])).filter((n) => Number.isFinite(n));
      if (!vals.length) return { mean: 0, min: 0, max: 0, n: 0 };
      const sum = vals.reduce((a, b) => a + b, 0);
      return {
        mean: sum / vals.length,
        min: Math.min(...vals),
        max: Math.max(...vals),
        n: vals.length,
      };
    },
  });

  const suffix = spec.suffix ? ` ${spec.suffix}` : '';
  const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

  return (
    <Pane title={spec.label}>
      {q.isLoading || !q.data ? (
        <PaneLoading />
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums">{fmt(q.data.mean)}</span>
            <span className="text-xs text-muted-foreground">avg{suffix}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-md bg-muted/40 px-2 py-1.5">
              <div className="text-[9px] uppercase text-muted-foreground">min</div>
              <div className="font-medium tabular-nums">
                {fmt(q.data.min)}
                <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">
                  {suffix}
                </span>
              </div>
            </div>
            <div className="rounded-md bg-muted/40 px-2 py-1.5">
              <div className="text-[9px] uppercase text-muted-foreground">max</div>
              <div className="font-medium tabular-nums">
                {fmt(q.data.max)}
                <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">
                  {suffix}
                </span>
              </div>
            </div>
            <div className="rounded-md bg-muted/40 px-2 py-1.5">
              <div className="text-[9px] uppercase text-muted-foreground">samples</div>
              <div className="font-medium tabular-nums">{formatNumber(q.data.n)}</div>
            </div>
          </div>
        </div>
      )}
    </Pane>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TopValsPanel — group by free-text column, count, top N
// ─────────────────────────────────────────────────────────────────────────────
function TopValsPanel({
  table,
  spec,
}: {
  table: string;
  spec: Extract<InsightSpec, { kind: 'topvals' }>;
}) {
  const q = useQuery({
    queryKey: ['auto-topvals', table, spec.column, spec.limit],
    queryFn: async () => {
      const { data } = await supabase.from(table).select(spec.column).limit(10000);
      const rows = (data ?? []) as unknown as Array<Record<string, string | null>>;
      const tally = new Map<string, number>();
      rows.forEach((r) => {
        const v = r[spec.column];
        if (v == null || v === '') return;
        tally.set(String(v), (tally.get(String(v)) ?? 0) + 1);
      });
      return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, spec.limit ?? 6);
    },
  });

  return (
    <Pane title={spec.label} span={spec.span}>
      {q.isLoading || !q.data ? (
        <PaneLoading />
      ) : q.data.length === 0 ? (
        <div className="py-2 text-xs text-muted-foreground">No data.</div>
      ) : (
        <div className="space-y-2.5">
          {(() => {
            const max = Math.max(...q.data.map(([, n]) => n), 1);
            return q.data.map(([k, n]) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate">{k}</span>
                  <span className="ml-2 font-medium tabular-nums">{formatNumber(n)}</span>
                </div>
                <Bar value={n} max={max} tone={spec.tone ?? 'cyan'} />
              </div>
            ));
          })()}
        </div>
      )}
    </Pane>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TopUsersPanel — leaderboard of users by row count
// ─────────────────────────────────────────────────────────────────────────────
function TopUsersPanel({
  table,
  spec,
}: {
  table: string;
  spec: Extract<InsightSpec, { kind: 'topusers' }>;
}) {
  const col = spec.column ?? 'user_id';
  const q = useQuery({
    queryKey: ['auto-topusers', table, col, spec.limit],
    queryFn: async () => {
      const { data } = await supabase.from(table).select(col).limit(10000);
      const rows = (data ?? []) as unknown as Array<Record<string, string | null>>;
      const tally = new Map<string, number>();
      rows.forEach((r) => {
        const v = r[col];
        if (v) tally.set(String(v), (tally.get(String(v)) ?? 0) + 1);
      });
      return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, spec.limit ?? 8);
    },
  });

  return (
    <Pane title={spec.label} span={spec.span ?? 2}>
      {q.isLoading || !q.data ? (
        <PaneLoading />
      ) : q.data.length === 0 ? (
        <div className="py-2 text-xs text-muted-foreground">No data.</div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const max = Math.max(...q.data.map(([, n]) => n), 1);
            return q.data.map(([uid, n], i) => (
              <div key={uid} className="flex items-center gap-3">
                <div className="w-5 text-center text-[10px] font-medium text-muted-foreground tabular-nums">
                  {i + 1}
                </div>
                <Link
                  to={`/users/${uid}`}
                  className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground hover:text-primary"
                  title={uid}
                >
                  {uid.slice(0, 14)}…
                </Link>
                <div className="flex-1">
                  <Bar value={n} max={max} tone={spec.tone ?? 'blue'} />
                </div>
                <div className="w-12 text-right text-xs font-medium tabular-nums">
                  {formatNumber(n)}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </Pane>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite renderer
// ─────────────────────────────────────────────────────────────────────────────
export default function AutoInsights({ table, specs }: { table: string; specs: InsightSpec[] }) {
  if (!specs.length) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {specs.map((spec, i) => {
        const key = `${spec.kind}-${'column' in spec ? spec.column : 'topusers'}-${i}`;
        switch (spec.kind) {
          case 'enum':
            return <EnumPanel key={key} table={table} spec={spec} />;
          case 'split':
            return <SplitPanel key={key} table={table} spec={spec} />;
          case 'avg':
            return <AvgPanel key={key} table={table} spec={spec} />;
          case 'topvals':
            return <TopValsPanel key={key} table={table} spec={spec} />;
          case 'topusers':
            return <TopUsersPanel key={key} table={table} spec={spec} />;
        }
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-derive enum + boolean specs from a resource's field list, plus add
// the manually-authored specs from the config.
// ─────────────────────────────────────────────────────────────────────────────
import type { ResourceSpec } from '@/config/resources';

export function deriveSpecsFromResource(
  resource: ResourceSpec,
  extras: InsightSpec[] = [],
  accent: Accent = 'emerald',
): InsightSpec[] {
  const out: InsightSpec[] = [];
  const seen = new Set(extras.map((s) => `${s.kind}:${'column' in s ? s.column : ''}`));

  for (const f of resource.fields) {
    if (f.type === 'enum' && f.options && f.options.length >= 2 && f.options.length <= 8) {
      const key = `enum:${f.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: 'enum',
        column: f.name,
        options: f.options,
        label: `By ${(f.label ?? f.name).toLowerCase()}`,
        tone: accent,
      });
    } else if (f.type === 'boolean') {
      const key = `split:${f.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: 'split',
        column: f.name,
        label: (f.label ?? f.name).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
        tone: accent,
      });
    }
  }

  return [...extras, ...out];
}
