import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@features/shared';
import { useSpotifyPlaylists } from '../hooks/useSpotifyPlaylists';
import type { SpotifyPlaylist } from '../types';
import { AlbumArt } from './AlbumArt';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Returns true on success; the sheet closes only when playback started. */
  onPlay: (uri: string) => Promise<boolean>;
}

/**
 * Bottom-sheet list of the user's playlists. Tapping one starts playback via
 * the App Remote and dismisses. Errors/empty/loading are all handled inline.
 */
export function PlaylistPickerSheet({ visible, onClose, onPlay }: Props) {
  const { t } = useTranslation();
  const playlistsQ = useSpotifyPlaylists();

  const onSelect = async (uri: string) => {
    const ok = await onPlay(uri);
    if (ok) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onPress={onClose}
      >
        <Pressable
          className="bg-bg-raised border-t border-border rounded-t-3xl px-5 pt-4 pb-8"
          style={{ maxHeight: '75%' }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center mb-3">
            <View className="w-10 h-1 rounded-full bg-border-strong" />
          </View>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-ink text-xl font-display tracking-tight">
              {t('spotify.picker.title')}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={22} color="#B4B4C2" />
            </Pressable>
          </View>

          {playlistsQ.isPending ? (
            <View className="py-12 items-center">
              <ActivityIndicator color="#1DB954" />
            </View>
          ) : playlistsQ.isError ? (
            <View className="py-12 items-center">
              <Text className="text-ink-subtle text-sm">{t('spotify.picker.error')}</Text>
              <Pressable onPress={() => playlistsQ.refetch()} className="mt-3">
                <Text className="text-accent font-bold">{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : (playlistsQ.data?.length ?? 0) === 0 ? (
            <View className="py-12 items-center">
              <Text className="text-ink-subtle text-sm">{t('spotify.picker.empty')}</Text>
            </View>
          ) : (
            <FlatList<SpotifyPlaylist>
              data={playlistsQ.data}
              keyExtractor={(p) => p.id}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View className="h-2" />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect(item.uri)}
                  className="flex-row items-center py-1.5"
                  style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
                  accessibilityRole="button"
                >
                  <AlbumArt uri={item.images[0]?.url ?? null} size={48} />
                  <View className="flex-1 ms-3">
                    <Text className="text-ink font-bold text-sm" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="text-ink-muted text-xs mt-0.5" numberOfLines={1}>
                      {t('spotify.picker.trackCount', { count: item.tracks.total })}
                    </Text>
                  </View>
                  <Icon name="play" size={18} color="#1DB954" />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
