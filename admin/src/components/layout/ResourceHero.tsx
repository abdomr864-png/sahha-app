import { accentClasses, type Accent } from '@/config/resourceVisuals';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  accent: Accent;
  title: string;
  blurb: string;
  table: string;
  readOnly?: boolean;
  rightSlot?: React.ReactNode;
}

export default function ResourceHero({
  icon: Icon,
  accent,
  title,
  blurb,
  table,
  readOnly,
  rightSlot,
}: Props) {
  const a = accentClasses[accent];
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 shadow-soft backdrop-blur-sm',
      )}
    >
      {/* Gradient wash */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80',
          a.gradient,
        )}
      />
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative flex items-start gap-5">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1',
            a.bg,
            a.text,
            a.ring,
            a.glow,
          )}
        >
          <Icon size={24} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Table
            </div>
            <span className="text-muted-foreground/40">·</span>
            <code className="font-mono text-[11px] text-muted-foreground">{table}</code>
            {readOnly && <Badge variant="warning">read-only</Badge>}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{blurb}</p>
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </div>
  );
}
