-- Supabase SQL: create a categories table and optionally link existing products to categories
-- Run this in Supabase SQL editor (Project -> SQL)
-- Adjust table names if your existing product tables are named differently.

-- 1) Ensure helper extension for UUIDs (pgcrypto) is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Create a simple categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Optional: create a unique slug index for nicer URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- 3) Grant read access to anon (so your frontend can fetch categories)
GRANT SELECT ON public.categories TO anon;

-- 4) (Optional) If you want the categories table selectable via PostgREST even when RLS is enabled,
-- create a permissive SELECT policy. If you do not use RLS, creating a policy is still safe.
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select_categories" ON public.categories
  FOR SELECT
  USING (true);

-- 5) Link categories to your existing products table(s).
-- This will add a nullable category_id foreign key to an existing table named `products`.
-- NOTE: Run this only if you have a table named `products` and you want to add the FK.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid;

ALTER TABLE public.products
  ADD CONSTRAINT IF NOT EXISTS products_category_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- If you also want to support product2 and product3, run the same for them:
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

-- 6) Optional: populate a few categories (example)
INSERT INTO public.categories (name, slug, description)
VALUES
  ('Phones', 'phones', 'Smartphones and feature phones')
, ('Laptops', 'laptops', 'Laptops and notebooks')
, ('Tablets', 'tablets', 'Tablets and e-readers')
ON CONFLICT (slug) DO NOTHING;

-- 7) Optional: example of adding a product that links to a category (adjust column names to match your products table)
-- Attempt to find a category id for 'Phones'
WITH cat AS (
  SELECT id FROM public.categories WHERE slug = 'phones' LIMIT 1
)
INSERT INTO public.products (id, name, price, image_url, description, stock, category, category_id, created_at)
SELECT gen_random_uuid(), 'Example Phone Model X', 120000, 'https://example.com/images/phone.png', 'Example phone description', 10, 'Phones', cat.id, now()
FROM cat
ON CONFLICT DO NOTHING;

-- 8) Optional: repeat inserting into product2/product3 similarly if you prefer them linked to categories.

-- 9) Verify: run
-- SELECT * FROM public.categories LIMIT 20;
-- SELECT * FROM public.products LIMIT 5;

-- Notes:
-- - If your product tables use different column names, adapt the ALTER/INSERT statements accordingly.
-- - If you prefer to keep a free-text `category` column (for backwards compatibility), the script leaves that column intact and only adds category_id as an optional FK.
-- - Row Level Security: the policy above allows public SELECT on categories. If you want stricter control, remove the policy and implement targeted RLS policies.
