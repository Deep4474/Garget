-- supabase-create-product5.sql
-- SQL migration to create `product5` table for Supabase (Postgres)
-- This table uses a single `image_url` TEXT column for direct image links (no JSON arrays).

-- 1) Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Create product_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
    CREATE TYPE product_status AS ENUM ('draft','published','archived','out_of_stock');
  END IF;
END
$$;

-- 3) Create product5 table
CREATE TABLE IF NOT EXISTS public.product5 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  short_description text,
  price numeric(12,2) NOT NULL DEFAULT 0.00,
  currency char(3) NOT NULL DEFAULT 'USD',
  quantity integer NOT NULL DEFAULT 0,
  status product_status NOT NULL DEFAULT 'draft',
  category_id uuid,
  vendor_id uuid,
  image_url text,            -- single direct image link (string)
  metadata jsonb DEFAULT '{}'::jsonb,
  weight numeric(10,3),
  dimensions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Optional FK constraints (uncomment and adjust if you have these tables)
-- ALTER TABLE public.product5
--   ADD CONSTRAINT fk_product5_category FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
-- ALTER TABLE public.product5
--   ADD CONSTRAINT fk_product5_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;

-- 5) Indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_product5_name ON public.product5 USING gin (to_tsvector('english', coalesce(name, '')));
CREATE INDEX IF NOT EXISTS idx_product5_description ON public.product5 USING gin (to_tsvector('english', coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_product5_price ON public.product5 (price);
CREATE INDEX IF NOT EXISTS idx_product5_category_id ON public.product5 (category_id);
CREATE INDEX IF NOT EXISTS idx_product5_status ON public.product5 (status);

-- 6) Trigger to set updated_at timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON public.product5;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.product5
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- 7) Example seed data (use real image URLs in production)
INSERT INTO public.product5 (sku, name, slug, description, short_description, price, currency, quantity, status, image_url, metadata)
VALUES
  ('SKU-005', 'Example Smartphone Model Z', 'example-smartphone-model-z', 'A mid-range smartphone with OLED display, 128GB storage.', 'OLED • 128GB', 299.99, 'USD', 50, 'published', 'https://example.com/images/model-z-front.jpg', '{"color":["black","white"], "warranty":"12 months"}'),
  ('SKU-006', 'Example Headphones H1', 'example-headphones-h1', 'Over-ear Bluetooth headphones with noise cancellation.', 'Bluetooth • ANC', 79.99, 'USD', 120, 'published', 'https://example.com/images/headphones-h1.jpg', '{"color":["black"], "warranty":"6 months"}')
ON CONFLICT (sku) DO NOTHING;

-- 8) Example Row Level Security (RLS) policies for Supabase
-- NOTE: Supabase enables RLS for new tables by default in many setups. Adjust policies to your auth model.
-- Enable RLS (uncomment if you want to enable now)
-- ALTER TABLE public.product5 ENABLE ROW LEVEL SECURITY;

-- Allow anonymous (public) SELECT only if you want to expose products to unauthenticated users
-- CREATE POLICY "public_select_products" ON public.product5 FOR SELECT USING (true);

-- Allow authenticated users to insert (example)
-- CREATE POLICY "auth_insert_products" ON public.product5 FOR INSERT USING (auth.role() = 'authenticated');

-- Allow authenticated users to update their own vendor products (requires vendor_id to match auth.uid())
-- CREATE POLICY "vendor_update_own" ON public.product5 FOR UPDATE USING (auth.role() = 'authenticated' AND vendor_id = auth.uid());

-- 9) Quick check (optional) - uncomment to verify schema
-- SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product5' ORDER BY ordinal_position;

-- Migration note:
-- If you currently have JSON arrays in another table and want to migrate the first image into image_url:
-- UPDATE product5 SET image_url = (CASE
--   WHEN image_url IS NOT NULL AND image_url != '' THEN image_url
--   WHEN (images IS NOT NULL AND jsonb_typeof(images) = 'array') THEN images->>0
--   WHEN (image_urls IS NOT NULL AND jsonb_typeof(image_urls) = 'array') THEN image_urls->>0
--   ELSE NULL END)
-- ;

-- Done.
