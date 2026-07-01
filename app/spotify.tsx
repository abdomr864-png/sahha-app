import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Header, Icon, Screen, useSafeBack } from '@features/shared';
import { useSpotifyConnect, openSpotifyApp } from '@features/spotify';

const SPOTIFY_GREEN = '#1DB954';

/**
 * Spotify connection settings: connect / disconnect, account + plan status,
 * and the Premium requirement explainer. Reached from Profile → Wellness.
 */
export default function SpotifySettings() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const {
    status,
    product,
    account,
    degradeReason,
    busy,
    isConnected,
    isConfigured,
    connect,
    disconnect,
  } = useSpotifyConnect();

  return (
    <Screen scroll glow padded={false}>
      <Header title={t('spotify.settings.title')} onBack={safeBack} />
      <View className="px-5 pt-2" style={{ gap: 14 }}>
        {/* Status */}
        <Card>
          <View className="flex-row items-center">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center me-3"
              style={{ backgroundColor: 'rgba(29,185,84,0.15)' }}
            >
              <Icon name="spotify" size={26} color={SPOTIFY_GREEN} />
            </View>
            <View className="flex-1">
              <Text className="text-ink font-bold text-base">
                {isConnected
                  ? (account?.displayName ?? t('spotify.settings.connected'))
                  : t('spotify.settings.notConnected')}
              </Text>
              {isConnected ? (
                <View className="flex-row items-center mt-1">
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        product === 'premium' ? 'rgba(29,185,84,0.18)' : 'rgba(180,180,194,0.15)',
                    }}
                  >
                    <Text
                      className="text-[10px] font-extrabold uppercase tracking-wider"
                      style={{ color: product === 'premium' ? SPOTIFY_GREEN : '#B4B4C2' }}
                    >
                      {product === 'premium'
                        ? t('spotify.settings.premium')
                        : t('spotify.settings.free')}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text className="text-ink-subtle text-xs mt-0.5">
                  {t('spotify.settings.subtitle')}
                </Text>
              )}
            </View>
          </View>

          {/* Premium requirement explainer when controls are degraded */}
          {isConnected && product !== 'premium' ? (
            <View className="mt-4 pt-4 border-t border-border flex-row items-start">
              <Icon name="alert" size={16} color="#F5C451" />
              <Text className="text-ink-subtle text-xs ms-2 flex-1" style={{ lineHeight: 18 }}>
                {t('spotify.free.controlsPremium')}
              </Text>
            </View>
          ) : null}
          {isConnected && degradeReason === 'app_not_installed' ? (
            <View className="mt-4 pt-4 border-t border-border flex-row items-start">
              <Icon name="alert" size={16} color="#F5C451" />
              <Text className="text-ink-subtle text-xs ms-2 flex-1" style={{ lineHeight: 18 }}>
                {t('spotify.noApp.message')}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Primary action */}
        {!isConfigured ? (
          <Card tone="outline">
            <Text className="text-ink-subtle text-sm">{t('spotify.settings.unconfigured')}</Text>
          </Card>
        ) : !isConnected ? (
          <Pressable
            onPress={connect}
            disabled={busy}
            accessibilityRole="button"
            className="flex-row items-center justify-center py-4 rounded-2xl"
            style={{ backgroundColor: SPOTIFY_GREEN, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="#0A0A0F" />
            ) : (
              <>
                <Icon name="spotify" size={20} color="#0A0A0F" />
                <Text className="text-[#0A0A0F] font-extrabold text-base ms-2">
                  {t('spotify.settings.connect')}
                </Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            {(product !== 'premium' || degradeReason === 'app_not_installed') &&
            status === 'connected' ? (
              <Pressable
                onPress={openSpotifyApp}
                accessibilityRole="button"
                className="flex-row items-center justify-center py-4 rounded-2xl"
                style={{ backgroundColor: SPOTIFY_GREEN }}
              >
                <Icon name="spotify" size={20} color="#0A0A0F" />
                <Text className="text-[#0A0A0F] font-extrabold text-base ms-2">
                  {t('spotify.openSpotify')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={disconnect}
              disabled={busy}
              accessibilityRole="button"
              className="flex-row items-center justify-center py-4 rounded-2xl bg-bg-raised border border-danger/40"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              {busy ? (
                <ActivityIndicator color="#FF4D6D" />
              ) : (
                <>
                  <Icon name="logout" size={18} color="#FF4D6D" />
                  <Text className="text-danger font-extrabold text-base ms-2">
                    {t('spotify.settings.disconnect')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        <Text className="text-ink-muted text-xs px-1" style={{ lineHeight: 18 }}>
          {t('spotify.settings.privacy')}
        </Text>
      </View>
    </Screen>
  );
}
