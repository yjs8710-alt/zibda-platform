CREATE OR REPLACE FUNCTION public.get_reference_images(_addresses text[])
RETURNS TABLE (
  address text,
  unit_number text,
  room_type text,
  images text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (p.address)
    p.address,
    COALESCE(p.unit_number, '?') AS unit_number,
    COALESCE(p.room_type, '') AS room_type,
    p.images
  FROM public.properties p
  WHERE p.address = ANY(_addresses)
    AND p.images IS NOT NULL
    AND array_length(p.images, 1) > 0
  ORDER BY p.address, (p.status = 'active') DESC, p.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_reference_images(text[]) TO anon, authenticated;