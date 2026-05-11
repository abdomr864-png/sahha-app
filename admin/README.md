# Sahha Admin

Internal admin dashboard for the Sahha fitness app. Vite + React + TypeScript + Tailwind + Supabase.

## What it manages

Every user-scoped and reference table in the Sahha database:

- **Users** (combined `auth.users` + `profiles` view)
- **Training**: exercises, programs, program_days, program_exercises, workouts, workout_exercises, workout_sets
- **Progress**: personal_records, body_measurements, progress_photos
- **Nutrition**: foods, meals, meal_items, water_log, supplements, supplement_logs
- **Wellness**: mood_log, sleep_log, wearable_metrics
- **Social**: follows, posts, post_likes, post_comments, leaderboards_weekly
- **AI**: ai_conversations, ai_messages, ai_form_checks, ai_program_adjustments
- **Streaks & progression**: user_streaks, streak_events, exercise_progression_log, next_session_suggestions
- **Billing**: subscriptions, usage_counters, entitlement_rules

Each gets a sortable, searchable list with click-to-edit + create + delete. The dashboard shows live KPIs (`admin_dashboard_stats` RPC) and a 30-day workouts chart. Each user has a drill-down page that tabs through every table that contains a `user_id`.

## Setup

```bash
cd admin
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (these are the SAME
# values the mobile app uses — anon key only; never put the service role key
# in a browser).
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Grant admin access to a user

The admin role is conferred by `auth.users.raw_app_meta_data.role = 'admin'`. The migration
`0025_admin_role.sql` adds an `is_admin()` Postgres function and an `admin_all` policy on every table
that lets `is_admin()` callers `SELECT/INSERT/UPDATE/DELETE` freely.

### Option A — Supabase Studio

1. Open the Supabase dashboard → Authentication → Users.
2. Pick the user → ⋯ → **Edit user**.
3. In the `app_metadata` JSON box, set:
   ```json
   { "role": "admin" }
   ```
4. Save. The user must sign out and back in (or wait for the access token to refresh) before
   `is_admin()` returns true.

### Option B — service-role SDK (server-side)

```ts
import { createClient } from '@supabase/supabase-js';
const admin = createClient(URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await admin.auth.admin.updateUserById(USER_ID, {
  app_metadata: { role: 'admin' },
});
```

### Option C — psql

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
where email = 'you@example.com';
```

## Deploy

This is a static SPA. Build with `npm run build` and host the `dist/` folder anywhere:

- Vercel / Netlify: point at `admin/`, command `npm run build`, output `dist`.
- Cloudflare Pages: same.
- Supabase Storage + a CDN: upload `dist` to a bucket and front it.

Make sure the host adds the `X-Robots-Tag: noindex` header (the `<meta>` tag covers most cases).

## Adding a new table

1. Add an entry to `src/config/resources.ts` describing columns and types.
2. Add a sidebar link in `src/components/layout/AdminLayout.tsx`.
3. (If the table has its own RLS) add `'<table_name>'` to the `tables` array in
   `supabase/migrations/0025_admin_role.sql` so admins can read/write it.

## Security model

- The admin app uses the **anon key**, exactly like the mobile app. Privileges come from RLS, not
  from a server-side bypass key.
- `is_admin()` reads `auth.jwt() -> 'app_metadata' ->> 'role'`. `app_metadata` is server-controlled
  and cannot be tampered with from the client.
- All admin policies are additive (`for all to authenticated using (is_admin()) with check (is_admin())`).
  Non-admins still hit the original self-scoped policies.
- The `admin_users_view` and `admin_dashboard_stats()` function self-gate on `is_admin()` so a
  non-admin authenticated user querying them gets an empty result / `forbidden` error.

## File map

```
admin/
├── src/
│   ├── App.tsx                       routes
│   ├── auth/
│   │   ├── AuthProvider.tsx          supabase session + is_admin
│   │   └── ProtectedRoute.tsx        gate non-admins
│   ├── components/
│   │   ├── data/
│   │   │   ├── DataTable.tsx         generic list/search/page
│   │   │   └── RecordEditor.tsx      generic create/edit/delete form
│   │   ├── layout/AdminLayout.tsx    sidebar + outlet
│   │   └── ui/                       button, input, card, dialog, badge
│   ├── config/resources.ts           every table's column spec — single source of truth
│   ├── lib/                          supabase client, utils
│   └── pages/
│       ├── Dashboard.tsx             KPIs + chart
│       ├── Users.tsx                 auth.users + profiles
│       ├── UserDetail.tsx            drill-down per user
│       ├── Resource.tsx              generic table page
│       └── Login.tsx
└── supabase/migrations/0025_admin_role.sql  (in repo root)
```
