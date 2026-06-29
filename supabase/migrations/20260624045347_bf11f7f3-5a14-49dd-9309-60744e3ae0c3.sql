-- 게스트 ↔ 담당자 채팅 메시지 (guest_inquiries 기반)
CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.guest_inquiries(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user','agent')),
  sender_user_id uuid NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_id ON public.inquiry_messages(inquiry_id, created_at);

-- Grants: anon can read & insert (UUID inquiry_id functions as capability token)
GRANT SELECT, INSERT ON public.inquiry_messages TO anon;
GRANT SELECT, INSERT ON public.inquiry_messages TO authenticated;
GRANT ALL ON public.inquiry_messages TO service_role;

ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

-- 누구나(anon 포함) 메시지 SELECT — inquiry_id(UUID) 자체가 capability token
CREATE POLICY "anyone can read inquiry messages"
ON public.inquiry_messages FOR SELECT
USING (true);

-- anon: sender_role='user' 로만 insert 가능
CREATE POLICY "anyone can post user message"
ON public.inquiry_messages FOR INSERT
WITH CHECK (sender_role = 'user');

-- 담당 중개사/관리자: sender_role='agent' 로 insert 가능
CREATE POLICY "agent or admin can post agent message"
ON public.inquiry_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_role = 'agent'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.guest_inquiries gi
      WHERE gi.id = inquiry_id AND gi.agent_user_id = auth.uid()
    )
  )
);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_messages;
ALTER TABLE public.inquiry_messages REPLICA IDENTITY FULL;

-- 담당자 응답 시 알림 갱신
CREATE OR REPLACE FUNCTION public.notify_on_inquiry_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _agent uuid;
  _reg_no text;
  _dong text;
  _lot text;
  _addr text;
  _prefix text;
  _name text;
BEGIN
  SELECT agent_user_id, property_reg_no, name
    INTO _agent, _reg_no, _name
  FROM public.guest_inquiries WHERE id = NEW.inquiry_id;

  IF NEW.sender_role = 'user' AND _agent IS NOT NULL THEN
    -- 게스트의 새 메시지 → 담당자에게 알림
    SELECT p.dong, p.lot_number INTO _dong, _lot
    FROM public.guest_inquiries gi
    LEFT JOIN public.properties p ON p.id = gi.property_id
    WHERE gi.id = NEW.inquiry_id;
    _addr := NULLIF(btrim(concat_ws(' ', _dong, _lot)), '');
    _prefix := NULLIF(btrim(
      CASE WHEN _reg_no IS NOT NULL AND _reg_no <> '' THEN '[NO.' || _reg_no || '] ' ELSE '' END
      || COALESCE(_addr, '')
    ), '');

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      _agent,
      'guest_inquiry',
      '게스트가 새 메시지를 보냈습니다',
      CASE WHEN _prefix IS NOT NULL THEN _prefix || ' — ' ELSE '' END
        || COALESCE(_name, '게스트') || ': '
        || LEFT(COALESCE(NEW.content, ''), 120),
      '/notifications?inquiry=' || NEW.inquiry_id::text
    );

    UPDATE public.guest_inquiries
      SET is_read = false
      WHERE id = NEW.inquiry_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_inquiry_message ON public.inquiry_messages;
CREATE TRIGGER trg_notify_on_inquiry_message
AFTER INSERT ON public.inquiry_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_inquiry_message();