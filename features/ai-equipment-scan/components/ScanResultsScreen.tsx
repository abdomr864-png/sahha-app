import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Header, Icon, MuscleSilhouette, Screen } from '@features/shared';
import type { IconName } from '@features/shared';
import { ExerciseAnimation } from '@features/ai-routine-gen';
import { exerciseImages } from '@features/ai-routine-gen/data/exerciseLookup';
import { useSession } from '@features/auth';
import { useScanResultStore } from '../store';
import { saveScanForUser } from '../repositories/scans';
import type { EquipmentDetails, EquipmentMatch } from '@lib/llm';

export function ScanResultsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const { result, scannedImageUrl, clear } = useScanResultStore();
  const [saved, setSaved] = useState(false);
  const [demoFailed, setDemoFailed] = useState(false);
  const demoImages = useMemo(
    () => (result?.equipment ? resolveDemoImages(result.equipment, result.matched_exercises) : []),
    [result?.equipment, result?.matched_exercises],
  );

  if (!result) {
    return (
      <Screen scroll>
        <Header title={t('scan.results.title', 'Scan results')} showBack />
        <Text className="text-ink-subtle">{t('scan.results.empty', 'No scan to show.')}</Text>
        <View className="h-4" />
        <Button label={t('scan.again', 'Scan another')} onPress={() => router.replace('/scan')} />
      </Screen>
    );
  }

  if (result.unrecognized || !result.equipment) {
    return (
      <Screen scroll>
        <Header title={t('scan.results.title', 'Scan results')} showBack />
        <Card>
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-danger/15 border border-danger/40 items-center justify-center mb-3">
              <Icon name="alert" size={28} color="#FF4D6D" />
            </View>
            <Text className="text-ink text-xl font-extrabold mb-2 text-center">
              {t('scan.notEquipmentTitle', "That doesn't look like gym equipment")}
            </Text>
            <Text className="text-ink-subtle text-center">
              {t(
                'scan.notEquipmentBody',
                'Please retake the picture. Frame a clear shot of a machine, free weight, bench, rack, or cardio equipment.',
              )}
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            <Button
              label={t('scan.retake', 'Retake photo')}
              icon="camera"
              onPress={() => {
                clear();
                router.replace('/scan');
              }}
            />
            <Button
              label={t('scan.searchLib', 'Search library')}
              variant="secondary"
              onPress={() => router.replace('/routines')}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  const eq = result.equipment;
  const lang = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';
  const localizedName = lang === 'fr' ? eq.name_fr : lang === 'ar' ? eq.name_ar : eq.name_en;

  const typeMeta = EQUIPMENT_TYPE_META[eq.type];
  const difficultyColor = DIFFICULTY_COLOR[eq.difficulty];
  const confidenceMeta = CONFIDENCE_META[eq.confidence];

  const hasAnimatedDemo = demoImages.length > 0 && !demoFailed;

  const saveScan = async () => {
    if (!session?.user) return;
    try {
      await saveScanForUser(session.user.id, result, scannedImageUrl);
      setSaved(true);
    } catch {
      /* ignore — non-critical */
    }
  };

  return (
    <Screen scroll>
      <Header title={t('scan.results.title', 'Scan results')} showBack />

      {/* Hero — animated demo when we have frames, gradient fallback otherwise */}
      {hasAnimatedDemo ? (
        <View
          className="rounded-3xl overflow-hidden mb-3 border border-border"
          style={{
            height: 260,
            shadowColor: typeMeta.color,
            shadowOpacity: 0.4,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <View style={{ position: 'absolute', inset: 0, backgroundColor: '#17171B' }} />
          <ExerciseAnimation
            images={demoImages}
            durationMs={650}
            fadeMs={500}
            scalePulse
            onError={() => setDemoFailed(true)}
            style={{ width: '100%', height: '100%' }}
          />
          {/* Bottom gradient for legibility */}
          <LinearGradient
            pointerEvents="none"
            colors={
              [
                'rgba(11,11,15,0)',
                'rgba(11,11,15,0.75)',
                'rgba(11,11,15,0.95)',
              ] as unknown as readonly [string, string, ...string[]]
            }
            start={{ x: 0, y: 0.3 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 180 }}
          />
          {/* Live demo badge */}
          <View
            className="absolute flex-row items-center"
            style={{
              top: 12,
              left: 12,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.55)',
              gap: 5,
            }}
          >
            <View
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: typeMeta.color }}
            />
            <Text
              className="text-white text-[9px] font-extrabold uppercase"
              style={{ letterSpacing: 1.2 }}
            >
              {t('scan.liveDemo', 'Live demo')}
            </Text>
          </View>

          {/* Bottom content */}
          <View className="absolute left-0 right-0 bottom-0 p-4">
            <Text
              className="text-white/80 text-[10px] font-extrabold uppercase mb-1"
              style={{ letterSpacing: 1.2 }}
              numberOfLines={1}
            >
              {eq.primary_muscles.map((m) => t(`train.muscleGroups.${m}`, m)).join(' · ')}
            </Text>
            <Text
              className="text-white text-2xl font-extrabold tracking-tight mb-2"
              style={{ lineHeight: 28 }}
              numberOfLines={2}
            >
              {localizedName}
            </Text>
            <View className="flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <HeroPill
                dotColor={difficultyColor}
                label={t(`scan.lvl.${eq.difficulty}`, eq.difficulty)}
              />
              <HeroPill
                dotColor={confidenceMeta.color}
                label={t(
                  `scan.confidence.${eq.confidence}`,
                  `${eq.confidence.toUpperCase()} CONFIDENCE`,
                )}
              />
            </View>
          </View>
        </View>
      ) : (
        <View
          className="rounded-3xl overflow-hidden mb-3 border border-border"
          style={{
            shadowColor: typeMeta.color,
            shadowOpacity: 0.35,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <LinearGradient
            colors={typeMeta.gradient as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 18 }}
          >
            <View className="flex-row items-start">
              <View
                className="rounded-2xl items-center justify-center border border-white/25"
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                }}
              >
                <Icon name={typeMeta.icon} size={26} color="#FFFFFF" />
              </View>
              <View className="flex-1 ml-3">
                <Text
                  className="text-white/80 text-[10px] font-extrabold uppercase mb-1"
                  style={{ letterSpacing: 1.2 }}
                >
                  {t(`scan.type.${eq.type}`, eq.type.replace('_', ' '))}
                </Text>
                <Text
                  className="text-white text-2xl font-extrabold tracking-tight"
                  style={{ lineHeight: 28 }}
                >
                  {localizedName}
                </Text>
              </View>
            </View>

            {/* Pill row */}
            <View className="flex-row mt-3" style={{ gap: 6, flexWrap: 'wrap' }}>
              <HeroPill
                dotColor={difficultyColor}
                label={t(`scan.lvl.${eq.difficulty}`, eq.difficulty)}
              />
              <HeroPill
                dotColor={confidenceMeta.color}
                label={t(
                  `scan.confidence.${eq.confidence}`,
                  `${eq.confidence.toUpperCase()} CONFIDENCE`,
                )}
              />
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Muscles */}
      <Card>
        <SectionLabel icon="target" label={t('scan.muscles', 'MUSCLES TARGETED')} />
        <View className="items-center mb-4">
          <MuscleSilhouette
            primary={eq.primary_muscles}
            secondary={eq.secondary_muscles}
            size={120}
          />
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {eq.primary_muscles.map((m) => (
            <View key={m} className="bg-accent/15 border border-accent/30 rounded-full px-3 py-1">
              <Text className="text-accent text-xs font-bold">
                {t(`train.muscleGroups.${m}`, m)}
              </Text>
            </View>
          ))}
          {eq.secondary_muscles.map((m) => (
            <View
              key={`s-${m}`}
              className="bg-bg-subtle border border-border rounded-full px-3 py-1"
            >
              <Text className="text-ink-subtle text-xs font-bold">
                {t(`train.muscleGroups.${m}`, m)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View className="h-3" />

      {/* How to use — setup */}
      {eq.setup_tips && eq.setup_tips.length > 0 ? (
        <>
          <Card>
            <SectionLabel icon="ruler" label={t('scan.setup', 'SET UP')} />
            <View style={{ gap: 10 }}>
              {eq.setup_tips.map((tip) => (
                <View key={tip} className="flex-row items-start">
                  <View
                    className="rounded-full bg-accent/15 border border-accent/40 items-center justify-center mr-2.5"
                    style={{ width: 22, height: 22, marginTop: 1 }}
                  >
                    <Icon name="check" size={12} color="#FF4D2E" />
                  </View>
                  <Text className="text-ink flex-1 leading-5">{tip}</Text>
                </View>
              ))}
            </View>
          </Card>
          <View className="h-3" />
        </>
      ) : null}

      {/* How to use — steps */}
      {eq.tutorial_steps && eq.tutorial_steps.length > 0 ? (
        <>
          <Card>
            <SectionLabel icon="play" label={t('scan.howToUse', 'HOW TO USE')} />
            <View style={{ gap: 12 }}>
              {eq.tutorial_steps.map((step, i) => (
                <View key={i} className="flex-row items-start">
                  <View
                    className="rounded-xl bg-bg-elevated border border-border items-center justify-center mr-3"
                    style={{ width: 30, height: 30 }}
                  >
                    <Text className="text-accent font-extrabold text-sm">{i + 1}</Text>
                  </View>
                  <Text className="text-ink flex-1 leading-5" style={{ paddingTop: 4 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
          <View className="h-3" />
        </>
      ) : null}

      {/* Breathing + Pro tip side-by-side when both exist; stacked otherwise */}
      {eq.breathing_cue || eq.pro_tip ? (
        <>
          <View style={{ gap: 10 }}>
            {eq.breathing_cue ? (
              <CueCard
                icon="droplet"
                accent="#60A5FA"
                title={t('scan.breathing', 'BREATHING')}
                body={eq.breathing_cue}
              />
            ) : null}
            {eq.pro_tip ? (
              <CueCard
                icon="sparkles"
                accent="#F5C451"
                title={t('scan.proTip', 'PRO TIP')}
                body={eq.pro_tip}
              />
            ) : null}
          </View>
          <View className="h-3" />
        </>
      ) : null}

      {eq.common_mistakes.length ? (
        <>
          <Card>
            <SectionLabel
              icon="alert"
              label={t('scan.mistakes', 'COMMON MISTAKES')}
              accentColor="#FF4D6D"
            />
            <View style={{ gap: 8 }}>
              {eq.common_mistakes.map((m) => (
                <View key={m} className="flex-row items-start">
                  <Text className="text-danger mr-2" style={{ marginTop: 1 }}>
                    •
                  </Text>
                  <Text className="text-ink flex-1 leading-5">{m}</Text>
                </View>
              ))}
            </View>
          </Card>
          <View className="h-3" />
        </>
      ) : null}

      {eq.safety_notes.length ? (
        <>
          <View
            className="rounded-2xl p-4 border border-danger/50"
            style={{ backgroundColor: 'rgba(248,113,113,0.06)' }}
          >
            <View className="flex-row items-center mb-2">
              <Icon name="alert" size={18} color="#FF4D6D" />
              <Text
                className="text-danger text-[10px] font-extrabold ml-2"
                style={{ letterSpacing: 1.4 }}
              >
                {t('scan.safety', 'SAFETY')}
              </Text>
            </View>
            {eq.safety_notes.map((m) => (
              <Text key={m} className="text-ink mb-1 leading-5">
                {m}
              </Text>
            ))}
          </View>
          <View className="h-3" />
        </>
      ) : null}

      {eq.suggested_weight_range ? (
        <>
          <Card>
            <SectionLabel icon="scale" label={t('scan.weight', 'SUGGESTED STARTING WEIGHT')} />
            <View style={{ gap: 10 }}>
              {(['beginner_kg', 'intermediate_kg', 'advanced_kg'] as const).map((k) => {
                const v = eq.suggested_weight_range![k];
                const label = k.replace('_kg', '');
                const color = DIFFICULTY_COLOR[label as keyof typeof DIFFICULTY_COLOR];
                return (
                  <View
                    key={k}
                    className="flex-row items-center justify-between px-3 py-2.5 rounded-xl border border-border"
                    style={{ backgroundColor: `${color}10` }}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="rounded-full mr-2.5"
                        style={{ width: 8, height: 8, backgroundColor: color }}
                      />
                      <Text className="text-ink-subtle capitalize">
                        {t(`scan.lvl.${label}`, label)}
                      </Text>
                    </View>
                    <Text className="text-ink font-extrabold">{v == null ? '—' : `${v} kg`}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
          <View className="h-3" />
        </>
      ) : null}

      {result.matched_exercises.length ? (
        <View>
          <Text className="text-ink-muted text-[10px] font-extrabold tracking-widest mb-2 mt-2">
            {t('scan.exercisesHere', 'EXERCISES YOU CAN DO HERE')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 10 }}
          >
            {result.matched_exercises.map((ex) => (
              <Pressable
                key={ex.id}
                onPress={() => {
                  clear();
                  router.push(`/exercise/${ex.id}`);
                }}
                className="bg-bg-raised border border-border rounded-2xl p-4 w-56"
              >
                <Text className="text-ink font-bold mb-1" numberOfLines={2}>
                  {ex.name}
                </Text>
                <Text className="text-ink-subtle text-xs" numberOfLines={3}>
                  {ex.instructions ?? t('scan.tapForDemo', 'Tap to view demo')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View className="h-6" />

      <View style={{ gap: 8 }}>
        <Button
          label={saved ? t('scan.saved', 'Saved!') : t('scan.save', 'Save to favorites')}
          icon="bookmark"
          variant="secondary"
          onPress={saveScan}
          disabled={saved}
        />
        <Button
          label={t('scan.again', 'Scan another')}
          icon="camera"
          onPress={() => {
            clear();
            router.replace('/scan');
          }}
        />
      </View>
    </Screen>
  );
}

function SectionLabel({
  icon,
  label,
  accentColor = '#FF4D2E',
}: {
  icon: IconName;
  label: string;
  accentColor?: string;
}) {
  return (
    <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
      <View
        className="rounded-lg items-center justify-center"
        style={{
          width: 24,
          height: 24,
          backgroundColor: `${accentColor}1A`,
          borderWidth: 1,
          borderColor: `${accentColor}33`,
        }}
      >
        <Icon name={icon} size={12} color={accentColor} />
      </View>
      <Text className="text-ink-muted text-[10px] font-extrabold" style={{ letterSpacing: 1.4 }}>
        {label}
      </Text>
    </View>
  );
}

function HeroPill({ dotColor, label }: { dotColor: string; label: string }) {
  return (
    <View
      className="flex-row items-center rounded-full px-2.5 py-1 border border-white/25"
      style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
    >
      <View
        className="rounded-full mr-1.5"
        style={{ width: 6, height: 6, backgroundColor: dotColor }}
      />
      <Text
        className="text-white text-[10px] font-extrabold uppercase"
        style={{ letterSpacing: 0.8 }}
      >
        {label}
      </Text>
    </View>
  );
}

function CueCard({
  icon,
  accent,
  title,
  body,
}: {
  icon: IconName;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <View
      className="rounded-2xl p-4 border"
      style={{
        backgroundColor: `${accent}0F`,
        borderColor: `${accent}33`,
      }}
    >
      <View className="flex-row items-center mb-1.5" style={{ gap: 8 }}>
        <Icon name={icon} size={16} color={accent} />
        <Text className="text-[10px] font-extrabold" style={{ color: accent, letterSpacing: 1.4 }}>
          {title}
        </Text>
      </View>
      <Text className="text-ink leading-5">{body}</Text>
    </View>
  );
}

const EQUIPMENT_TYPE_META: Record<
  'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio',
  { icon: IconName; color: string; gradient: [string, string, string] }
> = {
  machine: {
    icon: 'dumbbell',
    color: '#A855F7',
    gradient: ['#1A0A1F', '#5B21B6', '#A855F7'],
  },
  free_weight: {
    icon: 'dumbbell',
    color: '#FF4D2E',
    gradient: ['#3F0F0F', '#9F2D17', '#FF4D2E'],
  },
  cable: {
    icon: 'zap',
    color: '#06B6D4',
    gradient: ['#0B2F3F', '#0E7490', '#06B6D4'],
  },
  bodyweight: {
    icon: 'medal',
    color: '#2EE6A6',
    gradient: ['#064E3B', '#10B981', '#2EE6A6'],
  },
  cardio: {
    icon: 'flame',
    color: '#F97316',
    gradient: ['#451A03', '#C2410C', '#F97316'],
  },
};

const DIFFICULTY_COLOR: Record<'beginner' | 'intermediate' | 'advanced', string> = {
  beginner: '#2EE6A6',
  intermediate: '#F5C451',
  advanced: '#FF4D6D',
};

const CONFIDENCE_META: Record<'high' | 'medium' | 'low', { color: string }> = {
  high: { color: '#2EE6A6' },
  medium: { color: '#F5C451' },
  low: { color: '#FF4D6D' },
};

// Maps a scanned equipment name to a representative exercise's animation
// frames in free-exercise-db. Strength equipment only — cardio explicitly
// returns [] so we never show a squat animation for a treadmill.
const EQUIPMENT_NAME_TO_DEMO_EXERCISE: Record<string, string> = {
  barbell: 'Barbell Bench Press',
  'olympic barbell': 'Barbell Bench Press',
  'ez bar': 'Barbell Curl',
  'ez-curl bar': 'Barbell Curl',
  'trap bar': 'Romanian Deadlift',
  dumbbell: 'Dumbbell Bench Press',
  dumbbells: 'Dumbbell Bench Press',
  'hex dumbbells': 'Dumbbell Bench Press',
  kettlebell: 'Goblet Squat',
  'cable machine': 'Cable Crossover',
  'cable column': 'Cable Crossover',
  'cable cross': 'Cable Crossover',
  'cable crossover': 'Cable Crossover',
  'lat pulldown': 'Lat Pulldown',
  'pulldown machine': 'Lat Pulldown',
  'seated row machine': 'Seated Cable Row',
  'cable row': 'Seated Cable Row',
  'leg press': 'Leg Press',
  'leg extension machine': 'Leg Extension',
  'leg extension': 'Leg Extension',
  'leg curl machine': 'Lying Leg Curl',
  'lying leg curl': 'Lying Leg Curl',
  'hack squat': 'Back Squat',
  'smith machine': 'Back Squat',
  'squat rack': 'Back Squat',
  'power rack': 'Back Squat',
  'bench press': 'Barbell Bench Press',
  'bench press station': 'Barbell Bench Press',
  'flat bench': 'Dumbbell Bench Press',
  'incline bench': 'Incline Dumbbell Press',
  'adjustable bench': 'Dumbbell Bench Press',
  'preacher bench': 'Barbell Curl',
  'pec deck': 'Reverse Pec Deck',
  'reverse pec deck': 'Reverse Pec Deck',
  'shoulder press machine': 'Dumbbell Shoulder Press',
  'overhead press station': 'Overhead Press',
  'pull-up bar': 'Pull-up',
  'pullup bar': 'Pull-up',
  'push-up bars': 'Push-up',
  'pushup bars': 'Push-up',
  'dip station': 'Bench Dip',
  'tricep pushdown': 'Cable Pushdown',
  'triceps pushdown': 'Cable Pushdown',
  'cable pushdown': 'Cable Pushdown',
};

// Generic equipment with no specific exercise — pick a canonical lift by
// the AI-reported primary muscle so the animation at least targets the right
// area instead of a wrong canned default.
const MUSCLE_DEFAULT_EXERCISES: Record<string, string[]> = {
  chest: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Push-up'],
  back: ['Lat Pulldown', 'Barbell Row', 'Pull-up'],
  shoulders: ['Overhead Press', 'Dumbbell Shoulder Press', 'Dumbbell Lateral Raise'],
  arms: ['Barbell Curl', 'Dumbbell Curl', 'Cable Pushdown'],
  legs: ['Back Squat', 'Leg Press', 'Bodyweight Squat'],
  glutes: ['Hip Thrust', 'Glute Bridge'],
  core: ['Plank', 'Hanging Leg Raise'],
  fullBody: ['Back Squat', 'Romanian Deadlift'],
};

function resolveDemoImages(eq: EquipmentDetails, matched: EquipmentMatch[]): string[] {
  // Cardio equipment doesn't have a discrete rep to animate. Showing any
  // strength-exercise frames would mislead the user (a squat clip under
  // "Treadmill" was the bug they hit). Always fall back to the gradient hero.
  if (eq.type === 'cardio') return [];

  // 1. Direct match on the AI-returned name (works for machine names that
  //    share a name with the canonical exercise — Lat Pulldown, Leg Press,
  //    Cable Crossover, etc.).
  const directImgs = exerciseImages(eq.name_en);
  if (directImgs.length > 0) return directImgs;

  // 2. Explicit equipment-to-exercise mapping.
  const lower = eq.name_en.toLowerCase().trim();
  const mappedName =
    EQUIPMENT_NAME_TO_DEMO_EXERCISE[lower] ??
    Object.entries(EQUIPMENT_NAME_TO_DEMO_EXERCISE).find(([k]) => lower.includes(k))?.[1];
  if (mappedName) {
    const imgs = exerciseImages(mappedName);
    if (imgs.length > 0) return imgs;
  }

  // 3. Server-matched exercises are already filtered by the primary muscle —
  //    use them next so the animation matches the targeted muscle group.
  for (const m of matched) {
    const imgs = exerciseImages(m.name);
    if (imgs.length > 0) return imgs;
  }

  // 4. Muscle-based default — pick a canonical lift for the AI-reported
  //    primary muscle. Better than nothing AND better than a wrong direct
  //    map: a generic "Barbell" with primary_muscles=legs gets a squat clip,
  //    not bench press.
  for (const m of eq.primary_muscles) {
    const candidates = MUSCLE_DEFAULT_EXERCISES[m] ?? [];
    for (const name of candidates) {
      const imgs = exerciseImages(name);
      if (imgs.length > 0) return imgs;
    }
  }

  return [];
}
