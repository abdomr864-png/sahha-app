import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AnalyzingScope, Button, Header, Icon, Screen } from '@features/shared';
import { supabase as typedSupabase } from '@lib/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { aiClient } from '@lib/llm';
import { AIError } from '@lib/llm/client';
import type { Adjustment } from '@lib/llm';
import { useAdjustmentContext, type ExerciseContext } from '../hooks/useAdjustmentContext';
import { ADJ_META, deltaLabel } from './adjustmentMeta';

const VIOLET = '#A855F7';

export function ProgramAdjustScreen() {
  const { t, i18n } = useTranslation();
  const { program_id } = useLocalSearchParams<{ program_id: string }>();
  const locale = ((i18n.language as string | undefined) ?? 'en').slice(0, 2) as 'en' | 'fr' | 'ar';

  const [loading, setLoading] = useState(false);
  const [adjustmentId, setAdjustmentId] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Resolve each suggestion's target exercise so cards show real names + targets.
  const exIds = adjustment?.adjustments.map((a) => a.program_exercise_id) ?? [];
  const ctx = useAdjustmentContext(exIds, locale);

  useEffect(() => {
    if (!program_id) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program_id]);

  const run = async () => {
    setLoading(true);
    setErrorCode(null);
    setApplied(false);
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

  const total = adjustment?.adjustments.length ?? 0;
  const allSelected = picked.size === total && total > 0;
  const toggleAll = () => {
    if (allSelected) setPicked(new Set());
    else setPicked(new Set(Array.from({ length: total }, (_, i) => i)));
  };

  const apply = async () => {
    if (!adjustment || !adjustmentId || applying) return;
    setApplying(true);
    try {
      const accepted = adjustment.adjustments.filter((_, i) => picked.has(i));
      for (const a of accepted) {
        await applyOne(a);
      }
      await supabase
        .from('ai_program_adjustments')
        .update({ applied: true })
        .eq('id', adjustmentId);
      setApplied(true);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <Screen padded={false}>
        <AnalyzingScope
          icon="trending"
          accent={VIOLET}
          accentSoft="#B06BFF"
          stages={[
            t('ai.adjust.analyzeStages.reading', "Reading last week's logs…"),
            t('ai.adjust.analyzeStages.volume', 'Checking volume & intensity…'),
            t('ai.adjust.analyzeStages.recovery', 'Gauging your recovery…'),
            t('ai.adjust.analyzeStages.tuning', 'Tuning your program…'),
          ]}
          sublabel={t('ai.adjust.analyzeSub', 'AI COACH · REVIEWING YOUR WEEK')}
          footLabel={t('ai.adjust.analyzeFoot', 'REVIEWING')}
        />
      </Screen>
    );
  }

  const showFooter = !!adjustment && !applied && total > 0;

  return (
    <Screen
      scroll
      glow
      footer={
        showFooter ? (
          <View className="px-5 pb-5 pt-3 bg-bg border-t border-border">
            <Button
              label={
                picked.size > 0
                  ? t('ai.adjust.applyN', 'Apply {{count}} changes', { count: picked.size })
                  : t('ai.adjust.applyNone', 'Select changes to apply')
              }
              icon="check"
              loading={applying}
              disabled={picked.size === 0}
              onPress={apply}
            />
          </View>
        ) : null
      }
    >
      <Header title={t('ai.adjust.title', 'Weekly review')} showBack />

      {errorCode ? (
        <View className="my-3 p-4 rounded-2xl bg-bg-raised border border-danger flex-row items-center">
          <Icon name="alert" size={18} color="#FF4D6D" />
          <Text className="text-danger text-sm ml-2 flex-1">
            {t(`errors.ai.${errorCode}`, errorCode)}
          </Text>
          <Pressable onPress={run} className="ml-2 px-3 py-1.5 rounded-full bg-bg-elevated">
            <Text className="text-ink text-xs font-bold">{t('common.retry', 'Retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {applied ? (
        <AppliedCard count={picked.size} onDone={run} />
      ) : adjustment ? (
        total === 0 ? (
          <AllTunedCard summary={adjustment.summary} />
        ) : (
          <>
            <ReviewHero count={total} summary={adjustment.summary} />

            <SelectionBar
              selected={picked.size}
              total={total}
              allSelected={allSelected}
              onToggleAll={toggleAll}
            />

            {adjustment.adjustments.map((a, i) => (
              <AdjustmentCard
                key={i}
                adj={a}
                checked={picked.has(i)}
                ctx={ctx.data?.get(a.program_exercise_id)}
                onPress={() => toggle(i)}
              />
            ))}
            <View style={{ height: 12 }} />
          </>
        )
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Result pieces
// ---------------------------------------------------------------------------

function ReviewHero({ count, summary }: { count: number; summary: string }) {
  const { t } = useTranslation();
  return (
    <View
      className="rounded-3xl border p-5 mb-4"
      style={{ borderColor: VIOLET + '55', backgroundColor: VIOLET + '14' }}
    >
      <View className="flex-row items-center mb-3">
        <View
          className="w-11 h-11 rounded-2xl items-center justify-center border"
          style={{ borderColor: VIOLET + '66', backgroundColor: VIOLET + '22' }}
        >
          <Icon name="trending" size={22} color={VIOLET} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
            {t('ai.adjust.heroEyebrow', 'AI COACH · WEEKLY REVIEW')}
          </Text>
          <Text className="text-ink text-lg font-extrabold mt-0.5">
            {t('ai.adjust.heroCount', '{{count}} tweaks for next week', { count })}
          </Text>
        </View>
      </View>
      <Text className="text-ink-subtle text-sm leading-5">{summary}</Text>
    </View>
  );
}

function SelectionBar({
  selected,
  total,
  allSelected,
  onToggleAll,
}: {
  selected: number;
  total: number;
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between mb-3 px-1">
      <Text className="text-ink-muted text-[11px] font-bold uppercase tracking-widest">
        {t('ai.adjust.selectedCount', '{{selected}} of {{total}} selected', { selected, total })}
      </Text>
      <Pressable
        onPress={onToggleAll}
        className="px-3 py-1.5 rounded-full bg-bg-elevated border border-border active:bg-bg-pressed"
      >
        <Text className="text-ink text-xs font-bold">
          {allSelected
            ? t('ai.adjust.deselectAll', 'Clear all')
            : t('ai.adjust.selectAll', 'Select all')}
        </Text>
      </Pressable>
    </View>
  );
}

function AdjustmentCard({
  adj,
  checked,
  ctx,
  onPress,
}: {
  adj: Adjustment['adjustments'][number];
  checked: boolean;
  ctx: ExerciseContext | undefined;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const meta = ADJ_META[adj.type];
  const typeLabel = t(`ai.adjust.types.${adj.type}`, adj.type.replace('_', ' '));
  const chip = deltaLabel(adj, typeLabel);
  const currentTarget =
    ctx?.targetSets && ctx?.targetReps ? `${ctx.targetSets}×${ctx.targetReps}` : null;

  return (
    <Pressable
      onPress={onPress}
      className={`p-4 mb-2 rounded-2xl border ${
        checked ? 'border-accent bg-accent/10' : 'border-border bg-bg-raised'
      }`}
    >
      <View className="flex-row items-center">
        {/* Type icon tile */}
        <View
          className="w-10 h-10 rounded-2xl items-center justify-center border"
          style={{ borderColor: meta.color + '66', backgroundColor: meta.color + '22' }}
        >
          <Icon name={meta.icon} size={18} color={meta.color} />
        </View>

        <View className="flex-1 ml-3 mr-2">
          <Text className="text-ink font-bold" numberOfLines={1}>
            {ctx?.name || typeLabel}
          </Text>
          <View className="flex-row items-center mt-0.5 flex-wrap">
            <Text
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: meta.color }}
            >
              {chip}
            </Text>
            {currentTarget ? (
              <>
                <View className="w-1 h-1 rounded-full bg-ink-dim mx-2" />
                <Text className="text-ink-muted text-[11px]">{currentTarget}</Text>
              </>
            ) : null}
            {ctx?.muscleGroup ? (
              <>
                <View className="w-1 h-1 rounded-full bg-ink-dim mx-2" />
                <Text className="text-ink-muted text-[11px] capitalize">{ctx.muscleGroup}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Selection toggle */}
        <View
          className={`w-7 h-7 rounded-full items-center justify-center border-2 ${
            checked ? 'bg-accent border-accent' : 'border-border-strong'
          }`}
        >
          {checked ? <Icon name="check" size={15} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
      </View>

      <Text className="text-ink-subtle text-sm leading-5 mt-3">{adj.reasoning}</Text>
    </Pressable>
  );
}

function AllTunedCard({ summary }: { summary: string }) {
  const { t } = useTranslation();
  return (
    <View className="items-center mt-10 px-4">
      <View className="w-20 h-20 rounded-3xl bg-emerald-900/30 border border-emerald-500/40 items-center justify-center">
        <Icon name="check-circle" size={38} color="#2EE6A6" />
      </View>
      <Text className="text-ink text-xl font-extrabold mt-5 text-center">
        {t('ai.adjust.allTunedTitle', "You're dialed in")}
      </Text>
      <Text className="text-ink-subtle text-sm leading-5 mt-2 text-center">
        {summary || t('ai.adjust.allTunedBody', 'No changes needed this week — keep showing up.')}
      </Text>
    </View>
  );
}

function AppliedCard({ count, onDone }: { count: number; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-center mt-10 px-4">
      <View className="w-20 h-20 rounded-3xl bg-accent/15 border border-accent/40 items-center justify-center">
        <Icon name="check-circle" size={38} color="#FF4D2E" />
      </View>
      <Text className="text-ink text-xl font-extrabold mt-5 text-center">
        {t('ai.adjust.appliedTitle', 'Program updated')}
      </Text>
      <Text className="text-ink-subtle text-sm leading-5 mt-2 text-center">
        {t('ai.adjust.appliedBody', '{{count}} changes are live for next week.', { count })}
      </Text>
      <View className="h-6" />
      <Button
        label={t('ai.adjust.reviewAgain', 'Review again')}
        variant="secondary"
        icon="trending"
        fullWidth={false}
        onPress={onDone}
      />
    </View>
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
