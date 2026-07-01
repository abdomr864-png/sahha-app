-- ============================================================================
-- 0033_pantry_scan — "What can I eat?" macro-aware pantry scan (Pro).
--
-- The user scans the ingredients they have; vision detects them; we map each
-- detection to a row in the EXISTING `foods` table (the single source of truth
-- for macros) and suggest meals that fill the macros they have LEFT for the day.
--
-- This migration is fully ADDITIVE — it never alters or drops existing columns:
--   1. Extends `foods` with i18n names, a category, search aliases and a stable
--      `slug` (so the curated seed below is idempotent and re-runnable).
--   2. Seeds a curated Moroccan / MENA ingredient database into `foods`
--      (per-100g macros — serving_size_g = 100). `foods` shipped empty, but the
--      reliability contract requires macros be computed from the DB, never from
--      the model, so the DB must actually contain ingredients.
--   3. Creates `pantry_items` (persistent, user-editable pantry; a scan upserts
--      into it) with standard owner-only RLS.
--   4. Gates the feature behind Pro via entitlement_rules (premium_only).
--   5. Creates the private `pantry-scans` storage bucket (owner-only) + 30-day
--      TTL cron, mirroring meal-photos / equipment-scans.
--
-- Idempotent. Rollback:
--   drop table if exists pantry_items;
--   delete from entitlement_rules where feature = 'pantry_scan';
--   delete from foods where source = 'sahha_ma';
--   delete from storage.buckets where id = 'pantry-scans';
--   (the added foods columns are harmless and can be left in place)
-- ============================================================================

-- ---- 1. Extend `foods` (additive, nullable) -------------------------------
alter table foods add column if not exists name_fr text;
alter table foods add column if not exists name_ar text;
alter table foods add column if not exists category text;
-- Extra search terms (synonyms, darija transliterations, plurals) used by the
-- ingredient matcher and the food-search picker.
alter table foods add column if not exists aliases text[];
-- Stable identifier for the curated seed so re-running this migration upserts
-- instead of duplicating. NULL for user/barcode foods; a plain unique index still
-- permits many NULLs in Postgres, and a full (non-partial) index lets
-- `on conflict (slug)` infer it correctly.
alter table foods add column if not exists slug text;
create unique index if not exists foods_slug_key on foods (slug);
create index if not exists foods_source_idx on foods (source);

-- ---- 2. Seed the Moroccan / MENA ingredient database ----------------------
-- Macros are per 100 g edible portion (serving_size_g = 100). Values are rounded
-- USDA-style references — good enough for portion-scaled meal macros. `aliases`
-- carries FR/darija/EN synonyms so vision detections and the search box match.
insert into foods (slug, name, name_fr, name_ar, category, calories, protein_g, carbs_g, fat_g, serving_size_g, source, aliases) values
  -- Proteins — meat, poultry, fish, eggs
  ('chicken_breast', 'Chicken breast', 'Blanc de poulet', 'صدر دجاج', 'protein', 120, 22.5, 0, 2.6, 100, 'sahha_ma', array['poulet','dajaj','chicken','djaj']),
  ('chicken_thigh', 'Chicken thigh', 'Cuisse de poulet', 'فخذ دجاج', 'protein', 209, 18, 0, 15, 100, 'sahha_ma', array['poulet','dajaj','chicken thigh']),
  ('ground_beef', 'Ground beef (lean)', 'Viande hachée', 'لحم مفروم', 'protein', 215, 18, 0, 16, 100, 'sahha_ma', array['kefta','beef','viande','lham','hache']),
  ('beef_steak', 'Beef (lean cut)', 'Bœuf', 'لحم بقر', 'protein', 187, 21, 0, 11, 100, 'sahha_ma', array['beef','viande','lham','bbegri']),
  ('lamb', 'Lamb', 'Agneau', 'لحم غنم', 'protein', 250, 19, 0, 19, 100, 'sahha_ma', array['mouton','lamb','ghnmi','agneau']),
  ('egg', 'Egg', 'Œuf', 'بيض', 'protein', 143, 13, 1.1, 9.5, 100, 'sahha_ma', array['eggs','oeuf','beid','baida']),
  ('sardine', 'Sardine', 'Sardine', 'سردين', 'protein', 208, 25, 0, 11, 100, 'sahha_ma', array['sardines','sardin']),
  ('tuna', 'Tuna (canned in water)', 'Thon', 'تونة', 'protein', 116, 26, 0, 1, 100, 'sahha_ma', array['thon','tuna','ton']),
  ('white_fish', 'White fish', 'Poisson blanc', 'سمك أبيض', 'protein', 90, 19, 0, 1, 100, 'sahha_ma', array['fish','poisson','hout','merlu','whiting']),
  ('shrimp', 'Shrimp', 'Crevettes', 'قمرون', 'protein', 99, 24, 0.2, 0.3, 100, 'sahha_ma', array['crevette','shrimp','gambas','qamroun']),
  -- Legumes
  ('lentils', 'Lentils (cooked)', 'Lentilles', 'عدس', 'legume', 116, 9, 20, 0.4, 100, 'sahha_ma', array['lentilles','adss','lentil','las']),
  ('chickpeas', 'Chickpeas (cooked)', 'Pois chiches', 'حمص', 'legume', 164, 9, 27, 2.6, 100, 'sahha_ma', array['pois chiche','hommos','garbanzo','hms']),
  ('white_beans', 'White beans (cooked)', 'Haricots blancs', 'لوبيا', 'legume', 139, 9.7, 25, 0.5, 100, 'sahha_ma', array['loubia','haricots','white beans','fasolia']),
  ('fava_beans', 'Fava beans (cooked)', 'Fèves', 'فول', 'legume', 110, 7.6, 19.6, 0.4, 100, 'sahha_ma', array['foul','fava','feves','bissara','broad beans']),
  ('split_peas', 'Split peas (cooked)', 'Pois cassés', 'جلبانة يابسة', 'legume', 118, 8.3, 21, 0.4, 100, 'sahha_ma', array['split peas','pois casses']),
  -- Dairy
  ('milk', 'Whole milk', 'Lait entier', 'حليب', 'dairy', 61, 3.2, 4.8, 3.3, 100, 'sahha_ma', array['lait','milk','halib']),
  ('yogurt', 'Plain yogurt', 'Yaourt nature', 'زبادي', 'dairy', 61, 3.5, 4.7, 3.3, 100, 'sahha_ma', array['yaourt','yogurt','danone','raibi','zabadi']),
  ('greek_yogurt', 'Greek yogurt', 'Yaourt grec', 'زبادي يوناني', 'dairy', 97, 9, 3.9, 5, 100, 'sahha_ma', array['greek yogurt','yaourt grec']),
  ('jben', 'Fresh cheese (jben)', 'Fromage frais (jben)', 'جبن بلدي', 'dairy', 98, 11, 3.4, 4.3, 100, 'sahha_ma', array['jben','fromage','cheese','jaben']),
  ('laban', 'Buttermilk (lben)', 'Lben', 'لبن', 'dairy', 40, 3.3, 4.8, 0.9, 100, 'sahha_ma', array['lben','laban','buttermilk']),
  -- Grains & starches
  ('khobz', 'White bread (khobz)', 'Pain blanc', 'خبز', 'grain', 265, 9, 49, 3.2, 100, 'sahha_ma', array['khobz','pain','bread','batbout','komir']),
  ('whole_wheat_bread', 'Whole wheat bread', 'Pain complet', 'خبز كامل', 'grain', 247, 13, 41, 3.4, 100, 'sahha_ma', array['pain complet','whole wheat','khobz kamil']),
  ('couscous', 'Couscous (cooked)', 'Couscous', 'كسكس', 'grain', 112, 3.8, 23, 0.2, 100, 'sahha_ma', array['couscous','kesksou','seksu']),
  ('rice', 'White rice (cooked)', 'Riz', 'أرز', 'grain', 130, 2.7, 28, 0.3, 100, 'sahha_ma', array['riz','rice','rouz']),
  ('pasta', 'Pasta (cooked)', 'Pâtes', 'معكرونة', 'grain', 158, 5.8, 31, 0.9, 100, 'sahha_ma', array['pates','pasta','macaroni','spaghetti']),
  ('vermicelli', 'Vermicelli (dry)', 'Vermicelle', 'شعرية', 'grain', 350, 12, 71, 1.5, 100, 'sahha_ma', array['cheveux d''ange','vermicelle','chaaria','vermicelli']),
  ('oats', 'Oats (dry)', 'Flocons d''avoine', 'شوفان', 'grain', 389, 16.9, 66, 6.9, 100, 'sahha_ma', array['avoine','oats','oatmeal','chofan']),
  ('semolina', 'Semolina (dry)', 'Semoule', 'سميد', 'grain', 360, 12.7, 73, 1, 100, 'sahha_ma', array['semoule','smida','semolina']),
  ('potato', 'Potato (boiled)', 'Pomme de terre', 'بطاطس', 'grain', 87, 1.9, 20, 0.1, 100, 'sahha_ma', array['pomme de terre','potato','batata']),
  ('sweet_potato', 'Sweet potato (cooked)', 'Patate douce', 'بطاطا حلوة', 'grain', 90, 2, 21, 0.15, 100, 'sahha_ma', array['patate douce','sweet potato','batata helwa']),
  -- Vegetables
  ('tomato', 'Tomato', 'Tomate', 'طماطم', 'vegetable', 18, 0.9, 3.9, 0.2, 100, 'sahha_ma', array['tomate','tomato','matecha','matisha']),
  ('onion', 'Onion', 'Oignon', 'بصل', 'vegetable', 40, 1.1, 9.3, 0.1, 100, 'sahha_ma', array['oignon','onion','bsla']),
  ('garlic', 'Garlic', 'Ail', 'ثوم', 'vegetable', 149, 6.4, 33, 0.5, 100, 'sahha_ma', array['ail','garlic','touma']),
  ('carrot', 'Carrot', 'Carotte', 'جزر', 'vegetable', 41, 0.9, 9.6, 0.2, 100, 'sahha_ma', array['carotte','carrot','khizou']),
  ('zucchini', 'Zucchini', 'Courgette', 'كوسة', 'vegetable', 17, 1.2, 3.1, 0.3, 100, 'sahha_ma', array['courgette','zucchini','kar3a']),
  ('bell_pepper', 'Bell pepper', 'Poivron', 'فلفل حلو', 'vegetable', 31, 1, 6, 0.3, 100, 'sahha_ma', array['poivron','pepper','felfla']),
  ('eggplant', 'Eggplant', 'Aubergine', 'باذنجان', 'vegetable', 25, 1, 6, 0.2, 100, 'sahha_ma', array['aubergine','eggplant','denjal','badenjal']),
  ('pumpkin', 'Pumpkin', 'Potiron', 'قرع', 'vegetable', 26, 1, 6.5, 0.1, 100, 'sahha_ma', array['potiron','citrouille','pumpkin','gra']),
  ('spinach', 'Spinach', 'Épinards', 'سبانخ', 'vegetable', 23, 2.9, 3.6, 0.4, 100, 'sahha_ma', array['epinards','spinach','sbanekh']),
  ('okra', 'Okra', 'Gombo', 'ملوخية', 'vegetable', 33, 1.9, 7, 0.2, 100, 'sahha_ma', array['gombo','okra','mloukhia']),
  ('cucumber', 'Cucumber', 'Concombre', 'خيار', 'vegetable', 15, 0.7, 3.6, 0.1, 100, 'sahha_ma', array['concombre','cucumber','khyar']),
  ('green_peas', 'Green peas', 'Petits pois', 'جلبانة', 'vegetable', 81, 5, 14, 0.4, 100, 'sahha_ma', array['petits pois','peas','jelbana']),
  ('green_beans', 'Green beans', 'Haricots verts', 'لوبيا خضراء', 'vegetable', 31, 1.8, 7, 0.2, 100, 'sahha_ma', array['haricots verts','green beans','loubia khadra']),
  ('cabbage', 'Cabbage', 'Chou', 'كرنب', 'vegetable', 25, 1.3, 6, 0.1, 100, 'sahha_ma', array['chou','cabbage','kromb']),
  ('cauliflower', 'Cauliflower', 'Chou-fleur', 'قرنبيط', 'vegetable', 25, 1.9, 5, 0.3, 100, 'sahha_ma', array['chou-fleur','cauliflower','chiflor']),
  ('turnip', 'Turnip', 'Navet', 'لفت', 'vegetable', 28, 0.9, 6.4, 0.1, 100, 'sahha_ma', array['navet','turnip','left']),
  -- Fruits
  ('orange', 'Orange', 'Orange', 'برتقال', 'fruit', 47, 0.9, 12, 0.1, 100, 'sahha_ma', array['orange','limoun','tchina']),
  ('banana', 'Banana', 'Banane', 'موز', 'fruit', 89, 1.1, 23, 0.3, 100, 'sahha_ma', array['banane','banana','banan']),
  ('apple', 'Apple', 'Pomme', 'تفاح', 'fruit', 52, 0.3, 14, 0.2, 100, 'sahha_ma', array['pomme','apple','teffah']),
  ('dates', 'Dates', 'Dattes', 'تمر', 'fruit', 282, 2.5, 75, 0.4, 100, 'sahha_ma', array['dattes','dates','tmar']),
  ('figs', 'Figs (fresh)', 'Figues', 'تين', 'fruit', 74, 0.8, 19, 0.3, 100, 'sahha_ma', array['figues','figs','karmous']),
  ('grapes', 'Grapes', 'Raisin', 'عنب', 'fruit', 69, 0.7, 18, 0.2, 100, 'sahha_ma', array['raisin','grapes','3inb']),
  ('watermelon', 'Watermelon', 'Pastèque', 'دلاح', 'fruit', 30, 0.6, 7.6, 0.2, 100, 'sahha_ma', array['pasteque','watermelon','dellah']),
  ('strawberry', 'Strawberry', 'Fraise', 'فراولة', 'fruit', 32, 0.7, 7.7, 0.3, 100, 'sahha_ma', array['fraise','strawberry','toot']),
  ('pomegranate', 'Pomegranate', 'Grenade', 'رمان', 'fruit', 83, 1.7, 19, 1.2, 100, 'sahha_ma', array['grenade','pomegranate','remman']),
  ('avocado', 'Avocado', 'Avocat', 'أفوكادو', 'fruit', 160, 2, 9, 15, 100, 'sahha_ma', array['avocat','avocado']),
  ('lemon', 'Lemon', 'Citron', 'حامض', 'fruit', 29, 1.1, 9, 0.3, 100, 'sahha_ma', array['citron','lemon','hamed','lhamd']),
  -- Fats, nuts & seeds
  ('olive_oil', 'Olive oil', 'Huile d''olive', 'زيت الزيتون', 'fat', 884, 0, 0, 100, 100, 'sahha_ma', array['huile d''olive','olive oil','zit zitoun']),
  ('argan_oil', 'Argan oil', 'Huile d''argan', 'زيت أركان', 'fat', 884, 0, 0, 100, 100, 'sahha_ma', array['argan','huile argan','zit argan']),
  ('butter', 'Butter', 'Beurre', 'زبدة', 'fat', 717, 0.85, 0.06, 81, 100, 'sahha_ma', array['beurre','butter','zebda']),
  ('smen', 'Smen (fermented butter)', 'Smen', 'سمن', 'fat', 717, 0.85, 0, 81, 100, 'sahha_ma', array['smen','smn','fermented butter']),
  ('olives', 'Olives', 'Olives', 'زيتون', 'fat', 145, 1, 4, 15, 100, 'sahha_ma', array['olives','zitoun']),
  ('almonds', 'Almonds', 'Amandes', 'لوز', 'fat', 579, 21, 22, 50, 100, 'sahha_ma', array['amandes','almonds','louz']),
  ('walnuts', 'Walnuts', 'Noix', 'جوز', 'fat', 654, 15, 14, 65, 100, 'sahha_ma', array['noix','walnuts','gerga3']),
  ('peanuts', 'Peanuts', 'Cacahuètes', 'فول سوداني', 'fat', 567, 26, 16, 49, 100, 'sahha_ma', array['cacahuetes','peanuts','kawkaw']),
  ('sesame', 'Sesame seeds', 'Sésame', 'جلجلان', 'fat', 573, 18, 23, 50, 100, 'sahha_ma', array['sesame','jiljlan','zinjlan']),
  -- Pantry staples & condiments
  ('honey', 'Honey', 'Miel', 'عسل', 'other', 304, 0.3, 82, 0, 100, 'sahha_ma', array['miel','honey','3sel']),
  ('sugar', 'Sugar', 'Sucre', 'سكر', 'other', 387, 0, 100, 0, 100, 'sahha_ma', array['sucre','sugar','soukar']),
  ('tomato_paste', 'Tomato paste', 'Concentré de tomate', 'معجون طماطم', 'other', 82, 4.3, 19, 0.5, 100, 'sahha_ma', array['concentre de tomate','tomato paste']),
  ('harissa', 'Harissa', 'Harissa', 'هريسة', 'other', 70, 3, 12, 1.5, 100, 'sahha_ma', array['harissa','hrissa']),
  ('flour', 'Wheat flour', 'Farine', 'دقيق', 'grain', 364, 10, 76, 1, 100, 'sahha_ma', array['farine','flour','dqiq','farina'])
-- The slug unique index is PARTIAL (where slug is not null), so the conflict
-- target must repeat that predicate for Postgres to infer the right index.
on conflict (slug) where slug is not null do update set
  name = excluded.name,
  name_fr = excluded.name_fr,
  name_ar = excluded.name_ar,
  category = excluded.category,
  calories = excluded.calories,
  protein_g = excluded.protein_g,
  carbs_g = excluded.carbs_g,
  fat_g = excluded.fat_g,
  serving_size_g = excluded.serving_size_g,
  source = excluded.source,
  aliases = excluded.aliases;

-- ---- 3. pantry_items: the user's persistent, editable pantry ---------------
create table if not exists pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Matched food-DB row. Null when vision detected something we couldn't map —
  -- the confirm UI surfaces it as "couldn't match — search to add".
  food_db_id uuid references foods(id) on delete set null,
  -- Display name as detected/entered (kept even when food_db_id is null).
  name text not null,
  quantity numeric(8, 2),
  unit text,
  source text not null default 'scan' check (source in ('scan', 'manual')),
  -- Vision confidence 0..1 (null for manual adds).
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  added_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists pantry_items_user_idx on pantry_items (user_id, added_at desc);

alter table pantry_items enable row level security;

drop policy if exists pantry_self_select on pantry_items;
create policy pantry_self_select on pantry_items
  for select using (user_id = auth.uid());

drop policy if exists pantry_self_insert on pantry_items;
create policy pantry_self_insert on pantry_items
  for insert with check (user_id = auth.uid());

drop policy if exists pantry_self_update on pantry_items;
create policy pantry_self_update on pantry_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists pantry_self_delete on pantry_items;
create policy pantry_self_delete on pantry_items
  for delete using (user_id = auth.uid());

-- ---- 4. Gate behind Pro ----------------------------------------------------
insert into entitlement_rules (feature, free_daily_limit, free_total_limit, premium_only, description) values
  ('pantry_scan', null, null, true, 'What can I eat? — pantry scan + macro-aware meal suggestions')
on conflict (feature) do update set
  description = excluded.description,
  free_daily_limit = excluded.free_daily_limit,
  free_total_limit = excluded.free_total_limit,
  premium_only = excluded.premium_only;

-- ---- 5. Storage bucket: pantry-scans (private, owner-only) -----------------
insert into storage.buckets (id, name, public)
values ('pantry-scans', 'pantry-scans', false)
on conflict (id) do nothing;

drop policy if exists pantry_scans_owner_all on storage.objects;
create policy pantry_scans_owner_all on storage.objects
  for all using (bucket_id = 'pantry-scans' and owner = auth.uid())
  with check (bucket_id = 'pantry-scans' and owner = auth.uid());

-- 7-day TTL: pantry photos are only needed for the scan round-trip. Keep them
-- briefly for re-confirm, then hard-delete (mirrors meal-photos / equipment-scans).
do $$ begin
  perform cron.schedule(
    'sahha-pantry-scans-ttl',
    '30 3 * * *',
    $cmd$
      delete from storage.objects
      where bucket_id = 'pantry-scans'
        and created_at < now() - interval '7 days';
    $cmd$
  );
exception when others then null; end $$;
