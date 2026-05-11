/* eslint-disable max-lines -- Profile is a single screen by design; the section helpers live alongside the layout. */
import { useMemo } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Chip, Icon, IconButton, Screen, type IconName } from '@features/shared';
import { useAuthGateStore, useSession, useSignOut } from '@features/auth';
import { useIsAdmin } from '@features/admin';
import { useProfile } from '@features/onboarding';
import { useSubscription } from '@features/premium';
import { setLocale, type AppLocale, SUPPORTED_LOCALES } from '@lib/i18n';

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

export default function Profile() {
  const { session } = useSession();
  if (!session) return <GuestProfile />;
  return <SignedInProfile />;
}

function SignedInProfile() {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const router = useRouter();
  const signOut = useSignOut();
  const { data: isAdmin } = useIsAdmin();
  const { session } = useSession();
  const profileQ = useProfile();
  const sub = useSubscription();

  const profile = profileQ.data;
  const email = session?.user.email ?? '';
  const isPremium = sub.data?.isPremium ?? false;

  const displayName = profile?.display_name?.trim() || t('profile.athlete');
  const handle = profile?.username ? `@${profile.username}` : email;
  const initials = useMemo(() => {
    const source = (profile?.display_name || profile?.username || email || 'A').trim();
    return source.slice(0, 1).toUpperCase();
  }, [profile?.display_name, profile?.username, email]);

  const memberSince = useMemo(() => {
    const createdAt = session?.user.created_at;
    if (!createdAt) return null;
    return new Date(createdAt).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    });
  }, [session?.user.created_at]);

  return (
    <Screen scroll glow padded={false}>
      <View className="px-5 pt-2">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-ink text-3xl font-extrabold tracking-tight">
            {t('profile.title')}
          </Text>
          <IconButton
            icon="bell"
            onPress={() => router.push('/notifications')}
            accessibilityLabel={t('profile.notifications.title')}
          />
        </View>

        {/* Identity card */}
        <Pressable
          onPress={() => router.push('/edit-profile')}
          accessibilityRole="button"
          accessibilityLabel={t('profile.edit.title')}
        >
          <Card className="mb-4">
            <View className="flex-row items-center">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center mr-4 overflow-hidden"
                style={{
                  backgroundColor: '#FF4D2E',
                  shadowColor: '#FF4D2E',
                  shadowOpacity: 0.4,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 8,
                }}
              >
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <Text className="text-white text-2xl font-extrabold">{initials}</Text>
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text
                    className="text-ink text-lg font-extrabold tracking-tight"
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {isPremium ? (
                    <View className="ml-2 bg-accent/15 rounded-full px-2 py-0.5 flex-row items-center">
                      <Icon name="crown" size={10} color="#FF4D2E" />
                      <Text className="text-accent text-[9px] font-extrabold ml-1 tracking-wider uppercase">
                        {t('profile.proBadge')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-ink-subtle text-xs mt-0.5" numberOfLines={1}>
                  {handle}
                </Text>
                {memberSince ? (
                  <Text className="text-ink-muted text-[10px] mt-1">
                    {t('profile.memberSince', { when: memberSince })}
                  </Text>
                ) : null}
              </View>
              <Icon name="edit" size={16} color="#A1A1AA" />
            </View>

            {/* Bio */}
            {profile?.bio ? (
              <Text className="text-ink-subtle text-sm mt-3 leading-5" numberOfLines={2}>
                {profile.bio}
              </Text>
            ) : null}

            {/* Stat strip */}
            <View className="flex-row mt-4 pt-4 border-t border-border" style={{ gap: 8 }}>
              <Stat
                label={t('profile.stats.height')}
                value={profile?.height_cm ? `${Math.round(profile.height_cm)}` : '—'}
                unit={profile?.height_cm ? 'cm' : undefined}
              />
              <Stat
                label={t('profile.stats.weight')}
                value={
                  profile?.weight_kg ? formatWeight(profile.weight_kg, profile.weight_unit) : '—'
                }
                unit={profile?.weight_kg ? (profile.weight_unit ?? 'kg') : undefined}
              />
              <Stat
                label={t('profile.stats.goal')}
                value={profile?.goal ? t(`profile.goals.${profile.goal}`) : '—'}
              />
              <Stat
                label={t('profile.stats.level')}
                value={
                  profile?.experience_level ? t(`profile.level.${profile.experience_level}`) : '—'
                }
              />
            </View>
          </Card>
        </Pressable>

        {/* Premium banner */}
        <Pressable className="mb-6" onPress={() => router.push('/paywall')}>
          <View
            className="rounded-3xl border border-accent/40 p-5 overflow-hidden"
            style={{
              backgroundColor: 'rgba(255,77,46,0.08)',
              shadowColor: '#FF4D2E',
              shadowOpacity: 0.25,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-xl bg-accent items-center justify-center mr-3">
                <Icon name="crown" size={20} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-accent text-[10px] font-bold tracking-widest">
                  {isPremium ? t('profile.premiumLabel') : t('profile.goPremiumLabel')}
                </Text>
                <Text className="text-ink text-base font-extrabold mt-0.5">
                  {isPremium ? t('premium.paywall.active') : t('premium.upgrade')}
                </Text>
              </View>
              <Icon name="arrow-right" size={18} color="#FF4D2E" />
            </View>
          </View>
        </Pressable>

        {/* Language */}
        <Section title={t('profile.language')} icon="globe">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {SUPPORTED_LOCALES.map((l) => (
              <Chip
                key={l}
                label={LOCALE_LABELS[l]}
                active={i18n.language === l}
                onPress={() => setLocale(l)}
              />
            ))}
          </View>
        </Section>

        {/* Settings rows */}
        <Section title={t('profile.settings')} icon="zap">
          <Row
            icon="user"
            label={t('profile.edit.title')}
            onPress={() => router.push('/edit-profile')}
          />
          <Row
            icon="scale"
            label={t('profile.weightUnit')}
            value={profile?.weight_unit ?? 'kg'}
            onPress={() => router.push('/weight-unit')}
          />
          <Row
            icon="bell"
            label={t('profile.notifications.title')}
            onPress={() => router.push('/notifications')}
          />
          <Row
            icon="crown"
            label={t('profile.subscription')}
            value={isPremium ? t('premium.paywall.active') : undefined}
            onPress={() => router.push('/paywall')}
          />
          <Row
            icon="sparkles"
            label={t('profile.aiCoach')}
            onPress={() => router.push('/ai-coach')}
          />
          <Row
            icon="heart"
            label={t('wearables.profileRow')}
            onPress={() => router.push('/wearables')}
            isLast
          />
        </Section>

        {isAdmin ? (
          <Section title={t('profile.admin')} icon="shield">
            <Row
              icon="bar-chart"
              label={t('profile.adminAiCosts')}
              onPress={() => router.push('/admin-ai-costs')}
              isLast
            />
          </Section>
        ) : null}

        {/* Legal */}
        <Section title={t('profile.legal')} icon="shield">
          <Row
            icon="shield"
            label={t('profile.privacy')}
            onPress={() => Linking.openURL('https://sahha.app/privacy')}
            isLast
          />
        </Section>

        {/* Danger zone */}
        <Section title={t('profile.account')} icon="user">
          <Row icon="logout" label={t('profile.signOut')} onPress={() => signOut.mutate()} />
          <Row
            icon="trash"
            label={t('profile.deleteAccount')}
            onPress={() => router.push('/delete-account')}
            danger
            isLast
          />
        </Section>

        <View style={{ height: 100 }} />
      </View>
    </Screen>
  );
}

function formatWeight(weightKg: number, unit: 'kg' | 'lb' | null | undefined): string {
  if (unit === 'lb') return String(Math.round(weightKg * 2.20462));
  return String(Math.round(weightKg));
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: IconName;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-5">
      <View className="flex-row items-center mb-3">
        {icon ? <Icon name={icon} size={12} color="#A1A1AA" /> : null}
        <Text className="text-ink-muted text-[10px] font-bold uppercase tracking-widest ml-1.5">
          {title}
        </Text>
      </View>
      <View className="bg-bg-raised border border-border rounded-2xl overflow-hidden">
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  danger,
  isLast,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  isLast?: boolean;
}) {
  const labelColor = danger ? 'text-danger' : 'text-ink';
  const iconColor = danger ? '#F87171' : '#FF4D2E';
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-4 py-3.5 ${isLast ? '' : 'border-b border-border'}`}
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
      accessibilityRole="button"
    >
      <View className="w-8 h-8 rounded-lg bg-bg-subtle items-center justify-center mr-3">
        <Icon name={icon} size={14} color={iconColor} />
      </View>
      <Text className={`flex-1 text-base font-semibold ${labelColor}`}>{label}</Text>
      {value ? <Text className="text-ink-muted text-sm mr-2 font-medium">{value}</Text> : null}
      {!danger ? <Icon name="chevron-right" size={16} color="#A1A1AA" /> : null}
    </Pressable>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View className="flex-1 items-center bg-bg-subtle rounded-xl py-2 px-1">
      <Text className="text-ink-muted text-[9px] font-bold uppercase tracking-widest">{label}</Text>
      <View className="flex-row items-baseline mt-1">
        <Text className="text-ink text-sm font-extrabold" numberOfLines={1}>
          {value}
        </Text>
        {unit ? <Text className="text-ink-muted text-[9px] ml-0.5 font-medium">{unit}</Text> : null}
      </View>
    </View>
  );
}

function GuestProfile() {
  const { t } = useTranslation();
  const open = useAuthGateStore((s) => s.open);
  return (
    <Screen scroll glow padded={false}>
      <View className="flex-1 px-6 justify-center" style={{ minHeight: 480 }}>
        <View className="items-center">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-5"
            style={{
              backgroundColor: '#1B1B22',
              borderWidth: 1,
              borderColor: '#27272F',
            }}
          >
            <Icon name="user" size={32} color="#A1A1AA" strokeWidth={2} />
          </View>
          <Text className="text-ink text-3xl font-extrabold tracking-tight text-center mb-2">
            {t('profile.guestTitle', { defaultValue: 'Sign in to see your profile' })}
          </Text>
          <Text
            className="text-ink-subtle text-base text-center mb-8 px-4"
            style={{ lineHeight: 22 }}
          >
            {t('profile.guestSubtitle', {
              defaultValue:
                'Save your stats, sync across devices, and unlock personalized AI training plans.',
            })}
          </Text>
          <Pressable
            onPress={() =>
              open(
                t('profile.guestPrompt', {
                  defaultValue: 'Create an account to save your progress.',
                }),
              )
            }
            style={{
              alignSelf: 'stretch',
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FF4D2E',
            }}
          >
            <Text className="text-white text-base font-extrabold tracking-wide">
              {t('auth.gate.signUp', { defaultValue: 'Create an account' })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              open(
                t('profile.guestPrompt', {
                  defaultValue: 'Sign in to access your profile.',
                }),
              )
            }
            hitSlop={8}
            className="mt-4"
          >
            <Text className="text-accent text-sm font-bold">
              {t('auth.gate.signIn', { defaultValue: 'I already have an account' })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
