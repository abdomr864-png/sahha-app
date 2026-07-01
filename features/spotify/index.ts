// Public surface of the Spotify feature. Screens/components import from here.
export { MiniPlayer } from './components/MiniPlayer';
export { SpotifyConnectPrompt } from './components/SpotifyConnectPrompt';
export { PlaylistPickerSheet } from './components/PlaylistPickerSheet';

export { useSpotifyConnect } from './hooks/useSpotifyConnect';
export { useSpotifyPlayback } from './hooks/useSpotifyPlayback';
export { useSpotifyPlaylists } from './hooks/useSpotifyPlaylists';

export { useSpotifyStore, useCanControl } from './store';
export { isSpotifyConfigured } from './services/connection';
export { openSpotifyApp } from './services/openSpotify';

export type {
  SpotifyConnectionStatus,
  SpotifyDegradeReason,
  SpotifyProduct,
  SpotifyPlaylist,
  PlaybackState,
  NowPlayingTrack,
} from './types';
