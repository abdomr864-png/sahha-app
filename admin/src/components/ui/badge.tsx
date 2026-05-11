import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'info';

const styles: Record<Variant, string> = {
  default: 'bg-muted/60 text-muted-foreground border border-border/40',
  success: 'bg-primary/10 text-primary border border-primary/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  destructive: 'bg-destructive/10 text-destructive border border-destructive/30',
  outline: 'border border-border/60 text-foreground',
  info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
};

export function Badge({
  variant = 'default',
  className,
  ...props
}: { variant?: Variant } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
