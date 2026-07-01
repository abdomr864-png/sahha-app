import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';

interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  role: string | null;
  username: string | null;
  display_name: string | null;
  locale: string | null;
  is_public: boolean | null;
}

const PAGE = 50;

export default function Users() {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => setPage(0), [debounced]);

  const q = useQuery({
    queryKey: ['admin_users_view', debounced, page],
    queryFn: async () => {
      let req = supabase
        .from('admin_users_view')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);

      if (debounced) {
        const p = `%${debounced.replace(/[\\%_]/g, '\\$&')}%`;
        req = req.or(`email.ilike.${p},username.ilike.${p},display_name.ilike.${p}`);
      }
      const { data, count, error } = await req;
      if (error) throw error;
      return { rows: (data ?? []) as AdminUser[], count: count ?? 0 };
    },
  });

  const total = q.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  const start = total === 0 ? 0 : page * PAGE + 1;
  const end = Math.min((page + 1) * PAGE, total);

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="People"
        title="Users"
        description="Combined auth.users + profiles. Click a row to drill into all data for that user."
      />

      <div className="mb-3 flex items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
            size={14}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, username, display name"
            className="h-9 w-96 pl-8 text-xs"
          />
        </div>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {total.toLocaleString()} user{total === 1 ? '' : 's'}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40 shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-semibold">User</th>
              <th className="px-3 py-2.5 text-left font-semibold">Username</th>
              <th className="px-3 py-2.5 text-left font-semibold">Role</th>
              <th className="px-3 py-2.5 text-left font-semibold">Locale</th>
              <th className="px-3 py-2.5 text-left font-semibold">Created</th>
              <th className="px-3 py-2.5 text-left font-semibold">Last sign-in</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={8} className="p-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </td>
              </tr>
            )}
            {q.error && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-destructive">
                  {(q.error as Error).message}
                </td>
              </tr>
            )}
            {q.data?.rows.map((u) => {
              const initials = (u.display_name || u.username || u.email || '?')
                .slice(0, 2)
                .toUpperCase();
              return (
                <tr
                  key={u.id}
                  className="group border-b border-border/40 last:border-0 transition-colors hover:bg-accent/30"
                >
                  <td className="px-3 py-2.5">
                    <Link to={`/admin/users/${u.id}`} className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium group-hover:text-primary">
                          {u.email ?? <span className="text-muted-foreground">no-email</span>}
                        </div>
                        {u.display_name && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {u.display_name}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    {u.username ? (
                      <code className="font-mono text-xs text-muted-foreground">@{u.username}</code>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {u.role === 'admin' ? (
                      <Badge variant="success">admin</Badge>
                    ) : (
                      <Badge>user</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.locale ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatDate(u.last_sign_in_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    {u.banned_until && new Date(u.banned_until) > new Date() ? (
                      <Badge variant="destructive">banned</Badge>
                    ) : u.email_confirmed_at ? (
                      <Badge variant="success">verified</Badge>
                    ) : (
                      <Badge variant="warning">pending</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground/60 transition-colors group-hover:text-foreground">
                    ›
                  </td>
                </tr>
              );
            })}
            {!q.isLoading && q.data?.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox size={20} />
                    <span className="text-xs">No users match.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          {total === 0 ? (
            'No users'
          ) : (
            <>
              Showing{' '}
              <span className="font-medium text-foreground tabular-nums">
                {start.toLocaleString()}
              </span>
              –
              <span className="font-medium text-foreground tabular-nums">
                {end.toLocaleString()}
              </span>{' '}
              of{' '}
              <span className="font-medium text-foreground tabular-nums">
                {total.toLocaleString()}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <span className="px-2 tabular-nums text-muted-foreground">
            {page + 1} <span className="opacity-60">/ {totalPages}</span>
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
