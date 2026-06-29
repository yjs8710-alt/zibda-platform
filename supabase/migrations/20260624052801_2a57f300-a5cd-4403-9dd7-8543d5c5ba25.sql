CREATE OR REPLACE FUNCTION public.create_agent_profile_after_signup(_user_id uuid, _email text, _name text, _phone text, _agency_name text DEFAULT NULL::text, _agency_phone text DEFAULT NULL::text, _representative_name text DEFAULT NULL::text, _license_number text DEFAULT NULL::text, _business_number text DEFAULT NULL::text, _agency_address text DEFAULT NULL::text, _agree_marketing boolean DEFAULT false, _member_type text DEFAULT '대표중개사'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _normalized_type text;
  _status text;
BEGIN
  IF _user_id IS NULL OR _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'invalid signup request';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = _user_id
      AND u.created_at > now() - interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'signup user not found';
  END IF;

  _normalized_type := CASE
    WHEN _member_type IN ('대표중개사', '소속중개사', '중개보조원', '일반회원') THEN _member_type
    ELSE '대표중개사'
  END;

  -- 일반회원은 승인 절차 없이 즉시 활성화
  _status := CASE WHEN _normalized_type = '일반회원' THEN 'approved' ELSE 'pending' END;

  INSERT INTO public.agent_profiles (
    user_id, name, phone, agency_name, agency_phone, representative_name,
    license_number, business_number, agency_address, agree_marketing,
    member_type, status, is_active
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
    _normalized_type,
    _status,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_agent_profile_after_signup(uuid, text, text, text, text, text, text, text, text, text, boolean, text) TO anon, authenticated;