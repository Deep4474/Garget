-- Robust supabase SQL to create a categories table, add category_id FK to product tables,
-- populate categories from existing product text fields, and backfill product.category_id
-- Run this in Supabase -> SQL editor. Copy/paste the whole script and run once.

-- 0) Safety: create pgcrypto if not present for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create categories table (idempotent)
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  description text,
  image_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Unique index on slug for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- 2) Allow public selects (optional: if you use RLS you may need this policy)
GRANT SELECT ON public.categories TO anon;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'public_select_categories'
  ) THEN
    EXECUTE 'CREATE POLICY public_select_categories ON public.categories FOR SELECT USING (true)';
  END IF;
END$$;

-- 3) Add category_id columns to product tables (nullable) and FK constraints (idempotent)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE public.products
  ADD CONSTRAINT IF NOT EXISTS products_category_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.product2
  ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE public.product2
  ADD CONSTRAINT IF NOT EXISTS product2_category_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.product3
  ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE public.product3
  ADD CONSTRAINT IF NOT EXISTS product3_category_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- 4) Backfill categories table from existing product tables.
-- This extracts category-like values safely using to_jsonb->> so missing columns won't error.
-- It supports comma-separated category strings (splits by comma) and trims values.

INSERT INTO public.categories (name, slug)
SELECT DISTINCT trim(cat) AS name,
       regexp_replace(lower(trim(cat)), '\\s+', '-', 'g') AS slug
FROM (
  SELECT unnest(string_to_array(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')), ',')) AS cat
  FROM public.products p
  WHERE (to_jsonb(p)->>'category') IS NOT NULL OR (to_jsonb(p)->>'categories') IS NOT NULL OR (to_jsonb(p)->>'category_name') IS NOT NULL OR (to_jsonb(p)->>'cat') IS NOT NULL
  UNION ALL
  SELECT unnest(string_to_array(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')), ',')) AS cat
  FROM public.product2 p
  WHERE (to_jsonb(p)->>'category') IS NOT NULL OR (to_jsonb(p)->>'categories') IS NOT NULL OR (to_jsonb(p)->>'category_name') IS NOT NULL OR (to_jsonb(p)->>'cat') IS NOT NULL
  UNION ALL
  SELECT unnest(string_to_array(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')), ',')) AS cat
  FROM public.product3 p
  WHERE (to_jsonb(p)->>'category') IS NOT NULL OR (to_jsonb(p)->>'categories') IS NOT NULL OR (to_jsonb(p)->>'category_name') IS NOT NULL OR (to_jsonb(p)->>'cat') IS NOT NULL
) s
WHERE trim(cat) <> ''
ON CONFLICT (slug) DO NOTHING;

-- 5) Backfill slug for any categories that still have NULL slug
UPDATE public.categories
SET slug = regexp_replace(lower(trim(name)), '\\s+', '-', 'g')
WHERE slug IS NULL AND name IS NOT NULL;

-- 6) Update product tables to set category_id by matching category text to categories.name (case-insensitive)
-- We use the same to_jsonb extraction to find the source category text for each product row.

-- products
UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE lower(trim(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')))) = lower(trim(c.name))
  AND p.category_id IS NULL
  AND COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')) IS NOT NULL;

-- product2
UPDATE public.product2 p
SET category_id = c.id
FROM public.categories c
WHERE lower(trim(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')))) = lower(trim(c.name))
  AND p.category_id IS NULL
  AND COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')) IS NOT NULL;

-- product3
UPDATE public.product3 p
SET category_id = c.id
FROM public.categories c
WHERE lower(trim(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')))) = lower(trim(c.name))
  AND p.category_id IS NULL
  AND COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')) IS NOT NULL;

-- 7) Optional verification queries (run separately):
-- SELECT * FROM public.categories ORDER BY created_at DESC LIMIT 50;
-- SELECT id, name, category_id FROM public.products WHERE category_id IS NOT NULL LIMIT 20;
-- SELECT id, name, category_id FROM public.product2 WHERE category_id IS NOT NULL LIMIT 20;
-- SELECT id, name, category_id FROM public.product3 WHERE category_id IS NOT NULL LIMIT 20;

-- Script end.
