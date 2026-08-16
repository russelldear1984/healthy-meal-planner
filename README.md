# Sproutly — Healthy Meal Planner

A local-first low-carb dinner planner built with React, Vite, Tailwind CSS, Supabase, and TheMealDB.

## Run locally

```bash
npm install
npm run dev
```

It starts in demo mode with sample TheMealDB recipes. To connect Supabase, copy `.env.example` to `.env.local` and add the project URL and anon key.

## Supabase setup

1. Create a Supabase project and run `supabase/migrations/20260816103000_initial_schema.sql` in its SQL editor (or deploy it with the Supabase CLI).
2. Enable Email magic-link sign-in and add `http://localhost:5173` to Auth redirect URLs.
3. Deploy `supabase/functions/sync-recipes`.
4. Set `THEMEALDB_API_KEY` as an Edge Function secret. Use a supporter key for public production use.
5. Configure the weekly scheduler SQL shown at the end of the migration, substituting your project reference and a secure function invocation credential.

The recipe importer only writes normalized data returned by TheMealDB and upserts on its stable meal ID. The low-carb candidate tag is a broad ingredient-based estimate, not medical or nutritional advice.
