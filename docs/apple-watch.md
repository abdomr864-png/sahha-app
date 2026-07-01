# Sahha Apple Watch companion (phase 1 — iOS)

A native watchOS app that lets users start/pause/end a workout, log sets, and see
live heart rate from the wrist. It syncs the active workout with the phone in real
time over **Watch Connectivity** and reconciles logged sets back into the phone's
existing workout store — the **phone stays the single source of truth** and the
only thing that writes to Supabase. The watch never talks to the backend.

```
┌─────────────── iPhone (React Native) ───────────────┐        ┌──── Apple Watch (SwiftUI) ────┐
│ features/workouts/store.ts  (active workout draft)   │        │  SahhaWatchApp                 │
│            ▲  apply + enqueue        │ project        │        │   ├ StartView                  │
│            │                          ▼                │  WC    │   ├ ActiveWorkoutView (HR/time)│
│ features/watch/reconcile.ts ◀── messages ── bridge ◀──┼━━━━━━━▶│   └ SetLoggerView (crown)      │
│ features/watch/projection.ts ── snapshot ─▶ bridge ──┼━━━━━━━▶│  WorkoutManager (HealthKit)    │
│ modules/watch-bridge (Swift WCSession)               │        │  WatchConnectivityManager      │
└──────────────────────────────────────────────────────┘        └────────────────────────────────┘
```

## Layout

| Path | What |
| --- | --- |
| `features/watch/messages.ts` | Typed wire contract (phone↔watch) + zod validation + `PROTOCOL_VERSION`. |
| `features/watch/projection.ts` | Pure `WorkoutDraft → WatchWorkoutSnapshot` (glanceable state). |
| `features/watch/reconcile.ts` | Pure, **idempotent** reducer: watch message → next draft + offline-queue ops. |
| `features/watch/bridge.ts` | Typed wrapper over the native module; safe no-op when absent. |
| `features/watch/useWatchBridge.ts` | Glue hook (mounted in `app/_layout.tsx`). Pushes snapshots, ingests + de-dupes messages. |
| `modules/watch-bridge/ios/WatchBridgeModule.swift` | Phone-side Expo module wrapping `WCSession`. |
| `watch/` | The watchOS SwiftUI app sources (copied into the iOS project by the plugin). |
| `plugins/withAppleWatch.js` | Config plugin: adds + wires the watchOS target on prebuild/EAS. |

## How sync works

- **Phone → Watch (state):** every change to the workout draft is projected to a
  `WatchWorkoutSnapshot` and pushed as the WCSession **application context**
  (latest-state-wins). It survives disconnection — a watch that was out of range
  reads the freshest snapshot on reconnect.
- **Watch → Phone (actions):** the wrist sends discrete messages
  (`startWorkout`, `completeSet`, …). When the phone is reachable they go via
  `sendMessage`; otherwise via `transferUserInfo` (guaranteed, FIFO). On the
  phone, `reduceWatchMessage` folds each into the draft and emits the **same
  offline-queue ops the in-app UI uses**, so persistence flows through the
  existing path (`features/workouts/services/offlineRunner.ts`).

### No duplicate logging (the important guarantee)

Sets are addressed by a **stable UUID** generated once on the watch. Re-applying
`completeSet` for the same id yields the same draft and the same queue op id,
which the offline queue de-dupes and Supabase upserts in place. So:

- A message replayed after a reconnect → no duplicate.
- Both devices completing the same set → same id → no duplicate.
- `startWorkout` uses the message id as the workout id → a replayed start
  resolves to the already-active workout, never a second one.

The glue adds a second guard (a bounded set of processed `messageId`s) on top of
the reducer's idempotency.

## One-time Xcode / signing setup

The config plugin gets you a building target in the common case, but **pbxproj
mutation for a watch target is intricate** — after the first prebuild, open the
workspace once and verify:

1. `npx expo prebuild -p ios` (or let EAS do it).
2. Open `ios/Sahha.xcworkspace` in Xcode.
3. Confirm the **SahhaWatch** target exists with:
   - General → Deployment Info: watchOS 9.0+, "Supports Running Without iOS App
     Installed" = **off** (it's a companion).
   - Build Settings → Packaging → Info.plist File = `SahhaWatch/Info.plist`,
     Code Signing Entitlements = `SahhaWatch/Sahha Watch.entitlements`.
   - Signing & Capabilities → **HealthKit** capability present; team set; bundle
     id `com.sahha.app.watchkitapp`.
4. Confirm the **Sahha** (phone) target → Build Phases has an **Embed Watch
   Content** phase copying `SahhaWatch.app`, and a target dependency on
   SahhaWatch.
5. Add an **AppIcon** set to the watch target's asset catalog before submitting
   to the App Store (not required for dev builds).

If the target is missing or mis-wired, you can add it manually in Xcode with the
same settings above — the Swift sources in `ios/SahhaWatch/` are already correct;
only the project wiring needs to exist.

### Entitlements

- **Phone:** HealthKit is already declared in `app.json` (`ios.entitlements`
  `com.apple.developer.healthkit`) and its usage strings in `ios.infoPlist`.
- **Watch:** `watch/Sahha Watch.entitlements` (HealthKit) + the HealthKit usage
  strings in `watch/Info.plist`.
- WatchConnectivity needs **no** entitlement.

## EAS

No special EAS config. `eas build -p ios` runs prebuild (applying the plugin) and
compiles both targets. Use a development build (not Expo Go — the native module
and watch target require a custom client).

## Editing the watch app

Edit the Swift sources under **`watch/`** (the repo copy is the source of truth).
The plugin copies them into `ios/SahhaWatch/` on each prebuild. If you edit the
copy under `ios/` directly, rerun prebuild will overwrite it.

Keep `watch/Models.swift` in sync with `features/watch/messages.ts` — both define
the same wire shapes and must share `PROTOCOL_VERSION` / `protocolVersion`.

## Phase 2 (not built)

Mirror this for Wear OS: Kotlin + Health Services (live HR + exercise) and the
Data Layer API (`MessageClient` / `DataClient`) in place of WatchConnectivity.
The pure `features/watch` projection/reconcile layer is platform-agnostic and is
intended to be reused as-is behind a second native bridge.
