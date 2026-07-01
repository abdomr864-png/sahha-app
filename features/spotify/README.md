# Spotify integration

In-app workout music: a persistent "now playing" mini-player on the active
workout screen, plus a one-time prompt to connect Spotify.

## Architecture

```
features/spotify/
  config.ts                  client id, scopes, endpoints, redirect path
  types.ts                   typed Web API responses + store/playback shapes
  store.ts                   useSpotifyStore (Zustand) + useCanControl()
  repositories/
    tokens.ts                SecureStore token persistence (secrets only)
    webApi.ts                typed Web API client (/me, /me/playlists)
  services/
    auth.ts                  OAuth 2.0 PKCE authorize + token refresh
    token-manager.ts         in-memory cache, single-flight silent refresh
    remote.ts                react-native-spotify-remote (App Remote) wrapper
    connection.ts            connect / bootstrap / disconnect orchestration
    openSpotify.ts           deep-link fallback into the Spotify app
  hooks/
    useSpotifyConnect.ts     connect/disconnect for prompt + settings
    useSpotifyPlayback.ts    live state, controls, lazy album art, teardown
    useSpotifyPlaylists.ts   TanStack Query for the library
  components/
    MiniPlayer.tsx           docked now-playing bar (active workout)
    SpotifyConnectPrompt.tsx one-time connect suggestion
    PlaylistPickerSheet.tsx  playlist chooser
    AlbumArt.tsx             art with branded placeholder
```

- **Auth** is Authorization Code + **PKCE** (`expo-auth-session`) — no client
  secret ships in the app. Tokens live in **expo-secure-store**; refresh is
  silent via `token-manager.getFreshAccessToken()`.
- **Playback control** uses the **App Remote SDK** (`react-native-spotify-remote`),
  which requires **Spotify Premium** and the Spotify app installed.
- **Premium detection**: on connect we read `GET /v1/me` → `product`. Premium
  gets working controls; Free / no-app degrades to a single **Open Spotify**
  deep-link (never broken control buttons).

## Spotify Developer Dashboard setup

1. Create an app at <https://developer.spotify.com/dashboard>.
2. **Redirect URI** — add this **exactly**:

   ```
   sahha://spotify-auth
   ```

   (It comes from `expo.scheme` = `sahha` + `SPOTIFY_REDIRECT_PATH`. Confirm at
   runtime with `getRedirectUri()` in `services/auth.ts`.)
3. **Bundle IDs / package** — under *Settings → iOS / Android*, register:
   - iOS bundle id: `com.sahha.app`
   - Android package: `com.sahha.app` (+ your signing SHA-1 fingerprint), as
     the App Remote SDK requires it.
4. **Scopes** requested by the app:
   - `user-read-private` (read `product` for Premium detection)
   - `user-read-playback-state`
   - `user-modify-playback-state`
   - `playlist-read-private`
   - `app-remote-control`, `streaming` (App Remote SDK)

## Environment

Set the public client id (no secret needed with PKCE):

```
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id
```

When unset, `isSpotifyConfigured()` is false: the prompt/player hide and the
settings screen shows an "not set up" notice.

## Native build

`react-native-spotify-remote` is a native module — build with **EAS dev or
production** (not Expo Go). The `./plugins/withSpotify` config plugin adds:

- iOS: `spotify` to `LSApplicationQueriesSchemes` (so `canOpenURL` / detection
  works). The OAuth redirect uses the existing `sahha://` scheme.
- Android: `<queries><package android:name="com.spotify.music" /></queries>`
  for Android 11+ package visibility.

After changing the plugin or env, run `npx expo prebuild --clean` and a fresh
EAS build.

## Failure handling

Every path degrades gracefully (no crashes): no Spotify app → Open-Spotify
fallback; token expired → silent refresh, else re-auth; auth denied → stays
disconnected; network loss → error state with retry; remote disconnect →
re-marks degraded. Teardown (disconnect/logout) unbinds the App Remote, removes
listeners, and clears stored tokens via `disconnectSpotify()`.
