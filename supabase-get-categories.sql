-- SQL: create a SECURITY DEFINER RPC to return distinct categories from three product tables
-- Run this in your Supabase SQL editor (Project -> SQL)
-- After running, grant EXECUTE to the anon role so the frontend can call it.

CREATE OR REPLACE FUNCTION public.get_all_categories()
RETURNS TABLE(category text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT TRIM(c) AS category FROM (
    -- Use to_jsonb->> to safely extract keys even if columns don't exist
    SELECT unnest(string_to_array(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')), ',')) AS c
    FROM public.products p
    WHERE (to_jsonb(p)->>'category') IS NOT NULL OR (to_jsonb(p)->>'categories') IS NOT NULL OR (to_jsonb(p)->>'category_name') IS NOT NULL OR (to_jsonb(p)->>'cat') IS NOT NULL

    UNION ALL

    SELECT unnest(string_to_array(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')), ',')) AS c
    FROM public.product2 p
    WHERE (to_jsonb(p)->>'category') IS NOT NULL OR (to_jsonb(p)->>'categories') IS NOT NULL OR (to_jsonb(p)->>'category_name') IS NOT NULL OR (to_jsonb(p)->>'cat') IS NOT NULL

    UNION ALL

    SELECT unnest(string_to_array(COALESCE((to_jsonb(p)->>'category'), (to_jsonb(p)->>'categories'), (to_jsonb(p)->>'category_name'), (to_jsonb(p)->>'cat')), ',')) AS c
    FROM public.product3 p
    WHERE (to_jsonb(p)->>'category') IS NOT NULL OR (to_jsonb(p)->>'categories') IS NOT NULL OR (to_jsonb(p)->>'category_name') IS NOT NULL OR (to_jsonb(p)->>'cat') IS NOT NULL
  ) sub
  WHERE TRIM(c) <> '';
$$;

-- Make it callable by the public/anon role
GRANT EXECUTE ON FUNCTION public.get_all_categories() TO anon;

-- Optional: verify with
-- SELECT * FROM public.get_all_categories();

-- Security note: SECURITY DEFINER causes the function to run with the owner's privileges; ensure the function only returns safe public data.
