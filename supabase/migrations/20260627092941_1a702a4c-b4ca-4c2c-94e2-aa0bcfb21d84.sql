DROP FUNCTION IF EXISTS public.get_reference_images(text[]);

CREATE FUNCTION public.get_reference_images(_addresses text[])
RETURNS TABLE(address text, unit_number text, room_type text, floor text, images text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 로그인 사용자는 기존처럼 요청 주소의 같은 건물 사진을 볼 수 있음.
  -- 게스트는 공개(active) 매물이 존재하는 주소에 한해서만 같은 주소의 사진을 볼 수 있음.
  RETURN QUERY
  SELECT
    p.address,
    COALESCE(p.unit_number, '?') AS unit_number,
    COALESCE(p.room_type, '') AS room_type,
    COALESCE(p.floor, '') AS floor,
    p.images
  FROM public.properties p
  WHERE p.address = ANY(_addresses)
    AND p.images IS NOT NULL
    AND array_length(p.images, 1) > 0
    AND (
      auth.uid() IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.properties active_p
        WHERE active_p.address = p.address
          AND active_p.status = 'active'
      )
    )
  ORDER BY p.address, (p.status = 'active') DESC, p.updated_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_reference_images(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_reference_images(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reference_images(text[]) TO service_role;