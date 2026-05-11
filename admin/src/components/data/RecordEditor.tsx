import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import type { FieldSpec, ResourceSpec } from '@/config/resources';
import { supabase } from '@/lib/supabase';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  resource: ResourceSpec;
  record: Record<string, unknown> | null; // null = create
  onClose: () => void;
}

function cloneForForm(field: FieldSpec, raw: unknown): string | boolean {
  if (raw == null) return field.type === 'boolean' ? false : '';
  if (field.type === 'boolean') return Boolean(raw);
  if (field.type === 'json' || field.type === 'array') return JSON.stringify(raw, null, 2);
  if (field.type === 'datetime' && typeof raw === 'string') return raw.slice(0, 16);
  return String(raw);
}

function parseForDb(field: FieldSpec, value: string | boolean): unknown {
  if (field.type === 'boolean') return Boolean(value);
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (v === '') return null;
  switch (field.type) {
    case 'number':
      return Number(v);
    case 'json':
    case 'array':
      return JSON.parse(v);
    case 'datetime':
      // datetime-local has no zone; treat as local and convert to ISO.
      return new Date(v).toISOString();
    default:
      return v;
  }
}

function primaryKeyColumns(spec: ResourceSpec): string[] {
  const pk = spec.primaryKey ?? 'id';
  return Array.isArray(pk) ? pk : [pk];
}

function pkPredicate(spec: ResourceSpec, record: Record<string, unknown>) {
  const cols = primaryKeyColumns(spec);
  const obj: Record<string, unknown> = {};
  cols.forEach((c) => (obj[c] = record[c]));
  return obj;
}

export default function RecordEditor({ resource, record, onClose }: Props) {
  const isCreate = !record;
  const editable = resource.fields.filter((f) => !f.editHidden && !f.readOnly);

  const [form, setForm] = React.useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {};
    for (const f of editable) initial[f.name] = cloneForForm(f, record?.[f.name]);
    return initial;
  });

  const qc = useQueryClient();
  const tableName = resource.table ?? resource.slug;

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      for (const f of editable) {
        try {
          payload[f.name] = parseForDb(f, form[f.name]);
        } catch {
          throw new Error(`Invalid value for ${f.name}`);
        }
      }
      if (isCreate) {
        const { error } = await supabase.from(tableName).insert(payload);
        if (error) throw error;
      } else {
        const predicate = pkPredicate(resource, record!);
        let q = supabase.from(tableName).update(payload);
        for (const [k, v] of Object.entries(predicate)) q = q.eq(k, v as never);
        const { error } = await q;
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rows', tableName] });
      toast.success(isCreate ? 'Created' : 'Saved');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (isCreate) return;
      const predicate = pkPredicate(resource, record!);
      let q = supabase.from(tableName).delete();
      for (const [k, v] of Object.entries(predicate)) q = q.eq(k, v as never);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rows', tableName] });
      toast.success('Deleted');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setVal =
    (name: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const v =
        e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((p) => ({ ...p, [name]: v }));
    };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {editable.map((f) => (
          <div
            key={f.name}
            className={cn(
              'space-y-1',
              f.type === 'longtext' || f.type === 'json' ? 'md:col-span-2' : '',
            )}
          >
            <label className="text-xs font-medium text-muted-foreground">
              {f.label ?? f.name}
              {f.required && <span className="text-destructive"> *</span>}
            </label>
            {renderInput(f, form[f.name], setVal(f.name))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3">
        <div>
          {!isCreate && !resource.readOnly && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={del.isPending}
              onClick={() => {
                if (confirm('Delete this row? This cannot be undone.')) del.mutate();
              }}
            >
              {del.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCreate ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function renderInput(
  f: FieldSpec,
  value: string | boolean,
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void,
) {
  if (f.type === 'boolean') {
    return (
      <label className="flex h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={onChange}
          className="h-4 w-4 rounded border-border bg-transparent accent-primary"
        />
        <span className="text-muted-foreground">{value ? 'true' : 'false'}</span>
      </label>
    );
  }
  if (f.type === 'enum') {
    return (
      <Select value={String(value)} onChange={onChange}>
        <option value="">—</option>
        {f.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  if (f.type === 'longtext' || f.type === 'json' || f.type === 'array') {
    return <Textarea value={String(value)} onChange={onChange} rows={6} />;
  }
  const inputType =
    f.type === 'number'
      ? 'number'
      : f.type === 'date'
        ? 'date'
        : f.type === 'datetime'
          ? 'datetime-local'
          : 'text';
  return (
    <Input
      type={inputType}
      value={String(value)}
      onChange={onChange}
      step={f.type === 'number' ? 'any' : undefined}
    />
  );
}
