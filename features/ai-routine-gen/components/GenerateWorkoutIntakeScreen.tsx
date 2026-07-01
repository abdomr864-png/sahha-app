import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AnalyzingScope, Button, Header, Screen } from '@features/shared';
import { useEntitlement, UpgradeCallout } from '@features/premium';
import type { GenerateWorkoutRequest } from '@lib/llm';
import { useGenerateWorkout } from '../hooks/useGenerateWorkout';

type Focus = NonNullable<GenerateWorkoutRequest['session_focus']>;
type Equip = NonNullable<GenerateWorkoutRequest['equipment_override']>;

const FOCUS: Focus[] = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom'];
const DURATIONS: GenerateWorkoutRequest['duration_minutes'][] = [30, 45, 60, 75, 90];
const EQUIPS: Equip[] = ['full_gym', 'home_dumbbells', 'bodyweight', 'minimal'];

const LOADING_MESSAGE_KEYS = [
  'routines.loadingMessages.reading',
  'routines.loadingMessages.recovery',
  'routines.loadingMessages.nutrition',
  'routines.loadingMessages.building',
  'routines.loadingMessages.almost',
] as const;

export function GenerateWorkoutIntakeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const ent = useEntitlement('ai_workout_gen');
  const { generate, loading, errorCode } = useGenerateWorkout();
  const [focus, setFocus] = useState<Focus>('full_body');
  const [customFocus, setCustomFocus] = useState('');
  const [duration, setDuration] = useState<GenerateWorkoutRequest['duration_minutes']>(60);
  const [overrideEq, setOverrideEq] = useState<Equip | undefined>(undefined);
  const [showOverride, setShowOverride] = useState(false);

  const onGenerate = async () => {
    try {
      await generate({
        type: 'today',
        session_focus: focus,
        custom_focus: focus === 'custom' ? customFocus.trim() || undefined : undefined,
        duration_minutes: duration,
        equipment_override: overrideEq,
      });
      router.replace('/routines/generate-workout/preview');
    } catch {
      /* surfaced via errorCode */
    }
  };

  if (loading) return <LoadingMask />;

  const isBlocked = ent.data && !ent.data.allowed;

  return (
    <Screen scroll>
      <Header title={t('routines.workoutTitle', "Today's workout")} showBack />

      {isBlocked ? (
        <UpgradeCallout
          reason={ent.data?.reason}
          hint={
            ent.data?.reason === 'premium_only'
              ? t('premium.premiumOnly', 'This is a premium feature')
              : t('routines.dailyLimit', 'You can generate 3 workouts/day on the free plan.')
          }
        />
      ) : null}

      <Section title={t('routines.focus', 'What do you want to focus on?')}>
        <ChipGrid
          items={FOCUS.map((f) => ({ key: f, label: t(`routines.focuses.${f}`, f) }))}
          value={focus}
          onChange={(v) => setFocus(v as Focus)}
        />
        {focus === 'custom' ? (
          <View className="bg-bg-raised border border-border rounded-2xl px-4 py-3 mt-3">
            <TextInput
              value={customFocus}
              onChangeText={setCustomFocus}
              placeholder={t('routines.customPlaceholder', 'e.g. shoulders + abs')}
              placeholderTextColor="#B4B4C2"
              className="text-ink text-base"
            />
          </View>
        ) : null}
      </Section>

      <Section title={t('routines.duration', 'How long?')}>
        <ChipGrid
          items={DURATIONS.map((d) => ({ key: String(d), label: `${d} min` }))}
          value={String(duration)}
          onChange={(v) => setDuration(Number(v) as GenerateWorkoutRequest['duration_minutes'])}
        />
      </Section>

      <View className="mb-2">
        <Pressable onPress={() => setShowOverride((s) => !s)}>
          <Text className="text-accent text-sm font-bold">
            {showOverride
              ? t('routines.hideEquip', '— Hide equipment override')
              : t('routines.showEquip', '+ Equipment available (optional)')}
          </Text>
        </Pressable>
      </View>
      {showOverride ? (
        <Section title={t('routines.equipment', 'Equipment available')}>
          <ChipGrid
            items={EQUIPS.map((e) => ({ key: e, label: t(`ai.program.eqs.${e}`, e) }))}
            value={overrideEq ?? ''}
            onChange={(v) => setOverrideEq(v as Equip)}
          />
        </Section>
      ) : null}

      {errorCode ? (
        <View className="my-3 p-3 rounded-2xl bg-bg-raised border border-danger">
          <Text className="text-danger text-sm">{t(`errors.ai.${errorCode}`, errorCode)}</Text>
        </View>
      ) : null}

      <View className="h-2" />
      <Button
        label={t('routines.generate', 'Generate workout')}
        icon="sparkles"
        onPress={onGenerate}
        disabled={!!isBlocked || (focus === 'custom' && !customFocus.trim())}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-2.5">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function ChipGrid({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            className={`px-4 py-2.5 rounded-full border ${
              active ? 'bg-accent border-accent' : 'bg-bg-raised border-border'
            }`}
          >
            <Text className={`text-sm font-bold ${active ? 'text-accent-contrast' : 'text-ink'}`}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LoadingMask() {
  const { t } = useTranslation();
  return (
    <Screen padded={false}>
      <AnalyzingScope
        icon="dumbbell"
        stages={LOADING_MESSAGE_KEYS.map((k) => t(k))}
        sublabel={t('routines.analyzeSub', 'AI COACH · BUILDING YOUR SESSION')}
        footLabel={t('routines.analyzeFoot', 'BUILDING')}
        stageIntervalMs={1500}
        durationMs={7000}
      />
    </Screen>
  );
}
