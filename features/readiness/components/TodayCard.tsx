/**
 * The "Today" card — the flagship readiness surface, pinned to the top of the
 * home pager. Shows the verdict + a one-liner + the concrete adjustment; tap to
 * expand the "why" (the inputs that drove it) and log an optional subjective
 * check-in.
 *
 * Gating: the basic recovery score stays free (Recovery pager page); the verdict
 * + load adjustment are Pro. Free users see a graceful upsell teaser — never a
 * crash or blank space. The whole card is behind the `readiness` feature flag.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from '@features/shared';
import { useEntitlement } from '@features/premium';
import { useFeatureFlag } from '@features/feature-flags';
import { useReadiness } from '../hooks/useReadiness';
import type { ReadinessDriver, ReadinessState, ReadinessVerdict } from '../types';

const softShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

const STATE_GRADIENT: Record<ReadinessState, [string, string]> = {
  primed: ['#34E89E', '#12B886'],
  ready: ['#60A5FA', '#3B82F6'],
  caution: ['#F5C451', '#D97706'],
  rest: ['#FB7185', '#E11D48'],
};
const STATE_ICON: Record<ReadinessState, IconName> = {
  primed: 'zap',
  ready: 'check-circle',
  caution: 'alert',
  rest: 'heart',
};

function fmtMult(m: number): string {
  return m.toFixed(2).replace(/\.?0+$/, '') || '0';
}

/** Localized "why" line for one driver. */
function driverLabel(t: ReturnType<typeof useTranslation>['t'], d: ReadinessDriver): string {
  if (d.key === 'acwr') {
    const v = d.value != null ? d.value.toFixed(2) : '—';
    return t(`readiness.driver.acwr.${d.emphasis}`, { value: v });
  }
  if (d.key === 'recovery') {
    const v = d.value != null ? Math.round(d.value) : '—';
    return t(`readiness.driver.recovery.${d.emphasis}`, { value: v });
  }
  if (d.key === 'rest') return t('readiness.driver.rest.negative');
  return t('readiness.driver.subjective.negative');
}

function AdjustmentChips({ verdict }: { verdict: ReadinessVerdict }) {
  const { t } = useTranslation();
  const a = verdict.adjustment;
  const chips: string[] = [];
  chips.push(t('readiness.adj.load', { mult: fmtMult(a.loadMultiplier) }));
  chips.push(
    a.rpeCap == null ? t('readiness.adj.noRpeCap') : t('readiness.adj.rpeCap', { cap: a.rpeCap }),
  );
  if (a.activeRecoveryOnly) chips.push(t('readiness.adj.activeRecovery'));
  else if (a.dropAccessoryVolume) chips.push(t('readiness.adj.trimAccessories'));
  return (
    <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
      {chips.map((c) => (
        <View key={c} className="bg-bg-raised rounded-full px-3 py-1 border border-border">
          <Text className="text-ink-subtle text-xs font-semibold">{c}</Text>
        </View>
      ))}
    </View>
  );
}

/** 1–5 selector row for one subjective signal. */
function ScaleRow({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: number | undefined;
  onSelect: (n: number) => void;
}) {
  return (
    <View className="flex-row items-center justify-between mt-2">
      <Text className="text-ink-muted text-xs font-semibold">{label}</Text>
      <View className="flex-row" style={{ gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onSelect(n)}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${n}`}
              className={`w-7 h-7 rounded-full items-center justify-center border ${
                active ? 'bg-accent border-accent' : 'bg-bg-raised border-border'
              }`}
            >
              <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-ink-muted'}`}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The Pro upsell teaser shown to free users. */
function LockedTeaser() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/paywall')}
      accessibilityRole="button"
      className="bg-bg-subtle rounded-3xl p-4 border border-border mb-4"
      style={softShadow}
    >
      <View className="flex-row items-center">
        <View className="w-11 h-11 rounded-2xl items-center justify-center bg-bg-raised border border-border mr-3">
          <Icon name="crown" size={20} color="#F5C451" />
        </View>
        <View className="flex-1">
          <Text className="text-ink-muted text-xs font-bold uppercase tracking-wide">
            {t('readiness.kicker')}
          </Text>
          <Text className="text-ink text-lg font-display tracking-tight">
            {t('readiness.locked.title')}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="#9A9AA6" />
      </View>
      <Text className="text-ink-subtle text-sm mt-2">{t('readiness.locked.body')}</Text>
    </Pressable>
  );
}

export function TodayCard() {
  const { t } = useTranslation();
  const flagOn = useFeatureFlag('readiness');
  const ent = useEntitlement('readiness');
  const { verdict, fromCache, checkin, setCheckin } = useReadiness();
  const [expanded, setExpanded] = useState(false);

  // Feature-flagged off → render nothing at all.
  if (!flagOn) return null;
  // Free user (premium_only) → graceful upsell. While the entitlement is still
  // loading we optimistically render the verdict (the data is local anyway).
  if (ent.data && !ent.data.allowed) return <LockedTeaser />;
  // First-ever launch with no data + no cache.
  if (!verdict) return null;

  const grad = STATE_GRADIENT[verdict.state];

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={t('readiness.kicker')}
      className="bg-bg-subtle rounded-3xl p-4 border border-border mb-4"
      style={softShadow}
    >
      <View className="flex-row items-center">
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Icon name={STATE_ICON[verdict.state]} size={22} color="#0A0A0F" />
        </LinearGradient>
        <View className="flex-1">
          <Text className="text-ink-muted text-xs font-bold uppercase tracking-wide">
            {t('readiness.kicker')}
          </Text>
          <Text className="text-ink text-2xl font-display tracking-tight">
            {t(`readiness.state.${verdict.state}`)}
          </Text>
        </View>
        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={20} color="#9A9AA6" />
      </View>

      <Text className="text-ink-subtle text-sm mt-2">{t(`readiness.line.${verdict.state}`)}</Text>

      <AdjustmentChips verdict={verdict} />

      {verdict.building ? (
        <Text className="text-ink-muted text-xs mt-3">{t('readiness.building')}</Text>
      ) : null}

      {expanded ? (
        <View className="mt-4 pt-3 border-t border-border">
          <Text className="text-ink-muted text-xs font-bold uppercase tracking-wide mb-1">
            {t('readiness.why')}
          </Text>
          {verdict.drivers.length === 0 ? (
            <Text className="text-ink-subtle text-sm">{t('readiness.driver.none')}</Text>
          ) : (
            verdict.drivers.map((d) => (
              <View key={d.key} className="flex-row items-center mt-1.5">
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginRight: 8,
                    backgroundColor:
                      d.emphasis === 'positive'
                        ? '#12B886'
                        : d.emphasis === 'negative'
                          ? '#E11D48'
                          : '#9A9AA6',
                  }}
                />
                <Text className="text-ink-subtle text-sm flex-1">{driverLabel(t, d)}</Text>
              </View>
            ))
          )}

          {/* Subjective check-in */}
          <Text className="text-ink-muted text-xs font-bold uppercase tracking-wide mt-4 mb-1">
            {t('readiness.checkin.title')}
          </Text>
          <ScaleRow
            label={t('readiness.checkin.energy')}
            value={checkin?.energy}
            onSelect={(n) => setCheckin({ energy: n, soreness: checkin?.soreness ?? 3 })}
          />
          <ScaleRow
            label={t('readiness.checkin.soreness')}
            value={checkin?.soreness}
            onSelect={(n) => setCheckin({ energy: checkin?.energy ?? 3, soreness: n })}
          />

          <Text className="text-ink-muted text-[11px] mt-4">{t('readiness.disclaimer')}</Text>
          {fromCache ? (
            <Text className="text-ink-muted text-[11px] mt-1">{t('readiness.offline')}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
