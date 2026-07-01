import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Flame, Activity, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { formatDate, formatNumber } from '@/lib/utils';
import DataTable from '@/components/data/DataTable';
import { getResource, resources } from '@/config/resources';

const USER_SCOPED_SLUGS = [
  'workouts',
  'personal_records',
  'body_measurements',
  'progress_photos',
  'meals',
  'water_log',
  'supplements',
  'supplement_logs',
  'mood_log',
  'sleep_log',
  'wearable_metrics',
  'posts',
  'post_comments',
  'ai_conversations',
  'ai_form_checks',
  'ai_program_adjustments',
  'streak_events',
  'exercise_progression_log',
  'next_session_suggestions',
  'subscriptions',
  'usage_counters',
  'programs',
];

export default function UserDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = React.useState('workouts');

  const user = useQuery({
    queryKey: ['admin_user', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_users_view')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const counts = useQuery({
    queryKey: ['admin_user_counts', id],
    queryFn: async () => {
      const results = await Promise.all(
        USER_SCOPED_SLUGS.map(async (slug) => {
          const { count } = await supabase
            .from(slug)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', id);
          return [slug, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(results);
    },
  });

  const streak = useQuery({
    queryKey: ['admin_user_streak', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      return data;
    },
  });

  if (user.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!user.data) {
    return <div className="p-8 text-sm text-muted-foreground">User not found.</div>;
  }

  const u = user.data;
  const tabs = USER_SCOPED_SLUGS.map((slug) => getResource(slug)).filter(
    (r): r is NonNullable<ReturnType<typeof getResource>> => Boolean(r),
  );

  const active = getResource(activeTab) ?? tabs[0];
  const initials = (u.display_name || u.username || u.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 p-8">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={12} /> All users
      </Link>

      {/* Hero */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-xl font-semibold text-primary shadow-glow-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {u.display_name ?? u.username ?? u.email ?? id}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail size={12} /> {u.email ?? '—'}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <code className="font-mono text-[11px]">{u.id}</code>
            <span className="text-muted-foreground/40">·</span>
            {u.role === 'admin' ? <Badge variant="success">admin</Badge> : <Badge>user</Badge>}
            {u.banned_until && new Date(u.banned_until) > new Date() ? (
              <Badge variant="destructive">banned</Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Activity size={14} /> Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            <Row
              label="Username"
              value={u.username ? <code className="font-mono text-xs">@{u.username}</code> : '—'}
            />
            <Row label="Locale" value={u.locale ?? '—'} />
            <Row
              label="Public profile"
              value={u.is_public ? <Badge variant="success">yes</Badge> : <Badge>no</Badge>}
            />
            <Row
              label="Created"
              value={
                <span className="font-mono text-xs">
                  {formatDate(u.created_at, { time: true })}
                </span>
              }
            />
            <Row
              label="Last sign-in"
              value={
                <span className="font-mono text-xs">
                  {formatDate(u.last_sign_in_at, { time: true })}
                </span>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Flame size={14} /> Streak
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            {streak.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : streak.data ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">
                    {streak.data.current_streak}
                  </span>
                  <span className="text-xs text-muted-foreground">current streak</span>
                </div>
                <Row
                  label="Longest"
                  value={<span className="tabular-nums">{streak.data.longest_streak}</span>}
                />
                <Row
                  label="Total workouts"
                  value={<span className="tabular-nums">{streak.data.total_workouts_logged}</span>}
                />
                <Row
                  label="This week"
                  value={
                    <span className="tabular-nums">
                      {streak.data.current_week_completions} / {streak.data.current_week_target}
                    </span>
                  }
                />
                <Row label="Freezes" value={`${streak.data.freezes_available} available`} />
                <Row label="Timezone" value={streak.data.timezone ?? 'UTC'} />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No streak record yet.</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Top counts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {counts.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="space-y-1.5 text-xs">
                {counts.data &&
                  Object.entries(counts.data)
                    .filter(([, n]) => n > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([slug, n]) => (
                      <div
                        key={slug}
                        className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-accent/40"
                      >
                        <span className="font-mono text-muted-foreground">{slug}</span>
                        <span className="font-medium tabular-nums">{formatNumber(n)}</span>
                      </div>
                    ))}
                {counts.data && Object.values(counts.data).every((n) => n === 0) && (
                  <span className="text-muted-foreground">No activity yet.</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="space-y-3">
        <div className="-mx-1 flex flex-wrap gap-1 border-b border-border/60 pb-2">
          {tabs.map((r) => {
            const isActive = activeTab === r.slug;
            const count = counts.data?.[r.slug] ?? 0;
            return (
              <button
                key={r.slug}
                onClick={() => setActiveTab(r.slug)}
                className={
                  'group inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ' +
                  (isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground')
                }
              >
                {r.title}
                {count > 0 && (
                  <span
                    className={
                      'inline-flex items-center rounded-full px-1.5 py-0 text-[10px] tabular-nums ' +
                      (isActive ? 'bg-primary/20' : 'bg-muted-foreground/15')
                    }
                  >
                    {formatNumber(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {active && (
          // key on slug so switching tabs remounts the table and resets its
          // sort/filter state — otherwise a previous tab's sort column gets
          // re-applied to the new table and throws "column … does not exist".
          <DataTable
            key={active.slug}
            resource={active}
            prefilter={{ user_id: id }}
            pageSize={25}
          />
        )}
      </div>

      <div className="text-[11px] text-muted-foreground">
        Tables without a <code className="font-mono">user_id</code> column (follows, leaderboards)
        are managed from the sidebar. {resources.length} total tables wired.
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </div>
  );
}
