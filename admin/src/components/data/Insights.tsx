import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown, Flame, Activity, Dumbbell, Bot, Apple, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { formatNumber, cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Small primitives used inside insight cards
// ─────────────────────────────────────────────────────────────────────────────
function Pane({
  title,
  icon: Icon,
  children,
  span = 1,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <Card className={span === 2 ? 'lg:col-span-2' : ''}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {Icon && <Icon size={12} />}
          {title}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Bar({ value, max, tone = 'primary' }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  const colors: Record<string, string> = {
    primary: 'bg-primary',
    blue: 'bg-blue-400',
    violet: 'bg-violet-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
    cyan: 'bg-cyan-400',
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div
        className={cn('h-full rounded-full', colors[tone] ?? colors.primary)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions — plan distribution + status breakdown
// ─────────────────────────────────────────────────────────────────────────────
function SubscriptionsInsights() {
  const q = useQuery({
    queryKey: ['insights-subscriptions'],
    queryFn: async () => {
      const counts = async (col: string, value: string) => {
        const { count } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq(col, value);
        return count ?? 0;
      };
      const [free, monthly, yearly, active, trialing, pastDue, canceled, expired] =
        await Promise.all([
          counts('plan', 'free'),
          counts('plan', 'premium_monthly'),
          counts('plan', 'premium_yearly'),
          counts('status', 'active'),
          counts('status', 'trialing'),
          counts('status', 'past_due'),
          counts('status', 'canceled'),
          counts('status', 'expired'),
        ]);
      return { free, monthly, yearly, active, trialing, pastDue, canceled, expired };
    },
  });

  if (q.isLoading) return null;
  const d = q.data!;
  const plans = [
    { label: 'Premium yearly', value: d.yearly, tone: 'primary' },
    { label: 'Premium monthly', value: d.monthly, tone: 'blue' },
    { label: 'Free', value: d.free, tone: 'amber' },
  ];
  const max = Math.max(...plans.map((p) => p.value), 1);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Pane title="Plan distribution" icon={Crown} span={2}>
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{p.label}</span>
                <span className="font-medium tabular-nums">{formatNumber(p.value)}</span>
              </div>
              <Bar value={p.value} max={max} tone={p.tone} />
            </div>
          ))}
        </div>
      </Pane>
      <Pane title="Status">
        <div className="space-y-1.5 text-xs">
          <StatusRow label="active" count={d.active} variant="success" />
          <StatusRow label="trialing" count={d.trialing} variant="info" />
          <StatusRow label="past_due" count={d.pastDue} variant="warning" />
          <StatusRow label="canceled" count={d.canceled} variant="default" />
          <StatusRow label="expired" count={d.expired} variant="destructive" />
        </div>
      </Pane>
    </div>
  );
}

function StatusRow({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: 'default' | 'success' | 'warning' | 'destructive' | 'info';
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-accent/30">
      <Badge variant={variant}>{label}</Badge>
      <span className="font-medium tabular-nums">{formatNumber(count)}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workouts — total volume + active users this week
// ─────────────────────────────────────────────────────────────────────────────
function WorkoutsInsights() {
  const q = useQuery({
    queryKey: ['insights-workouts'],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [recent, recentActive, totalVolume] = await Promise.all([
        supabase
          .from('workouts')
          .select('total_volume_kg,user_id,started_at')
          .gte('started_at', weekAgo)
          .order('started_at', { ascending: false })
          .limit(1000),
        supabase.from('workouts').select('user_id').gte('started_at', dayAgo),
        supabase.from('workouts').select('total_volume_kg').limit(10000),
      ]);

      const recentRows = (recent.data ?? []) as Array<{
        total_volume_kg: number | null;
        user_id: string;
      }>;
      const weekVolume = recentRows.reduce((acc, r) => acc + (Number(r.total_volume_kg) || 0), 0);
      const activeUsers7d = new Set(recentRows.map((r) => r.user_id)).size;
      const activeUsers24h = new Set(
        ((recentActive.data ?? []) as { user_id: string }[]).map((r) => r.user_id),
      ).size;
      const lifetimeVolume = (
        (totalVolume.data ?? []) as { total_volume_kg: number | null }[]
      ).reduce((a, r) => a + (Number(r.total_volume_kg) || 0), 0);

      return {
        weekVolume,
        activeUsers7d,
        activeUsers24h,
        lifetimeVolume,
        weekWorkouts: recentRows.length,
      };
    },
  });

  if (q.isLoading) return null;
  const d = q.data!;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Volume (7d)"
        value={`${formatNumber(Math.round(d.weekVolume))} kg`}
        icon={Dumbbell}
        tone="emerald"
      />
      <Stat
        label="Workouts (7d)"
        value={formatNumber(d.weekWorkouts)}
        icon={Activity}
        tone="blue"
      />
      <Stat
        label="Active (24h)"
        value={formatNumber(d.activeUsers24h)}
        icon={Activity}
        tone="emerald"
      />
      <Stat
        label="Lifetime volume"
        value={`${formatNumber(Math.round(d.lifetimeVolume))} kg`}
        icon={Dumbbell}
        tone="amber"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercises — top muscle groups + equipment
// ─────────────────────────────────────────────────────────────────────────────
function ExercisesInsights() {
  const q = useQuery({
    queryKey: ['insights-exercises'],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercises')
        .select('muscle_group,equipment,is_custom')
        .limit(5000);
      const rows = (data ?? []) as Array<{
        muscle_group: string;
        equipment: string;
        is_custom: boolean;
      }>;
      const tally = (key: 'muscle_group' | 'equipment') => {
        const map = new Map<string, number>();
        rows.forEach((r) => map.set(r[key], (map.get(r[key]) ?? 0) + 1));
        return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      };
      const customCount = rows.filter((r) => r.is_custom).length;
      return {
        muscles: tally('muscle_group'),
        equip: tally('equipment'),
        custom: customCount,
        total: rows.length,
      };
    },
  });

  if (q.isLoading) return null;
  const d = q.data!;
  const maxM = Math.max(...d.muscles.map(([, n]) => n), 1);
  const maxE = Math.max(...d.equip.map(([, n]) => n), 1);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Pane title="Top muscle groups" icon={Dumbbell}>
        <div className="space-y-2">
          {d.muscles.map(([name, n]) => (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="capitalize">{name}</span>
                <span className="font-medium tabular-nums">{n}</span>
              </div>
              <Bar value={n} max={maxM} tone="primary" />
            </div>
          ))}
        </div>
      </Pane>
      <Pane title="Top equipment" icon={Dumbbell}>
        <div className="space-y-2">
          {d.equip.map(([name, n]) => (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="capitalize">{name}</span>
                <span className="font-medium tabular-nums">{n}</span>
              </div>
              <Bar value={n} max={maxE} tone="cyan" />
            </div>
          ))}
        </div>
      </Pane>
      <Pane title="Custom vs library">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Library</span>
            <span className="font-medium tabular-nums">{formatNumber(d.total - d.custom)}</span>
          </div>
          <Bar value={d.total - d.custom} max={d.total || 1} tone="primary" />
          <div className="flex items-center justify-between pt-2">
            <span className="text-muted-foreground">User-created</span>
            <span className="font-medium tabular-nums">{formatNumber(d.custom)}</span>
          </div>
          <Bar value={d.custom} max={d.total || 1} tone="violet" />
        </div>
      </Pane>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Messages — role distribution + token spend
// ─────────────────────────────────────────────────────────────────────────────
function AiMessagesInsights() {
  const q = useQuery({
    queryKey: ['insights-ai-messages'],
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const role = async (r: string) => {
        const { count } = await supabase
          .from('ai_messages')
          .select('*', { count: 'exact', head: true })
          .eq('role', r);
        return count ?? 0;
      };
      const [user, assistant, system, tokens24h, tokens7d] = await Promise.all([
        role('user'),
        role('assistant'),
        role('system'),
        supabase.from('ai_messages').select('tokens_used').gte('created_at', dayAgo).limit(10000),
        supabase.from('ai_messages').select('tokens_used').gte('created_at', weekAgo).limit(10000),
      ]);
      const sumTokens = (rows: { tokens_used: number | null }[] | null) =>
        (rows ?? []).reduce((a, r) => a + (Number(r.tokens_used) || 0), 0);
      return {
        user,
        assistant,
        system,
        tokens24h: sumTokens(tokens24h.data),
        tokens7d: sumTokens(tokens7d.data),
      };
    },
  });

  if (q.isLoading) return null;
  const d = q.data!;
  const max = Math.max(d.user, d.assistant, d.system, 1);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Pane title="Message roles" icon={Bot} span={2}>
        <div className="space-y-3">
          {[
            { label: 'user', value: d.user, tone: 'blue' },
            { label: 'assistant', value: d.assistant, tone: 'violet' },
            { label: 'system', value: d.system, tone: 'amber' },
          ].map((p) => (
            <div key={p.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{p.label}</span>
                <span className="font-medium tabular-nums">{formatNumber(p.value)}</span>
              </div>
              <Bar value={p.value} max={max} tone={p.tone} />
            </div>
          ))}
        </div>
      </Pane>
      <Pane title="Tokens used" icon={Bot}>
        <div className="space-y-2 text-xs">
          <div className="flex items-end justify-between">
            <span className="text-muted-foreground">last 24h</span>
            <span className="text-xl font-semibold tabular-nums">{formatNumber(d.tokens24h)}</span>
          </div>
          <div className="flex items-end justify-between pt-2">
            <span className="text-muted-foreground">last 7d</span>
            <span className="text-xl font-semibold tabular-nums">{formatNumber(d.tokens7d)}</span>
          </div>
        </div>
      </Pane>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Streaks — top streaks leaderboard
// ─────────────────────────────────────────────────────────────────────────────
function UserStreaksInsights() {
  const q = useQuery({
    queryKey: ['insights-streaks'],
    queryFn: async () => {
      const [top, agg] = await Promise.all([
        supabase
          .from('user_streaks')
          .select('user_id,current_streak,longest_streak,total_workouts_logged')
          .order('current_streak', { ascending: false })
          .limit(8),
        supabase
          .from('user_streaks')
          .select('current_streak,longest_streak,is_recovery_week,freezes_available')
          .limit(5000),
      ]);
      const rows = (agg.data ?? []) as Array<{
        current_streak: number;
        longest_streak: number;
        is_recovery_week: boolean;
        freezes_available: number;
      }>;
      const active = rows.filter((r) => r.current_streak > 0).length;
      const recovery = rows.filter((r) => r.is_recovery_week).length;
      const recordLongest = rows.reduce((m, r) => Math.max(m, r.longest_streak), 0);
      const freezesAvail = rows.reduce((a, r) => a + r.freezes_available, 0);
      return { top: top.data ?? [], active, recovery, recordLongest, freezesAvail };
    },
  });

  if (q.isLoading) return null;
  const d = q.data!;
  const max = Math.max(...d.top.map((t: { current_streak: number }) => t.current_streak), 1);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Pane title="Top current streaks" icon={Flame} span={2}>
        <div className="space-y-2">
          {(
            d.top as Array<{ user_id: string; current_streak: number; longest_streak: number }>
          ).map((u, i) => (
            <div key={u.user_id} className="flex items-center gap-3">
              <div className="w-5 text-center text-[10px] font-medium text-muted-foreground tabular-nums">
                {i + 1}
              </div>
              <a
                href={`/users/${u.user_id}`}
                className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground hover:text-primary"
                title={u.user_id}
              >
                {u.user_id.slice(0, 14)}…
              </a>
              <div className="flex-1">
                <Bar value={u.current_streak} max={max} tone="amber" />
              </div>
              <div className="w-12 text-right text-xs font-medium tabular-nums">
                {u.current_streak}
                <span className="ml-1 text-[10px] text-muted-foreground">d</span>
              </div>
            </div>
          ))}
        </div>
      </Pane>
      <Pane title="Streak health" icon={Flame}>
        <div className="space-y-1.5 text-xs">
          <Row k="Active streaks" v={formatNumber(d.active)} />
          <Row k="In recovery week" v={formatNumber(d.recovery)} />
          <Row k="Record longest" v={`${formatNumber(d.recordLongest)} days`} />
          <Row k="Freezes available" v={formatNumber(d.freezesAvail)} />
        </div>
      </Pane>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Foods — count by source + barcode coverage
// ─────────────────────────────────────────────────────────────────────────────
function FoodsInsights() {
  const q = useQuery({
    queryKey: ['insights-foods'],
    queryFn: async () => {
      const { data, count } = await supabase
        .from('foods')
        .select('source,barcode', { count: 'exact' })
        .limit(10000);
      const rows = (data ?? []) as Array<{ source: string | null; barcode: string | null }>;
      const bySource = new Map<string, number>();
      rows.forEach((r) => {
        const s = r.source ?? 'unknown';
        bySource.set(s, (bySource.get(s) ?? 0) + 1);
      });
      const withBarcode = rows.filter((r) => r.barcode).length;
      return {
        total: count ?? rows.length,
        sources: [...bySource.entries()].sort((a, b) => b[1] - a[1]),
        withBarcode,
        barcodeRate: rows.length ? Math.round((withBarcode / rows.length) * 100) : 0,
      };
    },
  });

  if (q.isLoading) return null;
  const d = q.data!;
  const max = Math.max(...d.sources.map(([, n]) => n), 1);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Pane title="By source" icon={Apple} span={2}>
        <div className="space-y-2">
          {d.sources.map(([name, n]) => (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{name}</span>
                <span className="font-medium tabular-nums">{n}</span>
              </div>
              <Bar value={n} max={max} tone="amber" />
            </div>
          ))}
        </div>
      </Pane>
      <Pane title="Barcode coverage" icon={Apple}>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums">{d.barcodeRate}%</span>
          <span className="text-xs text-muted-foreground">of {formatNumber(d.total)}</span>
        </div>
        <div className="mt-2">
          <Bar value={d.withBarcode} max={d.total || 1} tone="primary" />
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {formatNumber(d.withBarcode)} have a barcode
        </div>
      </Pane>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers + registry
// ─────────────────────────────────────────────────────────────────────────────
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone: 'emerald' | 'blue' | 'amber' | 'violet';
}) {
  const toneCls: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    blue: 'bg-blue-500/15 text-blue-400',
    amber: 'bg-amber-500/15 text-amber-400',
    violet: 'bg-violet-500/15 text-violet-400',
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', toneCls[tone])}>
          <Icon size={16} />
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-xl font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const insights: Record<string, React.ComponentType> = {
  subscriptions: SubscriptionsInsights,
  workouts: WorkoutsInsights,
  exercises: ExercisesInsights,
  ai_messages: AiMessagesInsights,
  user_streaks: UserStreaksInsights,
  foods: FoodsInsights,
};

import AutoInsights, { deriveSpecsFromResource } from './AutoInsights';
import { getResource } from '@/config/resources';
import { getResourceVisual } from '@/config/resourceVisuals';
import { extraInsights } from '@/config/autoInsightsConfig';

export function Insights({ slug }: { slug: string }) {
  // Hand-crafted insights take precedence (workouts, subscriptions, etc).
  const Custom = insights[slug];
  if (Custom) return <Custom />;

  // Otherwise auto-derive from the resource's field config + extras.
  const resource = getResource(slug);
  if (!resource) return null;
  const visual = getResourceVisual(slug);
  const specs = deriveSpecsFromResource(resource, extraInsights[slug] ?? [], visual.accent);
  if (!specs.length) return null;

  const tableName = resource.table ?? resource.slug;
  return <AutoInsights table={tableName} specs={specs} />;
}
