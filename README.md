# Sahha — Gym-First Health Companion

Production-grade React Native + Expo app for serious lifters. Plan a workout, train, log it, see progress, share with friends.

## Stack

- React Native + Expo SDK 54 (dev client required — not Expo Go)
- Expo Router (file-based routing)
- Supabase (Postgres + Auth + Storage + Edge Functions + Realtime)
- Zustand (client state) + TanStack Query (server state)
- NativeWind (Tailwind for RN)
- TypeScript strict, Zod schemas, RHF forms
- i18next (fr / ar / en, RTL for Arabic)
- expo-secure-store (auth tokens) + react-native-mmkv (workout state)
- RevenueCat (subscriptions, paywalls)

## Getting started

```bash
# 1. Install
npm install

# 2. Copy and fill env
cp .env.example .env
# Fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# 3. Start Supabase locally (or skip if using cloud)
npx supabase start
npm run db:push     # apply migrations
npm run db:types    # regenerate types

# 4. Start a dev build (Expo Go is NOT supported — needs custom dev client)
npx eas build --profile development --platform ios
# or android
# Install the resulting build on your device, then:
npm start
```

## Project layout

```
app/                Expo Router screens
features/           One folder per agent (auth, workouts, programs, ...)
  shared/           Cross-feature primitives (UI atoms, hooks, types)
lib/
  supabase/         Typed client + error mapping
  llm/              LLMProvider interface + implementations
  i18n/             i18next config + RTL bootstrap
  notifications/    expo-notifications wrappers
  health-data/      HealthDataProvider interface (HealthKit / Google Fit)
  offline/          Offline queue for workout-session writes
supabase/
  migrations/       SQL migrations
  functions/        Edge Functions (LLM, rate limiting, cron jobs)
locales/            fr.json / ar.json / en.json
```

## Architectural rules

These are enforced by lint where possible:

1. **Thin screens, fat hooks.** Screens render JSX and call one or two `use*` hooks.
2. **Discriminated-union async state.** No `loading + data + error` triples.
3. **300-line file cap.** Enforced by `max-lines` ESLint rule.
4. **No raw Supabase errors in UI.** Everything flows through `lib/supabase/errors.ts`.
5. **Mandatory RLS on every table.** Policies are committed alongside migrations.
6. **Layer separation.** Components → hooks → services → repositories → Supabase.
7. **Zod is the source of truth.** Types come from `z.infer`.
8. **AI keys server-side only.** All LLM calls go through Edge Functions.
9. **Offline-first for workouts.** A user must be able to start, log, and finish a workout with no network.
10. **Cross-feature imports forbidden.** Enforced by `no-restricted-imports`.

## Scripts

| Script               | What                                           |
| -------------------- | ---------------------------------------------- |
| `npm start`          | Start Metro for the dev client                 |
| `npm run typecheck`  | `tsc --noEmit`                                 |
| `npm run lint`       | ESLint, max-warnings 0                         |
| `npm run format`     | Prettier write                                 |
| `npm test`           | Jest + RNTL                                    |
| `npm run db:push`    | Apply Supabase migrations                      |
| `npm run db:types`   | Regenerate `lib/supabase/database.types.ts`    |

## CI

GitHub Actions runs typecheck + lint + test on every PR and push to main.

## Decisions

See [DECISIONS.md](./DECISIONS.md) for non-obvious choices made while scaffolding.
