/**
 * Expo config plugin — makes Sahha discoverable + connectable inside the
 * Health Connect app on Android.
 *
 * The bundled `react-native-health-connect` plugin only adds the Android 13
 * rationale intent-filter (`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`)
 * to MainActivity. This plugin adds the two pieces it doesn't:
 *
 *  1. <queries> for the Health Connect package, so the app can detect/launch it
 *     and `getSdkStatus()` works (Android 11+ package-visibility rules).
 *  2. The Android 14+ rationale surface: an <activity-alias> handling
 *     `android.intent.action.VIEW_PERMISSION_USAGE` with the
 *     `android.intent.category.HEALTH_PERMISSIONS` category. Without it, on
 *     Android 14 (where Health Connect is built into Settings) Sahha won't show
 *     its "why we need your data" screen and Play review rejects the listing.
 *
 * After this + a one-time permission request, Sahha appears under Health
 * Connect → App permissions, where the user can connect/disconnect it.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const HC_PACKAGE = 'com.google.android.apps.healthdata';
const ALIAS_NAME = 'ViewPermissionUsageActivity';

module.exports = function withHealthConnect(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application && manifest.application[0];
    if (!app) return cfg;

    // 1) <queries><package android:name="com.google.android.apps.healthdata" />
    manifest.queries = manifest.queries || [];
    const alreadyQueried = manifest.queries.some((q) =>
      (q.package || []).some((p) => p.$ && p.$['android:name'] === HC_PACKAGE),
    );
    if (!alreadyQueried) {
      manifest.queries.push({ package: [{ $: { 'android:name': HC_PACKAGE } }] });
    }

    // 2) Android 14+ permission-usage rationale activity-alias → MainActivity.
    app['activity-alias'] = app['activity-alias'] || [];
    const aliasExists = app['activity-alias'].some(
      (a) => a.$ && a.$['android:name'] === ALIAS_NAME,
    );
    if (!aliasExists) {
      app['activity-alias'].push({
        $: {
          'android:name': ALIAS_NAME,
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
    }

    return cfg;
  });
};
