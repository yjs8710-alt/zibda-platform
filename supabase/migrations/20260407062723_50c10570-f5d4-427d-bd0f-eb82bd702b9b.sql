CREATE OR REPLACE FUNCTION public.update_property_images(
  _property_id uuid,
  _images text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 관리자 또는 승인된 중개사만 허용
  IF NOT (
    has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM agent_profiles
      WHERE user_id = auth.uid()
      AND status = 'approved'
      AND is_active = true
    )
  ) THEN
    RETURN false;
  END IF;

  UPDATE properties SET images = _images WHERE id = _property_id;
  RETURN true;
END;
$$;