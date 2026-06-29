CREATE OR REPLACE FUNCTION public.get_public_property_reference_images(_property_id uuid)
RETURNS TABLE(
  id uuid,
  unit_number text,
  floor text,
  room_type text,
  images text[],
  status text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _address text;
BEGIN
  SELECT p.address INTO _address
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
    (p.status = 'active') DESC,
    COALESCE(NULLIF(regexp_replace(p.unit_number, '[^0-9]', '', 'g'), '')::integer, 999999),
    p.updated_at DESC
  LIMIT 30;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_property_reference_images(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_property_reference_images(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_property_reference_images(uuid) TO service_role;