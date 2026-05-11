import * as React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Activity, Sparkles, Lock, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';

export default function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Left — brand panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 lg:pr-14">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-[480px] w-[480px] rounded-full bg-blue-500/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow-primary">
            <Activity size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Sahha</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Admin Console
            </div>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live database connected
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance">
            Operate every corner of the Sahha platform.
          </h1>
          <p className="text-base text-muted-foreground text-balance">
            Users, workouts, AI usage, subscriptions, streaks — all in one place, with row-level
            security backing every action.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Feature icon={ShieldCheck} title="Secured by RLS" body="Role-gated via app_metadata" />
            <Feature icon={Sparkles} title="Live KPIs" body="Aggregates refresh on demand" />
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Sahha · internal use only
        </div>
      </div>

      {/* Right — sign-in form */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          <div className="space-y-2 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Activity size={16} strokeWidth={2.5} />
              </div>
              <div className="text-sm font-semibold">Sahha Admin</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Use an account where{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                app_metadata.role
              </code>{' '}
              is{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-primary">
                admin
              </code>
              .
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@sahha.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <Button type="submit" className="h-11 w-full text-sm font-medium" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Signing in…' : 'Sign in to console'}
            </Button>
          </form>

          <div className="rounded-lg border border-dashed border-border/70 bg-card/40 p-3 text-xs text-muted-foreground">
            Need access? Ask a project owner to set{' '}
            <code className="font-mono text-foreground">app_metadata.role = &quot;admin&quot;</code>{' '}
            on your user.
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3 backdrop-blur">
      <Icon size={16} className="text-primary" />
      <div className="mt-2 text-xs font-medium">{title}</div>
      <div className="text-[11px] leading-snug text-muted-foreground">{body}</div>
    </div>
  );
}
