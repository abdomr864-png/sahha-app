import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Inbox,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  X as XIcon,
} from 'lucide-react';
import type { FieldSpec, ResourceSpec } from '@/config/resources';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { formatDate, truncate, cn } from '@/lib/utils';
import RecordEditor from './RecordEditor';

interface Props {
  resource: ResourceSpec;
  prefilter?: Record<string, string>;
  pageSize?: number;
}

interface SortState {
  column: string;
  desc: boolean;
}

function parseDefaultSort(order: string | undefined): SortState | null {
  if (!order) return null;
  return order.startsWith('-')
    ? { column: order.slice(1), desc: true }
    : { column: order, desc: false };
}

export default function DataTable({ resource, prefilter, pageSize = 50 }: Props) {
  const tableName = resource.table ?? resource.slug;
  const visible = resource.fields.filter((f) => !f.listHidden);
  const searchCols = resource.searchColumns ?? [];

  // Enum columns we'll surface as quick filter chips.
  const enumFields = React.useMemo(
    () => resource.fields.filter((f) => f.type === 'enum' && f.options && f.options.length <= 10),
    [resource.fields],
  );

  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [sort, setSort] = React.useState<SortState | null>(parseDefaultSort(resource.defaultOrder));
  const [enumFilters, setEnumFilters] = React.useState<Record<string, string>>({});
  const [editing, setEditing] = React.useState<Record<string, unknown> | null | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => setPage(0), [debounced, sort, enumFilters]);

  const queryKey = ['rows', tableName, prefilter, debounced, sort, enumFilters, page, pageSize];

  const buildBase = React.useCallback(() => {
    let q = supabase.from(tableName).select('*', { count: 'exact' });
    if (sort) q = q.order(sort.column, { ascending: !sort.desc, nullsFirst: false });
    if (prefilter) for (const [k, v] of Object.entries(prefilter)) q = q.eq(k, v);
    for (const [k, v] of Object.entries(enumFilters)) if (v) q = q.eq(k, v);
    if (debounced && searchCols.length) {
      const pattern = `%${debounced.replace(/[\\%_]/g, '\\$&')}%`;
      q = q.or(searchCols.map((c) => `${c}.ilike.${pattern}`).join(','));
    }
    return q;
  }, [tableName, sort, prefilter, enumFilters, debounced, searchCols]);

  const rows = useQuery({
    queryKey,
    queryFn: async () => {
      const q = buildBase().range(page * pageSize, page * pageSize + pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
    },
  });

  const total = rows.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, total);

  function toggleSort(col: string) {
    setSort((current) => {
      if (!current || current.column !== col) return { column: col, desc: false };
      if (!current.desc) return { column: col, desc: true };
      return null; // 3rd click → clear sort
    });
  }

  async function exportCsv() {
    const t = toast.loading('Preparing CSV…');
    try {
      // Pull up to 10k rows respecting current filters/sort but ignoring pagination.
      const q = buildBase().range(0, 9999);
      const { data, error } = await q;
      if (error) throw error;
      const cols = visible.map((f) => f.name);
      const csvHead = cols.join(',');
      const csvBody = (data ?? [])
        .map((row) =>
          cols
            .map((c) => {
              const v = row[c];
              if (v == null) return '';
              const str = typeof v === 'string' ? v : JSON.stringify(v);
              return `"${str.replace(/"/g, '""')}"`;
            })
            .join(','),
        )
        .join('\n');
      const csv = csvHead + '\n' + csvBody;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${(data ?? []).length} rows`, { id: t });
    } catch (e) {
      toast.error((e as Error).message, { id: t });
    }
  }

  const activeFilters =
    Object.entries(enumFilters).filter(([, v]) => v).length + (debounced ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {searchCols.length > 0 && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
              size={14}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${searchCols.join(', ')}`}
              className="h-9 w-80 pl-8 text-xs"
            />
          </div>
        )}
        {activeFilters > 0 && (
          <button
            onClick={() => {
              setSearch('');
              setEnumFilters({});
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon size={11} /> Clear {activeFilters} {activeFilters === 1 ? 'filter' : 'filters'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            title="Export visible rows as CSV"
          >
            <Download size={14} /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => rows.refetch()}
            disabled={rows.isFetching}
          >
            <RefreshCw size={14} className={rows.isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {!resource.readOnly && (
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus size={14} /> New record
            </Button>
          )}
        </div>
      </div>

      {/* Enum filter chips */}
      {enumFields.length > 0 && (
        <div className="space-y-1.5">
          {enumFields.map((f) => (
            <div key={f.name} className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {f.label ?? f.name}
              </span>
              <FilterChip
                active={!enumFilters[f.name]}
                onClick={() => setEnumFilters((p) => ({ ...p, [f.name]: '' }))}
              >
                all
              </FilterChip>
              {f.options?.map((o) => (
                <FilterChip
                  key={o}
                  active={enumFilters[f.name] === o}
                  onClick={() => setEnumFilters((p) => ({ ...p, [f.name]: o }))}
                >
                  {o}
                </FilterChip>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40 shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              {visible.map((f) => (
                <th key={f.name} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold">
                  <button
                    onClick={() => toggleSort(f.name)}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    {f.label ?? f.name}
                    {sort?.column === f.name ? (
                      sort.desc ? (
                        <ArrowDown size={11} className="text-primary" />
                      ) : (
                        <ArrowUp size={11} className="text-primary" />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="opacity-30" />
                    )}
                  </button>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.isLoading && (
              <tr>
                <td colSpan={visible.length + 1} className="p-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {rows.error && (
              <tr>
                <td colSpan={visible.length + 1} className="p-10 text-center text-destructive">
                  {(rows.error as Error).message}
                </td>
              </tr>
            )}
            {!rows.isLoading && rows.data && rows.data.data.length === 0 && (
              <tr>
                <td colSpan={visible.length + 1} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox size={20} />
                    <span className="text-xs">
                      {activeFilters > 0 ? 'No rows match these filters.' : 'No rows yet.'}
                    </span>
                  </div>
                </td>
              </tr>
            )}
            {rows.data?.data.map((row, i) => (
              <tr
                key={i}
                onClick={() => setEditing(row)}
                className="group cursor-pointer border-b border-border/40 last:border-0 transition-colors hover:bg-accent/30"
              >
                {visible.map((f) => (
                  <td key={f.name} className="whitespace-nowrap px-3 py-2.5 align-top">
                    <Cell field={f} value={row[f.name]} />
                  </td>
                ))}
                <td className="px-3 py-2.5 text-muted-foreground/60 transition-colors group-hover:text-foreground">
                  ›
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="text-muted-foreground">
          {total === 0 ? (
            'No rows'
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

      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && setEditing(undefined)}
        title={editing === null ? `New ${resource.title}` : `Edit ${resource.title}`}
        description={resource.table ?? resource.slug}
      >
        {editing !== undefined && (
          <RecordEditor
            resource={resource}
            record={editing}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Dialog>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
        active
          ? 'border-primary/30 bg-primary/15 text-primary'
          : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// Status-coded enum values get specific colors instead of plain outline.
const enumTone: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'default'> = {
  // subscriptions.status
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  canceled: 'default',
  expired: 'destructive',
  // subscriptions.plan
  free: 'default',
  premium_monthly: 'info',
  premium_yearly: 'success',
  // ai role
  user: 'info',
  assistant: 'success',
  system: 'warning',
  // streak event_type
  completed: 'success',
  bonus_completed: 'info',
  freeze_used: 'info',
  missed: 'destructive',
  rest_day: 'default',
  recovery_week: 'warning',
  week_completed: 'success',
  reset: 'destructive',
  milestone: 'warning',
  // progression log event_type
  reps_increased: 'success',
  sets_increased: 'success',
  weight_suggested: 'info',
  weight_accepted: 'success',
  weight_declined: 'warning',
  deload_suggested: 'warning',
  pr_prompt: 'warning',
  held: 'default',
  // suggestion consumed_decision
  accepted: 'success',
  declined: 'warning',
  // post type
  workout: 'success',
  pr: 'warning',
  photo: 'info',
  text: 'default',
};

function isImageUrl(s: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(s);
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function Cell({ field, value }: { field: FieldSpec; value: unknown }) {
  if (value == null || value === '') return <span className="text-muted-foreground/50">—</span>;
  switch (field.type) {
    case 'boolean':
      return <Badge variant={value ? 'success' : 'default'}>{value ? 'true' : 'false'}</Badge>;
    case 'enum': {
      const variant = enumTone[String(value)] ?? 'outline';
      return <Badge variant={variant}>{String(value)}</Badge>;
    }
    case 'datetime':
      return (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatDate(value as string, { time: true })}
        </span>
      );
    case 'date':
      return (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatDate(value as string)}
        </span>
      );
    case 'uuid': {
      const str = String(value);
      const isUserCol = field.name === 'user_id';
      const body = (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]',
            isUserCol ? 'text-primary hover:bg-primary/15' : 'text-muted-foreground',
          )}
          title={str}
        >
          {str.slice(0, field.truncate ?? 8)}…
        </span>
      );
      if (isUserCol) {
        return (
          <Link to={`/admin/users/${str}`} onClick={(e) => e.stopPropagation()}>
            {body}
          </Link>
        );
      }
      return body;
    }
    case 'number': {
      const n = Number(value);
      const name = field.name;
      // Smart unit suffixes based on column name
      let suffix = '';
      if (name.endsWith('_kg')) suffix = ' kg';
      else if (name.endsWith('_cm')) suffix = ' cm';
      else if (name.endsWith('_g') && !name.endsWith('_avg')) suffix = ' g';
      else if (name === 'amount_ml') suffix = ' ml';
      else if (name === 'rest_seconds') suffix = ' s';
      else if (name === 'tokens_used') suffix = ' tok';
      else if (name === 'calories') suffix = ' kcal';
      else if (name === 'body_fat_pct') suffix = '%';
      const display = Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
      return (
        <span className="font-medium tabular-nums">
          {display}
          {suffix && (
            <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{suffix}</span>
          )}
        </span>
      );
    }
    case 'json':
    case 'array':
      return (
        <span className="font-mono text-[11px] text-muted-foreground">{truncate(value, 60)}</span>
      );
    case 'longtext':
      return <span className="text-muted-foreground">{truncate(value, field.truncate ?? 60)}</span>;
    default: {
      const str = String(value);
      // URL columns → thumbnail or link icon
      if (
        (field.name === 'avatar_url' ||
          field.name === 'photo_url' ||
          field.name === 'video_url' ||
          field.name === 'photo_url') &&
        isUrl(str)
      ) {
        if (isImageUrl(str)) {
          return (
            <a
              href={str}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-block"
            >
              <img
                src={str}
                alt=""
                loading="lazy"
                className="h-9 w-9 rounded-md object-cover ring-1 ring-border/60"
              />
            </a>
          );
        }
        return (
          <a
            href={str}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/15"
          >
            link ↗
          </a>
        );
      }
      // Username column gets the @ treatment
      if (field.name === 'username') {
        return <code className="font-mono text-xs text-muted-foreground">@{str}</code>;
      }
      // Generic URL
      if (isUrl(str)) {
        return (
          <a
            href={str}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[11px] text-primary hover:underline"
          >
            {truncate(str, field.truncate ?? 40)} ↗
          </a>
        );
      }
      return <span>{truncate(str, field.truncate ?? 80)}</span>;
    }
  }
}
