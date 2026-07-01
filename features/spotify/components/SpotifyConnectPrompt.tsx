import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@features/shared';
import { useSpotifyStore } from '../store';
import { useSpotifyConnect } from '../hooks/useSpotifyConnect';

const SPOTIFY_GREEN = '#1DB954';

/**
 * One-time suggestion to connect Spotify, shown above the active workout. It
 * renders only while disconnected, configured, and not yet dismissed — once
 * the user connects or dismisses, `promptDismissed` is persisted and it never
 * reappears. Non-blocking by design.
 */
export function SpotifyConnectPrompt() {
  const { t } = useTranslation();
  const promptDismissed = useSpotifyStore((s) => s.promptDismissed);
  const dismissPrompt = useSpotifyStore((s) => s.dismissPrompt);
  const { status, isConfigured, busy, connect } = useSpotifyConnect();

  if (!isConfigured || promptDismissed || status === 'connected' || status === 'connecting') {
    return null;
  }

  return (
    <View
      className="mx-5 mb-2 rounded-2xl px-4 py-3 flex-row items-center"
      style={{ backgroundColor: '#10231A', borderWidth: 1, borderColor: 'rgba(29,185,84,0.35)' }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center me-3"
        style={{ backgroundColor: 'rgba(29,185,84,0.15)' }}
      >
        <Icon name="spotify" size={22} color={SPOTIFY_GREEN} />
      </View>
      <View className="flex-1 me-2">
        <Text className="text-ink font-bold text-sm">{t('spotify.prompt.title')}</Text>
        <Text className="text-ink-subtle text-xs mt-0.5" numberOfLines={2}>
          {t('spotify.prompt.subtitle')}
        </Text>
      </View>
      <View className="items-end" style={{ gap: 6 }}>
        <Pressable
          onPress={connect}
          disabled={busy}
          accessibilityRole="button"
          className="flex-row items-center px-3 py-2 rounded-full"
          style={{ backgroundColor: SPOTIFY_GREEN, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#0A0A0F" />
          ) : (
            <Text className="text-[#0A0A0F] font-bold text-xs">{t('spotify.prompt.connect')}</Text>
          )}
        </Pressable>
        <Pressable onPress={dismissPrompt} hitSlop={8} accessibilityRole="button">
          <Text className="text-ink-muted text-[11px] font-semibold">{t('common.skip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
