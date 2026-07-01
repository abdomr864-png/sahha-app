import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@features/shared';
import { useRecovery } from '../hooks/useRecovery';
import { DeloadCard } from './DeloadCard';
import type { Baseline, RecoveryBand } from '../recovery';

const softShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

// Must match STAT_CARD_HEIGHT in app/(tabs)/index.tsx so the Recovery pager
// page renders at the same height as the Nutrition / Activity pages (each page's
// card row stretches to its tallest card).
const STAT_CARD_HEIGHT = 150;

const BAND_GRADIENT: Record<RecoveryBand, [string, string]> = {
  recovered: ['#34E89E', '#12B886'],
  moderate: ['#F5C451', '#D97706'],
  fatigued: ['#FB7185', '#E11D48'],
};
const BUILDING_GRADIENT: [string, string] = ['#4B4B57', '#34343F'];

/**
 * Recovery / readiness page for the home stat pager. Replaces the raw-metric
 * display with a personalized recovery score, the contributing factors shown
 * "vs your baseline" (never as bare numbers), and a deload card when the system
 * recommends one. Keeps "—" no-data handling and SDNN/RMSSD labelling.
 */
export function RecoveryPage() {
  const { t } = useTranslation();
  const { score, baselines, inputs, deload } = useRecovery();

  const building = score.building;
  const band = score.band;
  const gradient = band ? BAND_GRADIENT[band] : BUILDING_GRADIENT;

  const bandLabel = band
    ? t(`recovery.band.${band}`, {
        defaultValue:
          band === 'recovered' ? 'Recovered' : band === 'moderate' ? 'Moderate' : 'Fatigued',
      })
    : t('recovery.building', { defaultValue: 'Building baseline' });

  const message = building
    ? t('recovery.buildingMessage', {
        defaultValue:
          'Keep wearing your device — your readiness score unlocks after a week of data.',
      })
    : band === 'recovered'
      ? t('recovery.messageRecovered', { defaultValue: "You're recovered — good day to push." })
      : band === 'moderate'
        ? t('recovery.messageModerate', {
            defaultValue: 'Moderately recovered — train as planned and listen to your body.',
          })
        : t('recovery.messageFatigued', {
            defaultValue: 'Take it easy today — prioritize rest and recovery.',
          });

  return (
    <View>
      {/* Hero recovery-score ring */}
      <View className="bg-bg-subtle rounded-3xl p-4 border border-border mb-4" style={softShadow}>
        <View className="flex-row items-center">
          <ScoreRing
            score={building ? null : score.score}
            gradient={gradient}
            gradientId="recoveryRing"
            size={94}
          />
          <View className="flex-1 ml-4">
            <View className="flex-row items-center mb-1" style={{ gap: 7 }}>
              <Icon name="heart" size={15} color="#B4B4C2" />
              <Text
                className="text-ink-muted text-[10px] font-extrabold uppercase"
                style={{ letterSpacing: 1.4 }}
              >
                {t('recovery.readiness', { defaultValue: 'Readiness' })}
              </Text>
            </View>
            <Text className="text-ink font-display" style={{ fontSize: 26, lineHeight: 30 }}>
              {bandLabel}
            </Text>
            <Text className="text-ink-subtle text-[12.5px] mt-1" style={{ lineHeight: 17 }}>
              {message}
            </Text>
          </View>
        </View>
      </View>

      {/* Deload nudge — self-hides when not recommended or dismissed */}
      <DeloadCard rec={deload} />

      {/* Contributing factors — shown vs baseline / goal, not bare numbers */}
      <View className="flex-row mb-4" style={{ gap: 12 }}>
        <FactorCard
          icon="clock"
          label={t('recovery.sleep', { defaultValue: 'Sleep' })}
          value={inputs.sleepMinutes != null ? formatHours(inputs.sleepMinutes) : '—'}
          accent="#A5B4FC"
          delta={sleepDelta(t, inputs.sleepMinutes, inputs.sleepGoalMin)}
        />
        <FactorCard
          icon="trending"
          label={hrvLabel(t, inputs.hrvVariant)}
          value={inputs.hrv != null ? `${inputs.hrv}` : '—'}
          unit={inputs.hrv != null ? 'ms' : ''}
          accent="#60A5FA"
          delta={baselineDelta(t, inputs.hrv, baselines.hrv, true)}
        />
        <FactorCard
          icon="heart"
          label={t('recovery.restingHr', { defaultValue: 'Resting HR' })}
          value={inputs.restingHr != null ? `${inputs.restingHr}` : '—'}
          unit={inputs.restingHr != null ? 'bpm' : ''}
          accent="#F43F5E"
          delta={baselineDelta(t, inputs.restingHr, baselines.restingHr, false)}
        />
      </View>
    </View>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

interface Delta {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

const TONE_COLOR: Record<Delta['tone'], string> = {
  good: '#34E89E',
  bad: '#FB7185',
  neutral: '#9A9AA8',
};

function formatHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

function hrvLabel(t: Translate, variant: 'SDNN' | 'RMSSD' | null): string {
  const base = t('recovery.hrv', { defaultValue: 'HRV' });
  return variant ? `${base} (${variant})` : base;
}

function sleepDelta(t: Translate, sleepMin: number | null, goalMin: number): Delta {
  if (sleepMin == null)
    return { text: t('recovery.noData', { defaultValue: 'No data' }), tone: 'neutral' };
  const diffMin = sleepMin - goalMin;
  const goalLabel = t('recovery.vsGoal', { defaultValue: 'vs goal' });
  if (Math.abs(diffMin) < 15)
    return { text: t('recovery.onGoal', { defaultValue: 'on goal' }), tone: 'good' };
  const h = Math.round((Math.abs(diffMin) / 60) * 10) / 10;
  const sign = diffMin > 0 ? '+' : '−';
  return { text: `${sign}${h}h ${goalLabel}`, tone: diffMin >= 0 ? 'good' : 'bad' };
}

/**
 * "vs your baseline" delta for a wearable metric. `higherIsBetter` flips the
 * tone (HRV: higher = good; resting HR: lower = good). Never compares across
 * HRV variants — the caller passes the variant-matched baseline.
 */
function baselineDelta(
  t: Translate,
  today: number | null,
  baseline: Baseline | null,
  higherIsBetter: boolean,
): Delta {
  if (today == null)
    return { text: t('recovery.noData', { defaultValue: 'No data' }), tone: 'neutral' };
  if (baseline == null)
    return { text: t('recovery.buildingShort', { defaultValue: 'building…' }), tone: 'neutral' };
  const diff = Math.round((today - baseline.mean) * 10) / 10;
  const vsAvg = t('recovery.vsAvg', { defaultValue: 'vs avg' });
  if (Math.abs(diff) < 0.5)
    return { text: t('recovery.atAvg', { defaultValue: 'at avg' }), tone: 'neutral' };
  const sign = diff > 0 ? '+' : '−';
  const isGood = higherIsBetter ? diff > 0 : diff < 0;
  return { text: `${sign}${Math.abs(diff)} ${vsAvg}`, tone: isGood ? 'good' : 'bad' };
}

function FactorCard({
  icon,
  label,
  value,
  unit = '',
  accent,
  delta,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
  accent: string;
  delta: Delta;
}) {
  return (
    <View
      className="bg-bg-raised rounded-3xl p-3.5 border border-border"
      style={[{ flex: 1, height: STAT_CARD_HEIGHT }, softShadow]}
    >
      <View className="flex-row items-baseline">
        <Text className="text-ink text-2xl font-extrabold tracking-tight">{value}</Text>
        {unit ? <Text className="text-ink-muted text-sm font-bold ml-0.5">{unit}</Text> : null}
      </View>
      <Text className="text-ink-subtle text-[11px] mt-0.5" numberOfLines={1}>
        {label}
      </Text>
      <Text
        className="text-[11px] font-bold mt-1.5"
        numberOfLines={1}
        style={{ color: TONE_COLOR[delta.tone] }}
      >
        {delta.text}
      </Text>
      <View className="items-center mt-2">
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#21212B',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: `${accent}40`,
          }}
        >
          <Icon name={icon} size={18} color={accent} />
        </View>
      </View>
    </View>
  );
}

function ScoreRing({
  score,
  gradient,
  gradientId,
  size,
}: {
  score: number | null;
  gradient: [string, string];
  gradientId: string;
  size: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score != null ? Math.max(0, Math.min(1, score / 100)) : 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[1]} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#21212B"
          strokeWidth={stroke}
          fill="none"
        />
        {pct > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-ink font-display" style={{ fontSize: 24, lineHeight: 26 }}>
          {score != null ? score : '—'}
        </Text>
        <Text className="text-ink-muted" style={{ fontSize: 9, fontWeight: '600' }}>
          {score != null ? '/100' : ''}
        </Text>
      </View>
    </View>
  );
}
