import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useEntitlement } from '../hooks/useEntitlement';
import type { Feature } from '../types';

interface Props {
  feature: Feature;
  children: ReactNode;
  onUpgrade?: () => void;
  fallback?: ReactNode;
}

/**
 * Wraps children in an entitlement check. While loading we render the
 * children optimistically (the server will reject the actual mutation if
 * needed); once we know the user is gated we swap in the upgrade prompt.
 */
export function EntitlementGate({ feature, children, onUpgrade, fallback }: Props) {
  const { data, isPending } = useEntitlement(feature);
  const { t } = useTranslation();

  if (isPending || !data || data.allowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  const message =
    data.reason === 'premium_only' ? t('premium.premiumOnly') : t('premium.limitReached');

  return (
    <View className="bg-bg-raised rounded-2xl p-5 border border-bg-subtle">
      <Text className="text-ink text-base font-semibold mb-1">{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onUpgrade}
        className="bg-accent rounded-xl px-4 py-3 mt-3"
      >
        <Text className="text-ink text-center font-semibold">{t('premium.upgrade')}</Text>
      </Pressable>
    </View>
  );
}
