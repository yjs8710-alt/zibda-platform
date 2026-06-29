-- 함수 자체는 디바이스 종류와 무관하게 IP만 비교하도록 그대로 두고
-- (이미 클라이언트에서 모바일/PC 모두 호출하도록 수정 예정)
-- 컬럼 명만 의미상 보존하기 위해 코멘트 추가
COMMENT ON COLUMN public.agent_profiles.allowed_pc_ip
  IS '접속 허용 IP (PC/모바일 공통, 1개). 비어있으면 제한 없음. 관리자는 면제.';

-- 검증 함수 재정의: 디바이스 무관, 관리자 면제, 허용 IP 비어있으면 통과
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

  SELECT public.has_role(_uid, 'admin'::app_role) INTO _is_admin;
  IF _is_admin THEN RETURN true; END IF;

  SELECT allowed_pc_ip INTO _allowed
  FROM public.agent_profiles
  WHERE user_id = _uid;

  IF _allowed IS NULL OR length(trim(_allowed)) = 0 THEN
    RETURN true; -- 미설정 = 제한 없음
  END IF;

  IF _ip_address IS NULL THEN RETURN false; END IF;

  RETURN trim(_allowed) = trim(_ip_address);
END;
$$;