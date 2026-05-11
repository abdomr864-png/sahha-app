# Auth Setup — Apple + Google Sign-In

Steps the maintainer must perform manually outside the codebase. Each provider has a one-time external configuration cost that no migration can automate.

> Bundle/package ID used everywhere below: `com.sahha.app` (matches `app.json`). If you change it, update both platforms and every OAuth client.

---

## 1. Google Sign-In

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID**. Create three clients, all under the same Cloud project.

### 1a. iOS OAuth client

| Field | Value |
|---|---|
| Application type | iOS |
| Name | `Sahha iOS` |
| Bundle ID | `com.sahha.app` |

Copy the **iOS client ID** → paste into `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

Also note the **iOS URL scheme** Google gives you (it looks like `com.googleusercontent.apps.123-abc`). Add it to `app.json` under `ios.infoPlist.CFBundleURLTypes` (already wired — see below).

### 1b. Android OAuth client

| Field | Value |
|---|---|
| Application type | Android |
| Name | `Sahha Android` |
| Package name | `com.sahha.app` |
| SHA-1 | from your EAS Android keystore |

To get the SHA-1 of the EAS keystore:
```bash
eas credentials -p android
# choose: production keystore → download → keytool -list
```
Or for the dev keystore:
```bash
eas credentials -p android --profile development
```

Copy the **Android client ID** → paste into `.env` as `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

### 1c. Web OAuth client

This is the **audience** Supabase expects in the ID token.

| Field | Value |
|---|---|
| Application type | Web application |
| Name | `Sahha Web (Supabase audience)` |
| Authorized redirect URIs | `https://<your-project-ref>.supabase.co/auth/v1/callback` |

Copy the **Web client ID** → paste into `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

### 1d. Supabase dashboard → Auth → Providers → Google

- **Enable** the provider.
- **Client ID (for OAuth)**: paste the **Web client ID**.
- **Client Secret (for OAuth)**: paste the **Web client secret**.
- **Authorized Client IDs (comma separated)**: paste **Web + iOS + Android** client IDs.

(Authorized Client IDs is what `signInWithIdToken` validates against. Web client secret is only needed if you plan to also support the OAuth-redirect web flow; safe to fill in regardless.)

---

## 2. Apple Sign-In

You need the developer.apple.com side configured **before** Supabase will accept Apple tokens.

### 2a. App ID

developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers** → App IDs → `com.sahha.app`.

Enable capabilities:
- **Sign in with Apple**
- **HealthKit**

Save.

### 2b. Services ID (the OAuth client)

Identifiers → click **+** → **Services IDs** → continue.

| Field | Value |
|---|---|
| Description | `Sahha Sign In` |
| Identifier | `com.sahha.app.signin` |

After creating, click into it → **Configure** Sign in with Apple:
- Primary App ID: `com.sahha.app`
- Domains and Subdomains: `<your-project-ref>.supabase.co`
- Return URLs: `https://<your-project-ref>.supabase.co/auth/v1/callback`

Save.

### 2c. Sign in with Apple Key

Keys → **+** → enable **Sign in with Apple** → configure to your primary App ID → register.

- Note the **Key ID** (10 characters).
- **Download the `.p8` file ONCE** (Apple won't let you re-download it).

### 2d. Supabase dashboard → Auth → Providers → Apple

- **Enable** the provider.
- **Services ID**: `com.sahha.app.signin`
- **Team ID**: 10-char value at the top right of developer.apple.com.
- **Key ID**: from step 2c.
- **Secret Key (for OAuth)**: paste the **contents of the `.p8` file** (full text, including `-----BEGIN PRIVATE KEY-----`).

### 2e. Supabase → Auth → URL Configuration

- **Site URL**: keep your existing value.
- **Additional Redirect URLs**: ensure `sahha://` is in the list.

---

## 3. `.env` summary

Add to `.env` and `.env.example`:

```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
```

There is no Apple-specific env var — `expo-apple-authentication` is configured by the App ID itself.

---

## 4. Build requirements

- Apple Sign-In and HealthKit do **not** run in Expo Go. Use a development build:
  ```bash
  eas build --profile development --platform ios
  ```
- Google Sign-In also requires a dev build on iOS (it links a native SDK).
- On Android, both work in a development build.
- After updating `app.json` plugins or entitlements, **re-run `eas build`** — JS-only OTA updates won't pick up native changes.

---

## 5. Verifying

After both providers are configured:

1. Launch the dev build on a real iPhone.
2. Sign-in screen → **Continue with Apple** → OS prompt → success.
3. Supabase dashboard → Authentication → Users → confirm a row with provider `apple`.
4. Sign out, then **Continue with Google** → OS prompt → success.
5. Confirm a second row with provider `google`.
6. Repeat on Android (Google only).
