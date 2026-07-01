import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CreditCard,
  Gift,
  Loader2,
  Plus,
  Save,
  Search,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

const SUB_PLANS = ['free', 'premium_monthly', 'premium_yearly'] as const;
const SUB_STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'expired'] as const;
const INTERVALS = ['month', 'year', 'one_time'] as const;

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: string;
  sub_plan: string | null;
  features: string[] | null;
  feature_limits: Record<string, number | null> | null;
  badge: string | null;
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
}

interface RuleRow {
  feature: string;
  free_daily_limit: number | null;
  free_total_limit: number | null;
  premium_only: boolean;
  description: string | null;
}

export default function Subscriptions() {
  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-glow-primary">
          <CreditCard size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            Manage plans &amp; pricing, feature limits, and grant a plan to any user.
          </p>
        </div>
      </div>

      <GrantPlan />
      <PlansEditor />
      <FeatureLimits />
    </div>
  );
}

// ── Grant a plan to a user by email or name ────────────────────────────────
function GrantPlan() {
  const qc = useQueryClient();
  const [query, setQuery] = React.useState('');
  const [plan, setPlan] = React.useState<(typeof SUB_PLANS)[number]>('premium_yearly');
  const [status, setStatus] = React.useState<(typeof SUB_STATUSES)[number]>('active');
  const [expiresAt, setExpiresAt] = React.useState('');

  // Live user lookup as the admin types (email / username / display name).
  const search = useQuery({
    queryKey: ['admin_user_lookup', query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const q = query.trim();
      const { data, error } = await supabase
        .from('admin_users_view')
        .select('id,email,username,display_name')
        .or(`email.ilike.%${q}%,username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_grant_plan', {
        p_query: query.trim(),
        p_plan: plan,
        p_status: status,
        p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      if (error) throw error;
      return data as { ok: boolean; error?: string; email?: string; matches?: number };
    },
    onSuccess: (res) => {
      if (!res?.ok) {
        const msg =
          res?.error === 'not_found'
            ? 'No user matches that email or name.'
            : res?.error === 'ambiguous'
              ? `${res.matches} users match that name — use the exact email.`
              : res?.error === 'forbidden'
                ? 'You are not an admin.'
                : res?.error === 'empty_query'
                  ? 'Enter an email or name.'
                  : 'Could not grant the plan.';
        toast.error(msg);
        return;
      }
      toast.success(`Granted ${plan} (${status}) to ${res.email}.`);
      setQuery('');
      setExpiresAt('');
      qc.invalidateQueries({ queryKey: ['admin_user_lookup'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to grant plan.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift size={16} className="text-primary" /> Grant a plan
        </CardTitle>
        <CardDescription>
          Assign a subscription to a user by their email (Gmail) or name. This overwrites their
          current subscription row.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              User (email or name)
            </label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="name@gmail.com or display name"
                className="pl-8"
              />
            </div>
            {/* Lookup results */}
            {query.trim().length >= 2 && (
              <div className="rounded-md border border-border/60 bg-card/40 text-sm">
                {search.isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                  </div>
                ) : search.data && search.data.length > 0 ? (
                  search.data.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setQuery(u.email ?? u.username ?? '')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent/50"
                    >
                      <span className="truncate">
                        {u.display_name || u.username || '—'}
                        {u.username ? (
                          <span className="ml-1.5 text-muted-foreground">@{u.username}</span>
                        ) : null}
                      </span>
                      <span className="ml-3 shrink-0 font-mono text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-muted-foreground">No matches.</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan">
              <Select value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
                {SUB_PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {SUB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expires (optional)" className="col-span-2">
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => grant.mutate()} disabled={grant.isPending || !query.trim()}>
            {grant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift size={15} />}
            Grant plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Plans & pricing ─────────────────────────────────────────────────────────
function PlansEditor() {
  const qc = useQueryClient();
  const plans = useQuery({
    queryKey: ['admin_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });

  const addPlan = useMutation({
    mutationFn: async () => {
      const id = window.prompt('New plan slug (lowercase, e.g. "team"):')?.trim();
      if (!id) return null;
      const { error } = await supabase.from('plans').insert({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        price: 0,
        sort_order: (plans.data?.length ?? 0) + 1,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      if (id) {
        toast.success(`Created plan "${id}".`);
        qc.invalidateQueries({ queryKey: ['admin_plans'] });
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to create plan.'),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CreditCard size={16} className="text-primary" /> Plans &amp; pricing
          </CardTitle>
          <CardDescription>
            Edit the price, copy, and per-feature limits shown on the paywall.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => addPlan.mutate()}>
          <Plus size={14} /> Add plan
        </Button>
      </CardHeader>
      <CardContent>
        {plans.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : plans.data && plans.data.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.data.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No plans yet. Run migration <code>0034_plans_admin.sql</code>, then add one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan }: { plan: PlanRow }) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState(plan);
  const [features, setFeatures] = React.useState((plan.features ?? []).join('\n'));
  const [limits, setLimits] = React.useState(limitsToText(plan.feature_limits));

  React.useEffect(() => {
    setForm(plan);
    setFeatures((plan.features ?? []).join('\n'));
    setLimits(limitsToText(plan.feature_limits));
  }, [plan]);

  const set = <K extends keyof PlanRow>(k: K, v: PlanRow[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('plans')
        .update({
          name: form.name,
          description: form.description,
          price: Number(form.price),
          currency: form.currency,
          billing_interval: form.billing_interval,
          sub_plan: form.sub_plan,
          badge: form.badge || null,
          highlight: form.highlight,
          is_active: form.is_active,
          sort_order: Number(form.sort_order),
          features: features
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          feature_limits: textToLimits(limits),
        })
        .eq('id', plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Saved "${form.name}".`);
      qc.invalidateQueries({ queryKey: ['admin_plans'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to save plan.'),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('plans').delete().eq('id', plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Deleted "${plan.name}".`);
      qc.invalidateQueries({ queryKey: ['admin_plans'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to delete plan.'),
  });

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{plan.id}</code>
          {form.highlight && <Star size={13} className="fill-amber-400 text-amber-400" />}
          {!form.is_active && <Badge variant="destructive">inactive</Badge>}
        </div>
        <button
          onClick={() => {
            if (window.confirm(`Delete plan "${plan.name}"?`)) del.mutate();
          }}
          title="Delete plan"
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Badge">
          <Input
            value={form.badge ?? ''}
            onChange={(e) => set('badge', e.target.value)}
            placeholder="e.g. Most popular"
          />
        </Field>
        <Field label="Price">
          <Input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => set('price', e.target.value as unknown as number)}
          />
        </Field>
        <Field label="Currency">
          <Input value={form.currency} onChange={(e) => set('currency', e.target.value)} />
        </Field>
        <Field label="Billing">
          <Select
            value={form.billing_interval}
            onChange={(e) => set('billing_interval', e.target.value)}
          >
            {INTERVALS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Grants plan">
          <Select
            value={form.sub_plan ?? ''}
            onChange={(e) => set('sub_plan', e.target.value || null)}
          >
            <option value="">—</option>
            {SUB_PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Subtitle">
        <Input
          value={form.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder="e.g. or $11.99 / mo · 7-day trial"
        />
      </Field>

      <Field label="Feature bullets (one per line)">
        <Textarea
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          rows={4}
          className="font-sans"
        />
      </Field>

      <Field label="Feature use limits — one per line: feature = number (blank = unlimited)">
        <Textarea
          value={limits}
          onChange={(e) => setLimits(e.target.value)}
          rows={3}
          placeholder={'ai_messages = 50\nform_check = 10'}
        />
      </Field>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-4 text-sm">
          <Checkbox
            label="Highlight"
            checked={form.highlight}
            onChange={(v) => set('highlight', v)}
          />
          <Checkbox label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} />
        </div>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={14} />}
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Feature limits (entitlement_rules — enforced by the app) ─────────────────
function FeatureLimits() {
  const qc = useQueryClient();
  const rules = useQuery({
    queryKey: ['admin_entitlement_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entitlement_rules')
        .select('*')
        .order('feature', { ascending: true });
      if (error) throw error;
      return (data ?? []) as RuleRow[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings size={16} className="text-primary" /> Feature use limits
        </CardTitle>
        <CardDescription>
          These limits are enforced live for free users. Premium users (active/trialing) bypass
          them. Leave a limit blank for unlimited.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rules.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_7rem_7rem_6rem_5rem] items-center gap-3 border-b border-border/60 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Feature</span>
              <span>Daily limit</span>
              <span>Total limit</span>
              <span>Premium only</span>
              <span />
            </div>
            {rules.data?.map((r) => (
              <RuleRowEditor
                key={r.feature}
                rule={r}
                onSaved={() => qc.invalidateQueries({ queryKey: ['admin_entitlement_rules'] })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuleRowEditor({ rule, onSaved }: { rule: RuleRow; onSaved: () => void }) {
  const [daily, setDaily] = React.useState(rule.free_daily_limit?.toString() ?? '');
  const [total, setTotal] = React.useState(rule.free_total_limit?.toString() ?? '');
  const [premiumOnly, setPremiumOnly] = React.useState(rule.premium_only);

  React.useEffect(() => {
    setDaily(rule.free_daily_limit?.toString() ?? '');
    setTotal(rule.free_total_limit?.toString() ?? '');
    setPremiumOnly(rule.premium_only);
  }, [rule]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('entitlement_rules')
        .update({
          free_daily_limit: daily.trim() === '' ? null : Number(daily),
          free_total_limit: total.trim() === '' ? null : Number(total),
          premium_only: premiumOnly,
        })
        .eq('feature', rule.feature);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Saved "${rule.feature}".`);
      onSaved();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to save rule.'),
  });

  return (
    <div className="grid grid-cols-[1fr_7rem_7rem_6rem_5rem] items-center gap-3 py-1">
      <div className="min-w-0">
        <div className="truncate font-mono text-sm">{rule.feature}</div>
        {rule.description ? (
          <div className="truncate text-[11px] text-muted-foreground">{rule.description}</div>
        ) : null}
      </div>
      <Input
        type="number"
        value={daily}
        onChange={(e) => setDaily(e.target.value)}
        placeholder="∞"
        disabled={premiumOnly}
        className="h-8"
      />
      <Input
        type="number"
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        placeholder="∞"
        disabled={premiumOnly}
        className="h-8"
      />
      <div className="flex justify-center">
        <Checkbox label="" checked={premiumOnly} onChange={setPremiumOnly} />
      </div>
      <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save size={13} />}
      </Button>
    </div>
  );
}

// ── small shared bits ────────────────────────────────────────────────────────
function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input bg-card/40 accent-primary"
      />
      {label ? <span className="text-muted-foreground">{label}</span> : null}
    </label>
  );
}

function limitsToText(limits: Record<string, number | null> | null): string {
  if (!limits) return '';
  return Object.entries(limits)
    .map(([k, v]) => `${k} = ${v ?? ''}`)
    .join('\n');
}

function textToLimits(text: string): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const line of text.split('\n')) {
    const [rawKey, rawVal] = line.split('=');
    const key = rawKey?.trim();
    if (!key) continue;
    const val = rawVal?.trim();
    out[key] = val ? Number(val) : null;
  }
  return out;
}
