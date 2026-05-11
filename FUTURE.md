# Future work — items in scope of the AI spec but deferred

These were called out in the AI implementation spec but require additional
libraries or infra that wasn't in this pass. Each is small enough to land in
a follow-up PR.

## 1. Form-check video capture & frame extraction

- Add `expo-video-thumbnails` to dependencies.
- `features/ai-form-check/components/FormCheckScreen.tsx` already has a
  `Record video` button with a TODO. Wire it up:
  1. Open `expo-camera` recorder, 30s max, with side-view overlay.
  2. On stop, extract 6 evenly-spaced frames via `getThumbnailAsync`.
  3. Upload each frame + the original video to
     `form-checks/{user_id}/{check_id}/` in the `form-checks` Storage bucket.
  4. Call `aiClient.formCheck({ exercise_id, video_url, frame_urls, locale })`.

The Edge Function already validates that every URL contains
`/form-checks/<jwt-user-id>/`.

## 2. Per-program detail screen `/programs/[id]`

`ai-generate-program` returns a `program_id`. The wizard currently sends the
user back to `/(tabs)/train`. Build a dedicated detail screen so the
generation flow can deep-link directly into the new program.

## 3. Admin cost dashboard polish

`ai_costs_by_user_daily` is exposed via service-role; the current screen
reads it via the user's RLS-bound client which only returns the admin's own
rows. Either:
- Add an `is_admin` RLS policy to `ai_call_logs`, or
- Build an admin-only edge function that reads with the service role.

## 4. Auto-cron secrets bootstrap

`supabase/migrations/0014_ai_weekly_cron.sql` reads the function URL +
service-role JWT from a `private_secrets` table. Document this in the deploy
runbook so a fresh project can populate it once and forget.

## 5. Save parsed meals into `meals` / `meal_items`

`MealParseScreen` shows the parsed items with confidence flags but the
"Save to log" button has a TODO. Add a meals repository and persist on
confirm.

## 6. Conversation message context injection (PRs, recent workouts)

`ai-chat` currently injects only profile summary + minor flag. The spec
includes "recent workouts (last 5), recent PRs, current program week" —
those queries are stubbed in the function. Wire them once the schema
ergonomics for `personal_records` and `workouts` is settled.

## 7. Add `expo-video` to dependencies

`features/workouts/components/VideoPlayer.tsx` lazy-requires `expo-video`
and falls back to a placeholder when the module is missing. Run
`npx expo install expo-video` to enable real video playback on the
exercise detail screen. No code change needed afterwards — the file
already routes to the player when the module resolves.

## 8. Backfill exercise library (instructions, photos, videos)

`0020_seed_exercises_extended.sql` added ~190 exercises with names in
en/fr/ar but null instructions and null `video_url`/`photo_url`. The
schema is ready. A content pass should backfill these — the AI
generators don't depend on them, but the scanner-results carousel and
the exercise detail screen render better with real media. Aim for 300+
rows with full multi-locale instructions.

## 9. Coach persona system

`lib/llm/prompts/persona.ts → getPersonaPromptBlock` is the seam (D40).
A follow-up adds a `coach_personas` table (display_name, avatar_url,
prompt, voice_style), a `profiles.active_persona_id` FK, and changes
the function body to read from those. No call-site changes needed.

## 10. Exercise picker for "swap exercise" in routine preview

`GenerateWorkoutPreviewScreen` lets users edit sets/reps/rest/notes
inline but doesn't yet offer a "swap" picker. Hook it up to the
existing `/exercise-picker` modal filtered by the same muscle group,
or to `ai-exercise-alternatives` for a curated suggestion list.

## 11. Move existing `/program-gen` callers to `/routines`

`/program-gen` still routes home and the wizard now redirects to
`/routines/generate-program/preview`. The home tab CTA "AI Program"
still goes to `/program-gen` directly — point it at `/routines`
instead so users see the full mode selector + saved routines.
