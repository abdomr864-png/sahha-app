/**
 * Expo config plugin — compiles + embeds the Sahha watchOS companion app into
 * the EAS-built iPhone app.
 *
 * What it does on `expo prebuild` / EAS:
 *   1. Copies the native watch sources from `watch/` into
 *      `ios/<WATCH_TARGET>/` (idempotent; overwrites so edits propagate).
 *   2. Adds a watchOS application target to the Xcode project with the right
 *      build settings (SDK, deployment target, bundle id, Info.plist,
 *      entitlements, Swift version).
 *   3. Wires the Sources/Frameworks/Resources build phases (HealthKit +
 *      WatchConnectivity), makes the phone app depend on the watch app, and adds
 *      the "Embed Watch Content" copy-files phase so the watch app ships inside
 *      the iPhone app.
 *
 * IMPORTANT: programmatic pbxproj mutation for a watch target is intricate and
 * Xcode versions drift. This plugin gets you a building target in the common
 * case, but ALWAYS open `ios/*.xcworkspace` once after the first prebuild and
 * confirm the target, signing, and the Embed Watch Content phase — see
 * docs/apple-watch.md. The plugin is written to be safe to re-run (it no-ops if
 * the target already exists).
 *
 * The phone-side HealthKit + WatchConnectivity entitlements come from app.json
 * (`ios.entitlements`), so they are not duplicated here.
 */
const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WATCH_TARGET = 'SahhaWatch';
const PHONE_BUNDLE_ID = 'com.sahha.app';
const WATCH_BUNDLE_ID = `${PHONE_BUNDLE_ID}.watchkitapp`;
const WATCHOS_DEPLOYMENT_TARGET = '9.0';
const SWIFT_VERSION = '5.0';

// Source files relative to the repo `watch/` dir, in compile order.
const SWIFT_SOURCES = [
  'Models.swift',
  'WatchConnectivityManager.swift',
  'WorkoutManager.swift',
  'SahhaWatchApp.swift',
  'Views/StartView.swift',
  'Views/ActiveWorkoutView.swift',
  'Views/SetLoggerView.swift',
];
const RESOURCE_FILES = ['Info.plist', 'Sahha Watch.entitlements'];

// ── 1. Copy the watch sources into the iOS project ─────────────────────────

const withWatchSources = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const src = path.join(projectRoot, 'watch');
      const dest = path.join(iosRoot, WATCH_TARGET);

      fs.mkdirSync(path.join(dest, 'Views'), { recursive: true });
      for (const rel of [...SWIFT_SOURCES, ...RESOURCE_FILES]) {
        const from = path.join(src, rel);
        const to = path.join(dest, rel);
        if (!fs.existsSync(from)) {
          throw new Error(`[withAppleWatch] missing watch source: ${from}`);
        }
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
      }
      return cfg;
    },
  ]);

// ── 2 + 3. Add + wire the watch target in the pbxproj ──────────────────────

const withWatchTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;

    // Idempotency: bail if the target already exists.
    const targets = proj.pbxNativeTargetSection();
    const exists = Object.values(targets).some(
      (t) => t && typeof t === 'object' && t.name === WATCH_TARGET,
    );
    if (exists) return cfg;

    // Group holding the watch files in the navigator.
    const group = proj.addPbxGroup(
      [...SWIFT_SOURCES.map((f) => path.basename(f)), 'Info.plist'],
      WATCH_TARGET,
      WATCH_TARGET,
    );
    // Attach the group under the main project group.
    const groups = proj.hash.project.objects.PBXGroup;
    Object.keys(groups).forEach((key) => {
      if (
        groups[key].name === undefined &&
        groups[key].path === undefined &&
        groups[key].children
      ) {
        groups[key].children.push({ value: group.uuid, comment: WATCH_TARGET });
      }
    });

    // The watchOS application target (modern single-target watch app).
    const target = proj.addTarget(WATCH_TARGET, 'watch2_app', WATCH_TARGET, WATCH_BUNDLE_ID);

    // Build phases. Sources = the Swift files; Frameworks = HealthKit + WC.
    proj.addBuildPhase(
      SWIFT_SOURCES.map((f) => path.basename(f)),
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid,
    );
    proj.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    proj.addBuildPhase(
      ['HealthKit.framework', 'WatchConnectivity.framework'],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid,
    );

    // Target-specific build settings on both Debug + Release configs.
    const settings = {
      SDKROOT: 'watchos',
      TARGETED_DEVICE_FAMILY: '4',
      WATCHOS_DEPLOYMENT_TARGET,
      SWIFT_VERSION,
      PRODUCT_NAME: `"${WATCH_TARGET}"`,
      PRODUCT_BUNDLE_IDENTIFIER: WATCH_BUNDLE_ID,
      INFOPLIST_FILE: `${WATCH_TARGET}/Info.plist`,
      CODE_SIGN_ENTITLEMENTS: `${WATCH_TARGET}/Sahha Watch.entitlements`,
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: '1',
      MARKETING_VERSION: '1.0',
      GENERATE_INFOPLIST_FILE: 'YES',
      ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
      SKIP_INSTALL: 'NO',
    };
    applyTargetSettings(proj, WATCH_TARGET, settings);

    // Phone app depends on + embeds the watch app.
    addWatchEmbed(proj, target);

    return cfg;
  });

/** Set build settings on every XCBuildConfiguration belonging to `targetName`. */
function applyTargetSettings(proj, targetName, settings) {
  const nativeTargets = proj.pbxNativeTargetSection();
  const targetEntry = Object.values(nativeTargets).find(
    (t) => t && typeof t === 'object' && t.name === targetName,
  );
  if (!targetEntry) return;
  const configListId = targetEntry.buildConfigurationList;
  const configLists = proj.pbxXCConfigurationList();
  const configList = configLists[configListId];
  if (!configList) return;
  const buildConfigs = proj.pbxXCBuildConfigurationSection();
  for (const ref of configList.buildConfigurations) {
    const conf = buildConfigs[ref.value];
    if (!conf || !conf.buildSettings) continue;
    Object.assign(conf.buildSettings, settings);
  }
}

/**
 * Make the main app target depend on the watch target and embed it via a
 * "Embed Watch Content" copy-files phase (dstSubfolderSpec 16 →
 * "$(CONTENTS_FOLDER_PATH)/Watch").
 */
function addWatchEmbed(proj, watchTarget) {
  const mainUuid = proj.getFirstTarget().uuid;
  proj.addTargetDependency(mainUuid, [watchTarget.uuid]);

  const productName = `${WATCH_TARGET}.app`;
  const copyPhase = proj.addBuildPhase(
    [productName],
    'PBXCopyFilesBuildPhase',
    'Embed Watch Content',
    mainUuid,
    'watch_app', // xcode lib preset → dstSubfolderSpec 16, path "$(CONTENTS_FOLDER_PATH)/Watch"
  );
  // RemoveHeadersOnCopy etc. not needed; the preset sets the right spec.
  return copyPhase;
}

module.exports = function withAppleWatch(config) {
  return withWatchTarget(withWatchSources(config));
};
