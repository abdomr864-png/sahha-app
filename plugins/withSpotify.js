/**
 * Expo config plugin — native settings required by `react-native-spotify-remote`
 * (the Spotify App Remote SDK) so EAS dev/production builds compile and can
 * detect + hand off to the installed Spotify app.
 *
 * What it adds:
 *
 *  iOS (Info.plist):
 *   - `LSApplicationQueriesSchemes` += `spotify`. Without it, iOS 9+ blocks
 *     `canOpenURL("spotify:")`, so the App Remote SDK can't detect Spotify and
 *     our "Open Spotify" deep-link fallback silently fails.
 *   - The OAuth redirect comes back on the app's existing `sahha://` scheme
 *     (registered by Expo from `expo.scheme`), so no extra CFBundleURLTypes
 *     entry is needed here.
 *
 *  Android (AndroidManifest.xml):
 *   - `<queries><package android:name="com.spotify.music" /></queries>` so
 *     Android 11+ package-visibility rules let us detect/launch Spotify and the
 *     App Remote SDK can bind to it.
 *
 * The Spotify client id / redirect URI themselves are supplied at runtime
 * (see features/spotify/config.ts) — nothing secret is baked into the binary.
 */
const { withInfoPlist, withAndroidManifest } = require('@expo/config-plugins');

const SPOTIFY_PACKAGE = 'com.spotify.music';
const SPOTIFY_QUERY_SCHEME = 'spotify';

const withSpotifyIos = (config) =>
  withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    const schemes = Array.isArray(plist.LSApplicationQueriesSchemes)
      ? plist.LSApplicationQueriesSchemes
      : [];
    if (!schemes.includes(SPOTIFY_QUERY_SCHEME)) {
      schemes.push(SPOTIFY_QUERY_SCHEME);
    }
    plist.LSApplicationQueriesSchemes = schemes;
    return cfg;
  });

const withSpotifyAndroid = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [];
    const alreadyQueried = manifest.queries.some((q) =>
      (q.package || []).some((p) => p.$ && p.$['android:name'] === SPOTIFY_PACKAGE),
    );
    if (!alreadyQueried) {
      manifest.queries.push({ package: [{ $: { 'android:name': SPOTIFY_PACKAGE } }] });
    }
    return cfg;
  });

module.exports = function withSpotify(config) {
  return withSpotifyAndroid(withSpotifyIos(config));
};
