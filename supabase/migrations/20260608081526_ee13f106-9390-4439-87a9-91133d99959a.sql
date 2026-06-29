CREATE OR REPLACE FUNCTION public.get_public_property_reference_images(_property_id uuid)
 RETURNS TABLE(id uuid, unit_number text, floor text, room_type text, images text[], status text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _address text;
  _source_unit_num integer;
BEGIN
  SELECT p.address,
         NULLIF(regexp_replace(COALESCE(p.unit_number,''), '[^0-9]', '', 'g'), '')::integer
  INTO _address, _source_unit_num
  FROM public.properties p
  WHERE p.id = _property_id
    AND p.status = 'active';

  IF _address IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.unit_number,
    p.floor,
    p.room_type,
    p.images,
    p.status,
    p.updated_at
  FROM public.properties p
  WHERE p.address = _address
    AND p.id <> _property_id
    AND p.images IS NOT NULL
    AND array_length(p.images, 1) > 0
  ORDER BY
    CASE
      WHEN _source_unit_num IS NOT NULL
       AND NULLIF(regexp_replace(COALESCE(p.unit_number,''), '[^0-9]', '', 'g'), '') IS NOT NULL
      THEN abs(NULLIF(regexp_replace(COALESCE(p.unit_number,''), '[^0-9]', '', 'g'), '')::integer - _source_unit_num)
      ELSE 999999
    END ASC,
    (p.status = 'active') DESC,
    p.updated_at DESC
  LIMIT 30;
END;
$function$;