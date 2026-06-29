
-- 1) Restrict cheongju_contacts SELECT: remove public access, allow only approved agents/admins
DROP POLICY IF EXISTS "Anyone can view visible cheongju_contacts" ON public.cheongju_contacts;

CREATE POLICY "Approved agents and admins can view visible cheongju_contacts"
ON public.cheongju_contacts
FOR SELECT
TO authenticated
USING (
  is_visible = true AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE user_id = auth.uid()
        AND status = 'approved'
        AND is_active = true
    )
  )
);

-- 2) Revoke anon access to get_reference_images and add in-function caller check
REVOKE EXECUTE ON FUNCTION public.get_reference_images(text[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reference_images(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_reference_images(_addresses text[])
 RETURNS TABLE(address text, unit_number text, room_type text, images text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE user_id = auth.uid()
        AND status = 'approved'
        AND is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
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
END;
$function$;
