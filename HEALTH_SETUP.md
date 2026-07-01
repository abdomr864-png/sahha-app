# Health data setup (HealthKit + Health Connect)

The health-aggregation layer (`features/health/`) reads Apple HealthKit (iOS) and
Google Health Connect (Android) through `@lib/health-data`, mirrors normalized
samples into Supabase (`health_metrics`), and powers the Activity/Recovery
dashboard from the `health_daily` view. **It requires a dev/EAS build — it does
NOT run in Expo Go.**

## 1. Apply the database migration

```bash
npm run db:push          # applies supabase/migrations/0028_health_metrics.sql
npm run db:types         # regenerate lib/supabase/database.types.ts (removes the
                         # `as any` casts' need in features/health/*)
```

`0028` adds `health_metrics`, `health_sync_state`, RLS, indexes, and the
`health_daily` view. It supersedes `wearable_metrics` / `sleep_sessions_synced`
/ `workouts_synced` (left in place; drop in a later migration once verified).

## 2. Native config (already in `app.json`)

- **iOS:** HealthKit entitlement (`com.apple.developer.healthkit`),
  `NSHealthShareUsageDescription` + `NSHealthUpdateUsageDescription` (FR),
  HealthKit plugin with `background: true` (background delivery).
- **Android:** `health.READ_*` permissions including
  `READ_HEALTH_DATA_IN_BACKGROUND` (Android 14+) and `READ_DISTANCE`, plus the
  `react-native-health-connect` plugin (adds the permission-rationale activity +
  `ViewPermissionUsage` intent filter).

### minSdkVersion (Android)

Health Connect needs **minSdk 26**. If your build's minSdk is lower, add
`expo-build-properties`:

```bash
npx expo install expo-build-properties
```

```jsonc
// app.json → plugins
["expo-build-properties", { "android": { "minSdkVersion": 26 } }]
```

## 3. Privacy policy (required by Apple AND Google)

Both stores require a privacy-policy URL for health-data access/review. Replace
the placeholder in `features/health/types.ts`:

```ts
export const HEALTH_PRIVACY_POLICY_URL = 'https://sahha.app/privacy'; // PLACEHOLDER
```

For Android, also link this policy in the Play Console Health Connect
declaration form.

## 4. Rebuild

```bash
npx expo prebuild --clean
eas build --profile development --platform ios
eas build --profile development --platform android
```

A native rebuild is required whenever `app.json` permissions/plugins change.

## 5. Making Sahha appear inside Health Connect (Android)

For Sahha to be **detectable and listed** in the Health Connect app (Health
Connect → App permissions), the manifest needs three things — all injected by
`plugins/withHealthConnect.js` + the `react-native-health-connect` plugin:

1. `<queries>` for `com.google.android.apps.healthdata` — lets Sahha detect /
   launch Health Connect (`getSdkStatus`) under Android 11+ package visibility.
2. `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` on MainActivity — the
   rationale link on **Android ≤13** (Health Connect as a Play Store app).
3. A `ViewPermissionUsageActivity` alias handling
   `android.intent.action.VIEW_PERMISSION_USAGE` +
   `android.intent.category.HEALTH_PERMISSIONS` — the rationale surface on
   **Android 14+** (Health Connect built into Settings).

Verify after a config change with:

```bash
npx expo config --type introspect | grep -iE "healthdata|VIEW_PERMISSION_USAGE|RATIONALE"
```

**It appears in the list after the app requests permissions once.** The
onboarding flow (`HealthPermissionFlow`) calls `requestPermissions()`, which
opens the Health Connect consent sheet; from then on Sahha is listed under App
permissions, where the user can connect/disconnect it. Tapping Sahha there opens
the rationale screen, which links to `HEALTH_PRIVACY_POLICY_URL` — so a real
privacy-policy URL is required before release.

## 6. Background read permission (Android 14+)

`READ_HEALTH_DATA_IN_BACKGROUND` is a runtime permission. It's requested
alongside the others via the permission flow; users may need to grant
"all the time" access in the Health Connect app for background sync to run.

## Incremental sync note

`HealthService.readChanges` currently uses a **time cursor** persisted in
`health_sync_state.last_synced_at` (read `[cursor − 6h, now]`, dedup by
`external_id`). The `sync_token` column + `readChanges` are the slot for a true
`HKAnchoredObjectQuery` anchor (iOS) / Health Connect `getChanges` token — wiring
those requires extending the `@lib/health-data` providers with anchor/changes
APIs and can only be verified on a device build.

## Optional write-back

Disabled by default. To enable Sahha → HealthKit/Health Connect writes, uncomment
the write-back block at the bottom of the original spec and implement
`writeWorkout` / `writeWeight` (tag Sahha-authored samples in `metadata` so they
aren't re-imported and create a sync loop).
