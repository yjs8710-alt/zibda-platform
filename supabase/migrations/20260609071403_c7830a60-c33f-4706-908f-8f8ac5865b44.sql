CREATE OR REPLACE FUNCTION public.create_agent_profile_after_signup(
  _user_id uuid,
  _email text,
  _name text,
  _phone text,
  _agency_name text DEFAULT NULL,
  _agency_phone text DEFAULT NULL,
  _representative_name text DEFAULT NULL,
  _license_number text DEFAULT NULL,
  _business_number text DEFAULT NULL,
  _agency_address text DEFAULT NULL,
  _agree_marketing boolean DEFAULT false,
  _member_type text DEFAULT '대표중개사'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'invalid signup request';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) = lower(btrim(_email))
      AND u.created_at > now() - interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'signup user not found';
  END IF;

  INSERT INTO public.agent_profiles (
    user_id,
    name,
    phone,
    agency_name,
    agency_phone,
    representative_name,
    license_number,
    business_number,
    agency_address,
    agree_marketing,
    member_type,
    status,
    is_active
  ) VALUES (
    _user_id,
    btrim(_name),
    btrim(_phone),
    NULLIF(btrim(COALESCE(_agency_name, '')), ''),
    NULLIF(btrim(COALESCE(_agency_phone, '')), ''),
    NULLIF(btrim(COALESCE(_representative_name, '')), ''),
    NULLIF(btrim(COALESCE(_license_number, '')), ''),
    NULLIF(btrim(COALESCE(_business_number, '')), ''),
    NULLIF(btrim(COALESCE(_agency_address, '')), ''),
    COALESCE(_agree_marketing, false),
    CASE
      WHEN _member_type IN ('대표중개사', '소속중개사', '중개보조원', '일반회원') THEN _member_type
      ELSE '대표중개사'
    END,
    'pending',
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.create_agent_profile_after_signup(uuid, text, text, text, text, text, text, text, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_agent_profile_after_signup(uuid, text, text, text, text, text, text, text, text, text, boolean, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_agent_profile_after_signup(uuid, text, text, text, text, text, text, text, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_agent_profile_after_signup(uuid, text, text, text, text, text, text, text, text, text, boolean, text) TO service_role;