
CREATE OR REPLACE FUNCTION public.auto_link_parent_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 소속중개사 또는 중개보조원이 가입할 때, 같은 등록번호를 가진 대표중개사를 찾아 자동 연결
  IF NEW.member_type IN ('소속중개사', '중개보조원') AND NEW.parent_user_id IS NULL THEN
    SELECT user_id INTO NEW.parent_user_id
    FROM agent_profiles
    WHERE license_number = NEW.license_number
      AND member_type = '대표중개사'
      AND is_active = true
      AND user_id != NEW.user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_link_parent
BEFORE INSERT ON public.agent_profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_parent_agent();
