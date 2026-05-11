import { useQuery } from '@tanstack/react-query';
import { Database, Clock, CalendarDays } from 'lucide-react';
import type { ResourceSpec } from '@/config/resources';
import { freshnessColumn } from '@/config/resources';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber, cn } from '@/lib/utils';

interface Props {
  resource: ResourceSpec;
}

export default function ResourceStats({ resource }: Props) {
  const tableName = resource.table ?? resource.slug;
  const freshness = freshnessColumn(resource);

  const stats = useQuery({
    queryKey: ['resource-stats', tableName, freshness],
    queryFn: async () => {
      const totalQ = supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (!freshness) {
        const { count } = await totalQ;
        return { total: count ?? 0, last24h: null, last7d: null };
      }
      const oneDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const sevenDay = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [total, last24h, last7d] = await Promise.all([
        totalQ,
        supabase.from(tableName).select('*', { count: 'exact', head: true }).gte(freshness, oneDay),
        supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .gte(freshness, sevenDay),
      ]);
      return {
        total: total.count ?? 0,
        last24h: last24h.count ?? 0,
        last7d: last7d.count ?? 0,
      };
    },
  });

  const noun = resource.noun ?? resource.title.toLowerCase();
  const cards: Array<{
    label: string;
    value: React.ReactNode;
    sub?: string;
    icon: typeof Database;
    tone: 'primary' | 'blue' | 'amber';
  }> = [
    {
      label: `Total ${noun}`,
      value: stats.isLoading ? '…' : formatNumber(stats.data?.total),
      icon: Database,
      tone: 'primary',
    },
  ];
  if (freshness) {
    cards.push(
      {
        label: 'Last 24 hours',
        value: stats.isLoading ? '…' : formatNumber(stats.data?.last24h),
        sub: `by ${freshness}`,
        icon: Clock,
        tone: 'blue',
      },
      {
        label: 'Last 7 days',
        value: stats.isLoading ? '…' : formatNumber(stats.data?.last7d),
        sub: `by ${freshness}`,
        icon: CalendarDays,
        tone: 'amber',
      },
    );
  }

  const tone: Record<string, string> = {
    primary: 'bg-primary/15 text-primary',
    blue: 'bg-blue-500/15 text-blue-400',
    amber: 'bg-amber-500/15 text-amber-400',
  };

  return (
    <div className={cn('grid gap-3', freshness ? 'sm:grid-cols-3' : 'sm:grid-cols-1')}>
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="overflow-hidden">
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  tone[c.tone],
                )}
              >
                <Icon size={16} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </div>
                <div className="text-2xl font-semibold tracking-tight tabular-nums">{c.value}</div>
                {c.sub && <div className="text-[10px] text-muted-foreground/80">{c.sub}</div>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
