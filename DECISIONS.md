# Architectural Decisions

Non-obvious choices made during scaffolding. Reverse any of them with one PR.

## D1 — Workout-session persistence: MMKV, not SecureStore

**Decision:** In-progress workout state is held in a Zustand store backed by `react-native-mmkv`. `expo-secure-store` is reserved for auth tokens only.

**Why:** SecureStore has a ~2 KB per-key limit on iOS and runs native crypto on every write. A 30-set workout persisted on every set completion will be slow and may exceed the limit. Workout content is sensitive but it is not a secret in the same sense as a JWT — it is encrypted at rest by Supabase and protected by RLS. MMKV is fast, synchronous, and has no practical size limit.

**Where:** `lib/offline/storage.ts` exposes a single `MmkvStorage` adapter. Auth wrappers use SecureStore directly.

## D2 — Expo Router version

**Decision:** Track whichever Router version ships with Expo SDK 54 (currently `~4.0.0`).

**Why:** The original spec named "Expo Router v3", but v3 pairs with SDK 50–51. SDK 54 ships with Router v4+. Pinning to v3 would break SDK 54 entirely. Treated as a transcription nit, not an architectural fork.

## D3 — Supabase auth storage adapter

**Decision:** Wrap `expo-secure-store` as the storage adapter for `@supabase/supabase-js`. Supabase's RN docs default to AsyncStorage; we replace it.

**Why:** Auth tokens are secrets. The framework default is convenient but not appropriate.

**Where:** `lib/supabase/storage.ts` → `SupabaseSecureStorage`.

## D4 — Client-generated UUIDs for offline writes

**Decision:** Workouts, workout_exercises, workout_sets, and meals get `uuid` v4 generated on the client at row creation. Postgres has `default gen_random_uuid()` as a backstop, but we always send an ID.

**Why:** A workout started offline must have a stable ID before sync, so child rows can reference it.

## D5 — Profiles table cleanup

**Decision:** `profiles.user_id uuid PK references auth.users(id) on delete cascade`. No separate `id` column. Added `weight_unit text check (weight_unit in ('kg','lb'))` since the spec makes weight unit a profile setting.

## D6 — Username constraints

**Decision:** lowercase, alphanumeric + underscore, 3–20 chars. Enforced by a check constraint and again in Zod.

## D7 — PR detection is server-side

**Decision:** Postgres trigger on `workout_sets` insert checks against `personal_records` and inserts new ones for: max weight at reps, estimated 1RM (Epley), and max single-set volume.

**Why:** Single source of truth, consistent across devices, can't be skipped by an outdated client.

## D8 — Total-volume aggregation

**Decision:** `workouts.total_volume_kg` is recomputed by trigger when sets are inserted/updated/deleted on the workout's exercises.

## D9 — Rest-timer behavior

**Decision:** Schedule a local notification at set completion with the rest seconds offset. Show a UI countdown only while the screen is foregrounded. Do not hold a foreground service / wakelock.

**Why:** Battery-friendly, OS-correct, and works regardless of app state.

## D10 — i18n key namespace

**Decision:** Dot-namespaced keys (`tracking.workouts.add_button`). One nested JSON file per locale.

## D11 — Locale detection

**Decision:** On first launch detect device locale; if not in `{fr, ar, en}` default to `en`. User picks/changes during onboarding and from Profile.

## D12 — RTL handling

**Decision:** When user picks Arabic, call `I18nManager.forceRTL(true)` and prompt a one-time reload. We do not attempt mid-session layout flips.

## D13 — Weight unit storage

**Decision:** All weight columns store kilograms. The display layer converts using the user's `profiles.weight_unit`.

## D14 — RevenueCat in pass 1

**Decision:** SDK installed, `useEntitlement` reads from `subscriptions.status` directly. Full purchase + restore flow lands in pass 2.

## D15 — Exercise seed authorship

**Decision:** I wrote the 50-exercise seed myself. Major muscle groups, compound + isolation, all three locales. Replace freely.

## D16 — Database types

**Decision:** `lib/supabase/database.types.ts` is a checked-in placeholder until you run `npm run db:types` against a real project.

## D17 — Color palette

**Decision:** Dark-first palette in `tailwind.config.js`. `bg`, `bg.subtle`, `bg.raised`, `ink`, `ink.subtle`, `accent` (orange `#FF4D2E`). Override at will.

## D18 — Bundle id and slug

**Decision:** `com.sahha.app`, slug `sahha`, display name "Sahha".

## D19 — New Architecture enabled

**Decision:** `newArchEnabled: true` in `app.json`. Required for Reanimated 3.16+ on RN 0.76+ to work without warnings.

## D20 — Folder organization within features

**Decision:** Each feature folder contains:

```
features/<name>/
  README.md            boundary description
  components/          presentational only
  hooks/               useX → orchestrates
  repositories/        talks to Supabase via the typed client
  services/            non-DB side effects (notifications, AI calls)
  schemas.ts           Zod schemas + inferred types
  index.ts             public surface (only this is importable from other features)
```

## D21 — Conflict resolution

**Decision:** Workout data: client wins. Social posts, AI messages, nutrition logs, body measurements, supplement logs: server wins (last-write-wins on `updated_at` where present).

## D22 — Form-check video TTL

**Decision:** A pg_cron job deletes Storage objects + `ai_form_checks` rows older than 30 days.

## D23 — Progress photos privacy

**Decision:** `progress_photos.is_private` defaults to `true`. Sharing is explicit per-photo.

## D24 — Analytics allowlist

**Decision:** `lib/analytics/track.ts` accepts only events from a typed enum. Workout content, body measurements, photo URLs, and AI message content are not in the enum.

## D25 — Test coverage in pass 1

**Decision:** One hook test, one repository test, one screen render test inside the workouts feature, as a template for later agents. Not aiming for coverage targets in pass 1.

## D26 — UUID generator avoids `react-native-get-random-values`

**Decision:** `lib/ids.ts` ships a small RFC 4122 v4 generator backed by `Math.random`. The `uuid` npm package is kept in deps but unused at runtime.

**Why:** `uuid@10` calls `crypto.getRandomValues`, which Hermes does not provide. Pulling in `react-native-get-random-values` for the sole purpose of generating client-side row IDs is overkill — these IDs are not security-sensitive and live in a per-user namespace.

## D27 — Train tab is one screen with segmented controls

**Decision:** `app/(tabs)/train.tsx` switches between Builder / Library / History via local state, not nested Expo Router routes.

**Why:** The three sub-views are not deep-linked and don't need browser-style history. A nested router layout for them would add files without adding behavior.

## D28 — `app/session.tsx` lives outside the tab stack

**Decision:** The active-workout screen is a top-level route, not a child of the Train tab. Tab bar is hidden while in session.

**Why:** A workout session is modal in spirit — the user shouldn't accidentally bounce between tabs and lose context mid-set. Putting it outside the tabs naturally handles that.

## D29 — Replaced LLM scaffolding with full OpenAI-backed AI layer

**Decision:** The original `llm-complete` skeleton + `EXPO_PUBLIC_LLM_ENABLED` flag + `NotConfiguredProvider` were replaced by five purpose-built Edge Functions (`ai-chat`, `ai-meal-parse`, `ai-generate-program`, `ai-form-check`, `ai-adjust-program`) and a typed RN `aiClient` (`lib/llm/client.ts`). The `LLMProvider` interface lives in `lib/llm/provider.ts` with `OpenAIProvider` next to it; only Deno Edge Functions import `openai-provider.ts`.

**Why:** The original skeleton had a single generic chat endpoint with no streaming, no entitlement enforcement, and no structured output validation. The spec required per-feature behavior (SSE chat streaming, vision form-check, structured program JSON, weekly cron), which is cleaner as one function per use-case sharing a `_shared/` helper folder.

## D30 — OpenAI key lives in Supabase secrets only

**Decision:** `OPENAI_API_KEY` is set via `supabase secrets set OPENAI_API_KEY=...` and read in Edge Functions via `Deno.env.get`. It is never in `.env`, `.env.example`, `app.json`, or any RN-bundled file. The RN `aiClient` only ever calls Supabase Edge Functions, authenticated via the user's JWT. `user_id` is taken from `auth.uid()` server-side, never from request bodies.

## D31 — Per-feature freemium + global hard cap

**Decision:** Each feature has its own row in `entitlement_rules` with its own daily limit (chat 5/day, meal-parse 10/day, form-check 1/week-as-7-day-window, program-adjust 1/week-as-7-day-window) or `premium_only` flag (program-gen). On top of that, every user (including premium) is capped at 100 AI calls/day across all features via a count on `ai_call_logs`. Hitting the cap returns `quota_exceeded`.

**Why:** Two layers — per-feature limits prevent free abuse of any single feature; the hard cap prevents a runaway loop or compromised account from racking up costs. The hard cap counter uses `ai_call_logs` (the source of truth for cost), not `usage_counters`, so it's always consistent.

## D32 — JSON Schema is enforced on OpenAI side AND re-validated with Zod

**Decision:** Every structured-output edge function passes a Zod schema; the provider builds an OpenAI JSON schema from it via a small converter (`zodToJson` in `openai-provider.ts`) and sets `response_format: { type: 'json_schema' }`. After the model responds, the result is re-parsed through Zod. On a Zod failure, we retry once. On second failure, return `invalid_response`.

**Why:** OpenAI's JSON schema mode anchors the format but is not strict; Zod is the actual validator. A single retry covers occasional malformations (~5% of calls).

## D33 — Form-check frame extraction is client-side

**Decision:** The Edge Function expects 4–6 frame URLs already in Supabase Storage under `form-checks/{user_id}/{check_id}/`. The client extracts frames via `expo-video-thumbnails` (to be added in a follow-up — see TODO in `FormCheckScreen.tsx`) and uploads them. The Edge Function verifies the path segment matches the JWT's `user_id`.

**Why:** Doing ffmpeg in a Deno edge function is heavy and slow. Letting the device decode and resample to JPEG once keeps the function lean. Path-prefix ownership check is the cheapest authorization that catches cross-user reads.

## D34 — Weekly program-adjust cron uses pg_cron + pg_net

**Decision:** `supabase/migrations/0014_ai_weekly_cron.sql` schedules `enqueue_weekly_adjustments()` for Mon 06:00 UTC. It iterates premium users with programs and calls the `ai-adjust-program` edge function via `pg_net.http_post`. The function URL and service-role JWT are stored in a `private_secrets` table (RLS-locked, service-role only) and must be populated once per project after first deploy. If secrets are missing, the cron is a no-op.

**Why:** pg_cron alone can only run SQL. We need an HTTP call to invoke the edge function with the same auth flow as a normal client. Storing the URL+key in a private table keeps the migration project-agnostic.

## D35 — Admin gate via `profiles.is_admin`

**Decision:** Added `profiles.is_admin boolean default false`. The `AICostsScreen` and the Profile-tab admin section read this. Flipping it for a user must happen out-of-band (SQL or service role).

## D36 — Sleep / mood scales rescaled at the prompt boundary

**Decision:** `sleep_log.quality_score`, `mood_log.{mood,energy,stress}` continue to be stored as 1..5 in the DB. The `_shared/user-context.ts` fetcher rescales them to 1..10 (×2) before injecting into the AI prompt and the reasoning card UI.

**Why:** The addendum's reasoning text and prompt template ("sleep was 5h, quality 7/10") read more naturally on a /10 scale than /5. Migrating the columns would force a backfill and break older clients; rescaling at the boundary is reversible.

## D37 — `ai-generate-program` now supports `mode: 'preview' | 'save'`

**Decision:** The function defaults to `save` (legacy behavior — persists into `programs/program_days/program_exercises`). The new routine-generator UI passes `mode: 'preview'`, which returns the structured plan + reasoning without persisting. `features/ai-routine-gen/repositories/routines.ts → saveProgramFromDraft` does the explicit save when the user taps "Save program".

**Why:** The addendum requires a preview/edit-then-save flow. Adding a mode flag keeps the existing call site (`/program-gen` wizard) working untouched, while the new routines flow gets the edit-before-save UX.

## D38 — Partial reversal of D27: nested routes under Routines

**Decision:** D27 ("Train tab is one screen with segmented controls — local state, not nested routes") still applies to the Train tab itself (Builder / Library / History remain a segmented control). The new AI routine flows live under `/routines/...` as a nested router stack: `/routines`, `/routines/generate-workout`, `/routines/generate-workout/preview`, `/routines/generate-program/preview`.

**Why:** The new flows are multi-screen, deep-linkable, and benefit from native back-stack semantics (preview screen needs an explicit back to intake; intake needs a back to home). A segmented control would conflate intake + preview.

## D39 — `useDraftRoutineStore` is MMKV-persisted

**Decision:** The in-progress generated workout/program is held in a Zustand store backed by MMKV (D1 pattern). It survives a force-quit. It is cleared on explicit save or discard. AI scan results (`useScanResultStore`) are NOT persisted — they're short-lived and `user_saved_equipment` is the durable layer.

**Why:** Generation costs money + tokens; if the app evicts a draft on reload the user loses both their AI quota and their edits. Scan results re-fetch cheaply when needed (the scan endpoint deduplicates via the saved-equipment table).

## D40 — Coach persona is a seam, not a feature

**Decision:** All AI generators (`ai-generate-workout`, `ai-generate-program`, `ai-equipment-scan`) call `getPersonaPromptBlock(admin, userId)` which today returns a hardcoded "default coach" voice. The block is injected into every system prompt. A future migration adds a `coach_personas` table + a profile foreign key and the same function reads from there.

**Why:** The addendum repeatedly references an "active coach persona" but the persona system itself isn't shipped yet. Wiring the call site now means the follow-up PR is a single function change, not a hunt across 4 prompts.

## D41 — Equipment-scan storage uses signed URLs

**Decision:** Scanned photos upload to a private `equipment-scans` bucket. The client requests a 10-minute signed URL and passes it to `ai-equipment-scan`, which forwards it to OpenAI vision. The edge function still validates that the URL contains `/equipment-scans/{userId}/` to defeat path tampering.

**Why:** OpenAI vision must be able to fetch the image. A public bucket would let anyone with a guessable filename read other users' scans. Signed URLs scoped to a 10-minute window are short enough to limit replay risk.

## D42 — Equipment-scan TTL is partial: image hard-deleted, row preserved

**Decision:** The 30-day cron in `0019_routine_gen_and_scanner.sql` hard-deletes original photos from the `equipment-scans` bucket and nulls out `user_saved_equipment.scanned_image_url` after 30 days. The saved-equipment row itself is preserved indefinitely so the user keeps the AI's analysis (muscles, mistakes, weight ranges) even after the source photo expires.

**Why:** The scan photo isn't useful long-term; the analysis is. This mirrors form-check TTL (D22) but spares the metadata.

## D43 — Exercise alternatives is its own edge function

**Decision:** "Try alternatives" on the exercise detail screen calls `ai-exercise-alternatives` rather than reusing `ai-chat`. Free 10/day, premium unlimited.

**Why:** Structured output (3 named substitutes with reasoning) is cleaner via `generateStructured` than via SSE chat parsing. Separate entitlement counter keeps abuse contained.

## D44 — Exercise library extension uses NULL instructions

**Decision:** `0020_seed_exercises_extended.sql` adds ~190 exercises with names in en/fr/ar but leaves `instructions_*` and `video_url`/`photo_url` NULL. The original 50-exercise seed (0012) was already this way.

**Why:** Generating high-quality multi-locale instructions for 200+ rows is content work, not migration work. The schema is ready and the AI matchers don't need instructions — they match on name + muscle + equipment. A follow-up content pass can backfill strings + media URLs without a code change.

## D45 — Social auth: dedicated SDKs, not generic expo-auth-session

**Decision:** Apple Sign-In via `expo-apple-authentication`; Google via `@react-native-google-signin/google-signin`. Both pass an ID token to `supabase.auth.signInWithIdToken`. Apple is gated behind `Platform.OS === "ios"`; Google runs on both. Apple Sign-In is mandatory on iOS while Google is offered (App Store policy).

**Why:** The dedicated SDKs use the native iOS Sign In with Google ID flow and Android Credential Manager — better UX, fewer redirects, and tokens that Supabase actually validates. `expo-auth-session` would force an in-app browser detour and breaks the privacy-relay nonce flow Apple requires.

**Where:** [features/auth/services/apple-auth.ts](features/auth/services/apple-auth.ts), [features/auth/services/google-auth.ts](features/auth/services/google-auth.ts), [features/auth/hooks/useSocialAuth.ts](features/auth/hooks/useSocialAuth.ts). Provider/dashboard config in [docs/auth-setup.md](docs/auth-setup.md).

## D46 — Health data: read-only in pass 2; write deferred

**Decision:** The `HealthDataProvider` interface exposes only `read*` methods (steps, HR, RHR, HRV, calories, sleep, workouts, weight, body fat). No `writeWorkout`, no `writeWeight`. `NSHealthUpdateUsageDescription` was removed from `app.json` so the App Store reviewer doesn't flag a declared-but-unused capability.

**Why:** Two-way sync waits on the standalone watch app (per addendum). Declaring write access today exposes us to scope creep and a usage string that'd need rewriting once we actually do write.

## D47 — Synced biometric data lives in `_synced` tables, separate from in-app data

**Decision:** Migration `0021_health_sync.sql` adds `sleep_sessions_synced` and `workouts_synced` rather than mixing watch-imported data into existing `sleep_log` (self-report) or `workouts` (precise per-set logs). `wearable_metrics` was extended with `source_uuid`, `device_name`, `recorded_at_local`, `synced_at`, `metadata`, plus a unique index for idempotent upsert.

**Why:** Manually-logged in-app workouts capture every set, rep, RPE — they are precise. Watch-imported workouts are coarse (duration + calories). Polluting the precise table with coarse rows would corrupt PR detection (D7) and volume aggregation (D8). Separation lets the user *link* a synced row to a precise row when relevant via `workouts_synced.linked_workout_id`.

## D48 — Health-Connect added to source enum; mock too

**Decision:** `wearable_metrics.source` check constraint widened to `(apple_health, google_fit, health_connect, manual, mock)`. `google_fit` retained for legacy rows; new Android writes use `health_connect`. The `mock` source lets dev/test runs persist without polluting prod-style sources.

## D49 — AI prompts get health data only with explicit opt-in

**Decision:** `health_sync_settings.ai_biometrics_optin` defaults to `false`. Coach prompts must check this flag before injecting HR/HRV/sleep into the user-context block. Without opt-in, AI generators fall back to self-report (sleep_log, mood_log) as today.

**Why:** Biometric data is sensitive. Sending it to a third-party LLM is an explicit user choice, not an implicit one — and the toggle gives us a clean place to revoke later (e.g. on disconnect).

## D50 — Background health sync via expo-background-fetch with a 24h cap

**Decision:** A `TaskManager` task registered at 90-min minimum interval pulls only the last 24h of data. Foreground sync on app open also targets 24h; the 30-day backfill only runs once at first connection.

**Why:** iOS gives ~30s of background time. A 90-day backfill would time out, get throttled, and produce duplicate rows on every retry. The unique indexes guarantee idempotency, but cheap idempotency still costs network — keep background work tight, leave catch-up to foreground.

## D51 — Health providers lazy-require their native modules

**Decision:** `HealthKitProvider` and `HealthConnectProvider` `require()` their native packages inside try/catch. If the module isn't loaded (Expo Go, web, wrong platform), the provider returns empty arrays and `isAvailable()` returns false.

**Why:** A direct `import` would break the Metro bundle in environments where the native module isn't linked. Lazy-require lets the same JS bundle ship to dev builds, Expo Go, and tests without conditional builds.
