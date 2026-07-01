import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@features/shared';
import { useSpotifyStore } from '../store';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { openSpotifyApp } from '../services/openSpotify';
import { AlbumArt } from './AlbumArt';
import { PlaylistPickerSheet } from './PlaylistPickerSheet';

const SPOTIFY_GREEN = '#1DB954';

/**
 * Compact "now playing" bar that docks above the active-workout footer.
 *
 *  - Premium + App Remote bound → full controls (prev / play-pause / next +
 *    playlist picker), or a "choose a playlist" CTA when nothing is playing.
 *  - Free account / Spotify app missing → a single "Open Spotify" deep-link
 *    with a short explanation. No broken control buttons are ever shown.
 *  - Not connected → renders nothing (the connect prompt handles that state).
 */
export function MiniPlayer() {
  const { t } = useTranslation();
  const status = useSpotifyStore((s) => s.status);
  const degradeReason = useSpotifyStore((s) => s.degradeReason);
  const { playback, canControl, togglePlay, next, previous, play } = useSpotifyPlayback();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (status !== 'connected') return null;

  const track = playback?.track ?? null;
  const isPaused = playback?.isPaused ?? true;

  return (
    <View className="mx-5 mb-2 rounded-2xl bg-bg-raised border border-border overflow-hidden">
      <View className="flex-row items-center px-3 py-2.5">
        {canControl ? (
          track ? (
            <FullControls
              artUri={track.imageUri}
              name={track.name}
              artist={track.artist}
              isPaused={isPaused}
              onToggle={togglePlay}
              onNext={next}
              onPrev={previous}
              onPick={() => setPickerOpen(true)}
              pickLabel={t('spotify.player.openLibrary')}
            />
          ) : (
            <EmptyState
              message={t('spotify.player.nothingPlaying')}
              cta={t('spotify.player.choosePlaylist')}
              onCta={() => setPickerOpen(true)}
            />
          )
        ) : (
          <Fallback
            message={
              degradeReason === 'free_account'
                ? t('spotify.free.controlsPremium')
                : t('spotify.noApp.message')
            }
            cta={t('spotify.openSpotify')}
            onCta={openSpotifyApp}
          />
        )}
      </View>

      <PlaylistPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPlay={play}
      />
    </View>
  );
}

function FullControls({
  artUri,
  name,
  artist,
  isPaused,
  onToggle,
  onNext,
  onPrev,
  onPick,
  pickLabel,
}: {
  artUri: string | null;
  name: string;
  artist: string;
  isPaused: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onPick: () => void;
  pickLabel: string;
}) {
  return (
    <>
      <AlbumArt uri={artUri} size={44} />
      <View className="flex-1 ms-3 me-2">
        <Text className="text-ink font-bold text-sm" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-ink-muted text-xs mt-0.5" numberOfLines={1}>
          {artist}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 4 }}>
        <ControlButton icon="skip-back" onPress={onPrev} accessibilityLabel="Previous" />
        <Pressable
          onPress={onToggle}
          hitSlop={6}
          accessibilityRole="button"
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: SPOTIFY_GREEN }}
        >
          <Icon name={isPaused ? 'play' : 'pause'} size={18} color="#0A0A0F" />
        </Pressable>
        <ControlButton icon="skip-forward" onPress={onNext} accessibilityLabel="Next" />
        <ControlButton icon="music" onPress={onPick} accessibilityLabel={pickLabel} />
      </View>
    </>
  );
}

function ControlButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: 'skip-back' | 'skip-forward' | 'music';
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="w-9 h-9 items-center justify-center rounded-full"
    >
      <Icon name={icon} size={18} color="#F4F4F7" />
    </Pressable>
  );
}

function EmptyState({ message, cta, onCta }: { message: string; cta: string; onCta: () => void }) {
  return (
    <>
      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: 'rgba(29,185,84,0.15)' }}
      >
        <Icon name="spotify" size={20} color={SPOTIFY_GREEN} />
      </View>
      <Text className="flex-1 text-ink-subtle text-sm ms-3 me-2" numberOfLines={1}>
        {message}
      </Text>
      <Pressable onPress={onCta} hitSlop={6} accessibilityRole="button">
        <Text className="font-bold text-sm" style={{ color: SPOTIFY_GREEN }}>
          {cta}
        </Text>
      </Pressable>
    </>
  );
}

function Fallback({ message, cta, onCta }: { message: string; cta: string; onCta: () => void }) {
  return (
    <>
      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: 'rgba(29,185,84,0.15)' }}
      >
        <Icon name="spotify" size={20} color={SPOTIFY_GREEN} />
      </View>
      <Text className="flex-1 text-ink-subtle text-xs ms-3 me-2" numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        onPress={onCta}
        hitSlop={6}
        accessibilityRole="button"
        className="flex-row items-center px-3 py-2 rounded-full"
        style={{ backgroundColor: SPOTIFY_GREEN }}
      >
        <Icon name="spotify" size={14} color="#0A0A0F" />
        <Text className="text-[#0A0A0F] font-bold text-xs ms-1.5">{cta}</Text>
      </Pressable>
    </>
  );
}
