import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button, Header, Screen, Spinner } from '@features/shared';
import { supabase as typedSupabase } from '@lib/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { aiClient } from '@lib/llm';
import { AIError } from '@lib/llm/client';
import type { Adjustment } from '@lib/llm';

export function ProgramAdjustScreen() {
  const { t } = useTranslation();
  const { program_id } = useLocalSearchParams<{ program_id: string }>();

  const [loading, setLoading] = useState(false);
  const [adjustmentId, setAdjustmentId] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!program_id) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program_id]);

  const run = async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      const res = await aiClient.adjustProgram(program_id);
      setAdjustmentId(res.adjustment_id);
      setAdjustment(res.adjustment);
      setPicked(new Set(res.adjustment.adjustments.map((_, i) => i)));
    } catch (e) {
      setErrorCode(e instanceof AIError ? e.code : 'provider_error');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setPicked(next);
  };

  const apply = async () => {
    if (!adjustment || !adjustmentId) return;
    const accepted = adjustment.adjustments.filter((_, i) => picked.has(i));
    for (const a of accepted) {
      await applyOne(a);
    }
    await supabase.from('ai_program_adjustments').update({ applied: true }).eq('id', adjustmentId);
    setAdjustmentId(null);
    setAdjustment(null);
  };

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Spinner />
          <Text className="text-ink mt-6">{t('ai.adjust.loading', 'Reviewing your week…')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={t('ai.adjust.title', 'Weekly review')} showBack />

      {errorCode ? (
        <View className="my-3 p-3 rounded-2xl bg-bg-raised border border-danger">
          <Text className="text-danger text-sm">{t(`errors.ai.${errorCode}`, errorCode)}</Text>
          <View className="h-2" />
          <Button
            label={t('common.retry', 'Retry')}
            variant="secondary"
            onPress={run}
            fullWidth={false}
          />
        </View>
      ) : null}

      {adjustment ? (
        <>
          <View className="bg-bg-raised border border-border rounded-2xl p-4 mb-4">
            <Text className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mb-2">
              {t('ai.adjust.summary', 'Summary')}
            </Text>
            <Text className="text-ink">{adjustment.summary}</Text>
          </View>

          {adjustment.adjustments.map((a, i) => {
            const checked = picked.has(i);
            return (
              <Pressable
                key={i}
                onPress={() => toggle(i)}
                className={`p-4 mb-2 rounded-2xl border ${
                  checked ? 'border-accent bg-accent/10' : 'border-border bg-bg-raised'
                }`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className={`font-bold ${checked ? 'text-accent' : 'text-ink'}`}>
                    {t(`ai.adjust.types.${a.type}`, a.type)}
                  </Text>
                  <Text className="text-ink-subtle text-xs">
                    {checked ? t('common.accept', 'Accept') : t('common.reject', 'Reject')}
                  </Text>
                </View>
                <Text className="text-ink-subtle text-sm">{a.reasoning}</Text>
              </Pressable>
            );
          })}

          <View className="h-2" />
          <Button label={t('ai.adjust.apply', 'Apply selected')} onPress={apply} icon="check" />
        </>
      ) : null}
    </Screen>
  );
}

// Apply a single adjustment by patching program_exercises.
async function applyOne(a: Adjustment['adjustments'][number]) {
  const detail = a.detail as Record<string, unknown>;
  if (a.type === 'increase_weight' || a.type === 'decrease_weight') {
    // No weight column on program_exercises in this schema — store as note.
    const { data: pe } = await supabase
      .from('program_exercises')
      .select('notes')
      .eq('id', a.program_exercise_id)
      .maybeSingle();
    const sign = a.type === 'increase_weight' ? '+' : '-';
    const note = `weight ${sign}${detail.delta_kg ?? 0}kg`;
    await supabase
      .from('program_exercises')
      .update({
        notes: [(pe as { notes?: string } | null)?.notes, note].filter(Boolean).join(' · '),
      })
      .eq('id', a.program_exercise_id);
    return;
  }
  if (a.type === 'change_reps' && typeof detail.new_reps === 'string') {
    const lower = parseInt(detail.new_reps, 10) || null;
    await supabase
      .from('program_exercises')
      .update({ target_reps: lower, notes: `reps: ${detail.new_reps}` })
      .eq('id', a.program_exercise_id);
    return;
  }
  if (a.type === 'add_set' && typeof detail.new_sets === 'number') {
    await supabase
      .from('program_exercises')
      .update({ target_sets: detail.new_sets })
      .eq('id', a.program_exercise_id);
    return;
  }
  // swap_exercise / deload: leave as note for now (requires more UI to resolve).
  await supabase
    .from('program_exercises')
    .update({ notes: `${a.type}: ${JSON.stringify(detail)}` })
    .eq('id', a.program_exercise_id);
}
