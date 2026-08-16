create extension if not exists pgcrypto;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  source_recipe_id text not null unique,
  title text not null,
  image_url text,
  source_url text,
  source_name text not null default 'TheMealDB',
  calories numeric,
  carbs_g numeric,
  protein_g numeric,
  fat_g numeric,
  servings numeric,
  total_time_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric,
  unit text,
  raw_text text not null,
  primary key (recipe_id, ingredient_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.recipe_tags (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (recipe_id, tag_id)
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  meal_type text not null default 'dinner' check (meal_type = 'dinner'),
  unique (meal_plan_id, day_of_week, meal_type)
);

create index meal_plans_user_week_idx on public.meal_plans(user_id, week_start_date);
create index meal_plan_entries_plan_idx on public.meal_plan_entries(meal_plan_id);
create index recipe_tags_tag_idx on public.recipe_tags(tag_id);

alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.tags enable row level security;
alter table public.recipe_tags enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;

create policy "public catalog read" on public.recipes for select using (true);
create policy "public ingredient read" on public.ingredients for select using (true);
create policy "public recipe ingredient read" on public.recipe_ingredients for select using (true);
create policy "public tag read" on public.tags for select using (true);
create policy "public recipe tag read" on public.recipe_tags for select using (true);

create policy "users manage own plans" on public.meal_plans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "users manage entries on own plans" on public.meal_plan_entries for all to authenticated
  using (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and p.user_id = (select auth.uid())));

-- Run this in the Supabase SQL editor after deploying the function:
-- select cron.schedule('weekly-recipe-sync', '0 3 * * 1', $$
--   select net.http_post(url := 'https://<project-ref>.supabase.co/functions/v1/sync-recipes',
--     headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>'));
-- $$);
