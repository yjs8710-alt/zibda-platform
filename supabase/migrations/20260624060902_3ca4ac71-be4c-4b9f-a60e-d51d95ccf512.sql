CREATE OR REPLACE FUNCTION public.notify_on_inquiry_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _agent uuid;
  _user uuid;
  _reg_no text;
  _dong text;
  _lot text;
  _addr text;
  _prefix text;
  _name text;
BEGIN
  SELECT gi.agent_user_id, gi.user_id, gi.property_reg_no, gi.name
    INTO _agent, _user, _reg_no, _name
  FROM public.guest_inquiries gi WHERE gi.id = NEW.inquiry_id;

  SELECT p.dong, p.lot_number INTO _dong, _lot
  FROM public.guest_inquiries gi
  LEFT JOIN public.properties p ON p.id = gi.property_id
  WHERE gi.id = NEW.inquiry_id;
  _addr := NULLIF(btrim(concat_ws(' ', _dong, _lot)), '');
  _prefix := NULLIF(btrim(
    CASE WHEN _reg_no IS NOT NULL AND _reg_no <> '' THEN '[NO.' || _reg_no || '] ' ELSE '' END
    || COALESCE(_addr, '')
  ), '');

  IF NEW.sender_role = 'user' AND _agent IS NOT NULL THEN
    -- 게스트/회원의 새 메시지 → 담당자에게 알림
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      _agent,
      'guest_inquiry',
      '문의에 새 메시지가 도착했습니다',
      CASE WHEN _prefix IS NOT NULL THEN _prefix || ' — ' ELSE '' END
        || COALESCE(_name, '게스트') || ': '
        || LEFT(COALESCE(NEW.content, ''), 120),
      '/notifications?inquiry=' || NEW.inquiry_id::text
    );

    UPDATE public.guest_inquiries
      SET is_read = false
      WHERE id = NEW.inquiry_id;

  ELSIF NEW.sender_role = 'agent' AND _user IS NOT NULL THEN
    -- 담당자(중개사) 답변 → 문의자(회원)에게 알림
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      _user,
      'guest_inquiry',
      '담당자가 문의에 답변했습니다',
      CASE WHEN _prefix IS NOT NULL THEN _prefix || ' — ' ELSE '' END
        || LEFT(COALESCE(NEW.content, ''), 120),
      '/notifications?inquiry=' || NEW.inquiry_id::text
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_on_inquiry_message_trg ON public.inquiry_messages;
CREATE TRIGGER notify_on_inquiry_message_trg
AFTER INSERT ON public.inquiry_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_inquiry_message();