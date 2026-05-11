import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Users,
  Activity,
  CreditCard,
  Flame,
  Bot,
  Newspaper,
  Video,
  Dumbbell,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { formatNumber } from '@/lib/utils';

interface Stats {
  users_total?: number;
  users_new_24h?: number;
  users_new_7d?: number;
  active_24h?: number;
  workouts_total?: number;
  workouts_7d?: number;
  sets_total?: number;
  subs_active?: number;
  subs_premium?: number;
  ai_messages_24h?: number;
  form_checks_7d?: number;
  posts_7d?: number;
  streaks_active?: number;
}

function useStats() {
  return useQuery({
    queryKey: ['admin_dashboard_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_dashboard_stats');
      if (error) throw error;
      return (data ?? {}) as Stats;
    },
  });
}

function useWorkoutsByDay() {
  return useQuery({
    queryKey: ['admin_workouts_by_day', 30],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_workouts_by_day', { p_days: 30 });
      if (error) throw error;
      return (data ?? []) as Array<{ day: string; count: number }>;
    },
  });
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  trend?: { value: number; label?: string };
  tone?: 'default' | 'primary' | 'blue' | 'amber';
}) {
  const toneRing: Record<string, string> = {
    default: 'bg-muted/60 text-muted-foreground',
    primary: 'bg-primary/15 text-primary',
    blue: 'bg-blue-500/15 text-blue-400',
    amber: 'bg-amber-500/15 text-amber-400',
  };
  return (
    <Card className="group relative overflow-hidden transition-all hover:border-border hover:shadow-soft">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneRing[tone]}`}>
            <Icon size={15} strokeWidth={2.2} />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                trend.value >= 0
                  ? 'bg-primary/15 text-primary'
                  : 'bg-destructive/15 text-destructive'
              }`}
            >
              <TrendingUp size={10} className={trend.value < 0 ? 'rotate-180' : ''} />
              {trend.value > 0 ? '+' : ''}
              {trend.value}
              {trend.label && <span className="ml-0.5 opacity-70">{trend.label}</span>}
            </span>
          )}
        </div>
        {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const stats = useStats();
  const series = useWorkoutsByDay();
  const s = stats.data ?? {};

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Overview
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live aggregates across every Sahha table. Refreshes on demand.
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Live
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Users}
          tone="primary"
          label="Users"
          value={formatNumber(s.users_total)}
          sub={`+${formatNumber(s.users_new_24h)} in 24h · +${formatNumber(s.users_new_7d)} this week`}
        />
        <Kpi
          icon={Activity}
          tone="blue"
          label="Active in 24h"
          value={formatNumber(s.active_24h)}
          sub="users who logged a workout"
        />
        <Kpi
          icon={Dumbbell}
          label="Workouts"
          value={formatNumber(s.workouts_total)}
          sub={`${formatNumber(s.workouts_7d)} last 7d · ${formatNumber(s.sets_total)} sets total`}
        />
        <Kpi
          icon={CreditCard}
          tone="primary"
          label="Subscriptions"
          value={formatNumber(s.subs_active)}
          sub={`${formatNumber(s.subs_premium)} premium`}
        />
        <Kpi
          icon={Flame}
          tone="amber"
          label="Active streaks"
          value={formatNumber(s.streaks_active)}
        />
        <Kpi
          icon={Bot}
          tone="blue"
          label="AI messages (24h)"
          value={formatNumber(s.ai_messages_24h)}
        />
        <Kpi icon={Video} label="Form checks (7d)" value={formatNumber(s.form_checks_7d)} />
        <Kpi icon={Newspaper} label="Posts (7d)" value={formatNumber(s.posts_7d)} />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Workouts logged</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <div className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            daily count
          </div>
        </CardHeader>
        <CardContent className="h-80 pl-1 pr-2">
          {series.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : series.error ? (
            <div className="text-sm text-destructive">{(series.error as Error).message}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={series.data ?? []}
                margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="workoutFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.2, strokeWidth: 2 }}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 8px 24px -12px rgba(0,0,0,0.4)',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#workoutFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
