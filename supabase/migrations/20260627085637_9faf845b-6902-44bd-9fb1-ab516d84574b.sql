
CREATE OR REPLACE FUNCTION public.get_reference_images(_addresses text[])
 RETURNS TABLE(address text, unit_number text, room_type text, images text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 인증된 모든 사용자(중개사/관리자/일반회원) 허용
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.address,
    COALESCE(p.unit_number, '?') AS unit_number,
    COALESCE(p.room_type, '') AS room_type,
    p.images
  FROM public.properties p
  WHERE p.address = ANY(_addresses)
    AND p.images IS NOT NULL
    AND array_length(p.images, 1) > 0
  ORDER BY p.address, (p.status = 'active') DESC, p.updated_at DESC;
END;
$function$;
