
-- Staging table for bulk merge
CREATE TABLE IF NOT EXISTS public.cheongju_contacts_stage (
  district text,
  dong text,
  lot_number text,
  unit_number text,
  building_name text,
  owner_phones text,
  manager_phones text
);

ALTER TABLE public.cheongju_contacts_stage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert into stage" ON public.cheongju_contacts_stage;
CREATE POLICY "Anyone can insert into stage"
ON public.cheongju_contacts_stage
FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage stage" ON public.cheongju_contacts_stage;
CREATE POLICY "Admins manage stage"
ON public.cheongju_contacts_stage
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Merge function
CREATE OR REPLACE FUNCTION public.merge_cheongju_contacts_from_stage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  upd_count int;
  ins_count int;
BEGIN
  WITH src_norm AS (
    SELECT district, dong, lot_number, NULLIF(unit_number,'') AS unit_number, NULLIF(building_name,'') AS building_name,
           CASE WHEN owner_phones IS NULL OR owner_phones='' THEN ARRAY[]::text[] ELSE string_to_array(owner_phones,'|') END AS owners,
           CASE WHEN manager_phones IS NULL OR manager_phones='' THEN ARRAY[]::text[] ELSE string_to_array(manager_phones,'|') END AS managers
    FROM public.cheongju_contacts_stage
  ),
  upd AS (
    UPDATE public.cheongju_contacts c
    SET
      building_name = COALESCE(c.building_name, s.building_name),
      contact_manager = CASE WHEN COALESCE(array_length(s.managers,1),0) > 0 AND (c.contact_manager IS NULL OR c.contact_manager='') THEN s.managers[1] ELSE c.contact_manager END,
      phone = CASE WHEN (c.phone IS NULL OR c.phone='') AND COALESCE(array_length(s.owners,1),0) > 0 THEN s.owners[1] ELSE c.phone END,
      contact_owner = NULLIF((
        SELECT string_agg(p, ', ')
        FROM (
          SELECT DISTINCT ON (regexp_replace(p,'[^0-9]','','g')) p
          FROM unnest(ARRAY(SELECT trim(x) FROM unnest(COALESCE(string_to_array(c.contact_owner, ','), ARRAY[]::text[]) || s.owners) AS x WHERE trim(COALESCE(x,'')) <> '')) AS p
          WHERE regexp_replace(p,'[^0-9]','','g') <> regexp_replace(COALESCE(CASE WHEN (c.phone IS NULL OR c.phone='') AND COALESCE(array_length(s.owners,1),0) > 0 THEN s.owners[1] ELSE c.phone END, ''),'[^0-9]','','g')
        ) t
      ), ''),
      updated_at = now()
    FROM src_norm s
    WHERE c.district = s.district AND c.dong = s.dong AND c.lot_number = s.lot_number AND COALESCE(c.unit_number,'') = COALESCE(s.unit_number,'')
    RETURNING s.district AS d, s.dong AS dn, s.lot_number AS l, COALESCE(s.unit_number,'') AS u
  ),
  upd_summary AS (SELECT COUNT(*) cnt FROM upd),
  ins AS (
    INSERT INTO public.cheongju_contacts (district, dong, lot_number, unit_number, building_name, phone, contact_owner, contact_manager)
    SELECT s.district, s.dong, s.lot_number, s.unit_number, s.building_name,
      COALESCE(s.owners[1], ''),
      CASE WHEN COALESCE(array_length(s.owners,1),0) > 1 THEN array_to_string(s.owners[2:], ', ') ELSE NULL END,
      CASE WHEN COALESCE(array_length(s.managers,1),0) > 0 THEN s.managers[1] ELSE NULL END
    FROM src_norm s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cheongju_contacts c
      WHERE c.district = s.district AND c.dong = s.dong AND c.lot_number = s.lot_number AND COALESCE(c.unit_number,'') = COALESCE(s.unit_number,'')
    )
    RETURNING 1
  )
  SELECT (SELECT cnt FROM upd_summary), (SELECT COUNT(*) FROM ins) INTO upd_count, ins_count;

  -- Now dedupe phones across the whole table for already-existing rows that may have duplicates (same digits as phone)
  UPDATE public.cheongju_contacts c
  SET contact_owner = NULLIF((
    SELECT string_agg(p, ', ')
    FROM (
      SELECT DISTINCT ON (regexp_replace(p,'[^0-9]','','g')) p
      FROM unnest(string_to_array(c.contact_owner, ',')) AS p
      WHERE trim(COALESCE(p,'')) <> ''
        AND regexp_replace(p,'[^0-9]','','g') <> regexp_replace(COALESCE(c.phone,''),'[^0-9]','','g')
    ) t
  ), '')
  WHERE c.contact_owner IS NOT NULL AND c.contact_owner <> '';

  -- Clear stage
  TRUNCATE public.cheongju_contacts_stage;

  RETURN jsonb_build_object('updated', upd_count, 'inserted', ins_count);
END;
$$;
