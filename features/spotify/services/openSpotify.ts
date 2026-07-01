import { Linking } from 'react-native';
import { SPOTIFY_APP_URL, SPOTIFY_INSTALL_URL } from '../config';

/**
 * Deep-link into the native Spotify app, falling back to the web player when
 * the app isn't installed. Never throws — the worst case is a no-op.
 */
export async function openSpotifyApp(): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(SPOTIFY_APP_URL);
    await Linking.openURL(canOpen ? SPOTIFY_APP_URL : SPOTIFY_INSTALL_URL);
  } catch {
    try {
      await Linking.openURL(SPOTIFY_INSTALL_URL);
    } catch {
      /* nothing we can do */
    }
  }
}
