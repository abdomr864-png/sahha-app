import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@features/shared';
import type { Entitlement } from '../types';

interface Props {
  /** Why the user is gated — drives the headline copy. */
  reason?: Entitlement['reason'];
  /** Feature-specific upsell line (e.g. "Upgrade to log unlimited meals"). */
  hint?: string;
  className?: string;
}

/**
 * Inline "you're gated → see the plans" card. Renders a crowned headline, an
 * optional feature-specific hint, and an Upgrade button that opens the paywall.
 * Use this anywhere a free user hits a limit or a premium-only wall so every
 * dead-end routes to the same place.
 */
export function UpgradeCallout({ reason, hint, className }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const title = reason === 'premium_only' ? t('premium.required') : t('premium.limitReached');

  return (
    <View className={`bg-bg-raised border border-border rounded-2xl p-4 mb-4 ${className ?? ''}`}>
      <View className="flex-row items-center mb-1">
        <Icon name="crown" size={16} color="#F5C451" />
        <Text className="text-ink font-bold ml-2 flex-1">{title}</Text>
      </View>
      {hint ? <Text className="text-ink-subtle text-sm mb-3">{hint}</Text> : null}
      <Button
        label={t('premium.upgrade')}
        icon="sparkles"
        onPress={() => router.push('/paywall')}
      />
    </View>
  );
}
