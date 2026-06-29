
-- 1) 게스트가 활성 매물을 볼 수 있도록 SELECT 권한 복원 (이미 anon SELECT 정책 존재)
GRANT SELECT ON public.properties TO anon;

-- 2) 게스트 문의 테이블
CREATE TABLE IF NOT EXISTS public.guest_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  property_reg_no text,
  agent_user_id uuid,
  name text NOT NULL,
  phone text NOT NULL,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_inquiries TO authenticated;
GRANT INSERT ON public.guest_inquiries TO anon;
GRANT ALL ON public.guest_inquiries TO service_role;

ALTER TABLE public.guest_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create inquiry"
  ON public.guest_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(name)) > 0
    AND length(trim(phone)) >= 8
    AND length(trim(phone)) <= 20
    AND length(message) <= 2000
  );

CREATE POLICY "Agent or admin can view own inquiries"
  ON public.guest_inquiries FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR agent_user_id = auth.uid()
  );

CREATE POLICY "Agent or admin can update own inquiries"
  ON public.guest_inquiries FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR agent_user_id = auth.uid()
  );

CREATE POLICY "Admin can delete inquiries"
  ON public.guest_inquiries FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_guest_inquiries_agent ON public.guest_inquiries(agent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_inquiries_property ON public.guest_inquiries(property_id);

-- 3) 새 문의 시 담당자에게 알림 자동 생성
CREATE OR REPLACE FUNCTION public.notify_agent_on_guest_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agent uuid;
BEGIN
  -- 담당자 보정: agent_user_id 미지정 시 매물 등록자 사용
  IF NEW.agent_user_id IS NULL AND NEW.property_id IS NOT NULL THEN
    SELECT registered_by INTO _agent FROM public.properties WHERE id = NEW.property_id;
    NEW.agent_user_id := _agent;
  END IF;

  IF NEW.agent_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.agent_user_id,
      'guest_inquiry',
      '새 매물 문의가 도착했습니다',
      NEW.name || ' (' || NEW.phone || ') : ' || COALESCE(NULLIF(NEW.message,''), '문의 메시지 없음'),
      '/notifications'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guest_inquiry_notify ON public.guest_inquiries;
CREATE TRIGGER trg_guest_inquiry_notify
  BEFORE INSERT ON public.guest_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_agent_on_guest_inquiry();
