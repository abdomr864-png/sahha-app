import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
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

  // Accordion: one settings section open at a time (Account by default).
  const [openSection, setOpenSection] = useState<string | null>('account');
  const toggleSection = (id: string) => setOpenSection((cur) => (cur === id ? null : id));

  return (
    <Screen scroll glow padded={false}>
      <View className="px-5 pt-2">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text
              className="text-ink-muted text-[10px] font-bold uppercase mb-1"
              style={{ letterSpacing: 1.4 }}
            >
              {t('profile.kicker', { defaultValue: 'Profile' })}
            </Text>
            <Text className="text-ink text-3xl font-display tracking-tight">
              {t('profile.title')}
            </Text>
          </View>
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
              <Icon name="edit" size={16} color="#B4B4C2" />
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

        {/* Premium banner — gold (Sahha design) */}
        <Pressable className="mb-6" onPress={() => router.push('/paywall')}>
          <View
            className="rounded-3xl p-5 overflow-hidden"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(245,196,81,0.35)',
              backgroundColor: '#161210',
              shadowColor: '#F5C451',
              shadowOpacity: 0.2,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-xl items-center justify-center mr-3 overflow-hidden">
                <LinearGradient
                  colors={
                    ['#F5C451', '#FF8A2B'] as unknown as readonly [string, string, ...string[]]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <Icon name="crown" size={20} color="#1A1410" />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[10px] font-extrabold tracking-widest"
                  style={{ color: '#F5C451' }}
                >
                  {isPremium ? t('profile.premiumLabel') : t('profile.goPremiumLabel')}
                </Text>
                <Text className="text-ink text-base font-extrabold mt-0.5">
                  {isPremium ? t('premium.paywall.active') : t('premium.upgrade')}
                </Text>
              </View>
              <Icon name="arrow-right" size={18} color="#F5C451" />
            </View>
          </View>
        </Pressable>

        {/* Collapsible settings (Sahha design) */}
        <CollapsibleSection
          id="account"
          title={t('profile.account')}
          icon="user"
          open={openSection === 'account'}
          onToggle={() => toggleSection('account')}
        >
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
            isLast
          />
        </CollapsibleSection>

        <CollapsibleSection
          id="wellness"
          title={t('profile.wellness', { defaultValue: 'Wellness' })}
          icon="heart"
          open={openSection === 'wellness'}
          onToggle={() => toggleSection('wellness')}
        >
          <Row
            icon="heart"
            label={t('wearables.profileRow')}
            onPress={() => router.push('/wearables')}
          />
          <Row
            icon="music"
            label={t('spotify.profileRow')}
            onPress={() => router.push('/spotify')}
          />
          <Row
            icon="bell"
            label={t('profile.notifications.title')}
            onPress={() => router.push('/notifications')}
            isLast
          />
        </CollapsibleSection>

        <CollapsibleSection
          id="ai"
          title={t('profile.aiPremium', { defaultValue: 'AI & Premium' })}
          icon="sparkles"
          open={openSection === 'ai'}
          onToggle={() => toggleSection('ai')}
        >
          <Row
            icon="sparkles"
            label={t('profile.aiCoach')}
            onPress={() => router.push('/ai-coach')}
          />
          <Row
            icon="crown"
            label={t('profile.subscription')}
            value={isPremium ? t('premium.paywall.active') : undefined}
            onPress={() => router.push('/paywall')}
            isLast
          />
        </CollapsibleSection>

        <CollapsibleSection
          id="general"
          title={t('profile.general', { defaultValue: 'General' })}
          icon="globe"
          open={openSection === 'general'}
          onToggle={() => toggleSection('general')}
        >
          <View className="px-4 py-3">
            <Text className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mb-2.5">
              {t('profile.language')}
            </Text>
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
          </View>
          <Row
            icon="shield"
            label={t('profile.privacy')}
            onPress={() => Linking.openURL('https://sahha.app/privacy')}
            isLast
          />
        </CollapsibleSection>

        {isAdmin ? (
          <CollapsibleSection
            id="admin"
            title={t('profile.admin')}
            icon="shield"
            open={openSection === 'admin'}
            onToggle={() => toggleSection('admin')}
          >
            <Row
              icon="bar-chart"
              label={t('profile.adminAiCosts')}
              onPress={() => router.push('/admin-ai-costs')}
              isLast
            />
          </CollapsibleSection>
        ) : null}

        {/* Sign out + delete */}
        <Pressable
          onPress={() => signOut.mutate()}
          className="flex-row items-center justify-center mt-2 mb-3 py-4 rounded-2xl bg-bg-raised border border-border"
        >
          <Icon name="logout" size={18} color="#FF4D6D" />
          <Text className="text-danger text-base font-extrabold ml-2">{t('profile.signOut')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/delete-account')}
          className="items-center py-2"
          hitSlop={8}
        >
          <Text className="text-ink-muted text-xs font-semibold">{t('profile.deleteAccount')}</Text>
        </Pressable>

        <View style={{ height: 100 }} />
      </View>
    </Screen>
  );
}

function formatWeight(weightKg: number, unit: 'kg' | 'lb' | null | undefined): string {
  if (unit === 'lb') return String(Math.round(weightKg * 2.20462));
  return String(Math.round(weightKg));
}

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: IconName;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-bg-raised border border-border rounded-2xl overflow-hidden mb-3">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center px-4 py-4"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View className="w-9 h-9 rounded-xl bg-bg-elevated items-center justify-center mr-3">
          <Icon name={icon} size={18} color="#B4B4C2" />
        </View>
        <Text className="flex-1 text-ink text-base font-semibold">{title}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevron-down" size={18} color="#74748A" />
        </View>
      </Pressable>
      {open ? <View className="border-t border-border">{children}</View> : null}
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
  const iconColor = danger ? '#FF4D6D' : '#FF4D2E';
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
      {!danger ? <Icon name="chevron-right" size={16} color="#B4B4C2" /> : null}
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
              borderColor: '#21212B',
            }}
          >
            <Icon name="user" size={32} color="#B4B4C2" strokeWidth={2} />
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
