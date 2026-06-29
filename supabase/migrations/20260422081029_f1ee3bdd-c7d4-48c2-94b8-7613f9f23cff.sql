-- 1) 허용 PC IP 컬럼 추가 (NULL이면 IP 제한 없음)
ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS allowed_pc_ip text;

-- 2) PC IP 검증 함수: 허용 IP가 설정되어 있고 현재 IP와 다르면 false
CREATE OR REPLACE FUNCTION public.verify_pc_ip(_ip_address text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed text;
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  -- 관리자는 IP 제한 면제
  SELECT public.has_role(_uid, 'admin'::app_role) INTO _is_admin;
  IF _is_admin THEN RETURN true; END IF;

  SELECT allowed_pc_ip INTO _allowed
  FROM public.agent_profiles
  WHERE user_id = _uid;

  -- 허용 IP가 설정되지 않았다면 통과 (제한 없음)
  IF _allowed IS NULL OR length(trim(_allowed)) = 0 THEN
    RETURN true;
  END IF;

  IF _ip_address IS NULL THEN RETURN false; END IF;

  RETURN trim(_allowed) = trim(_ip_address);
END;
$$;