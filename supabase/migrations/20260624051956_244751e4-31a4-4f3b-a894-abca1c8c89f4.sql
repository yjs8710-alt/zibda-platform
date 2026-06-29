CREATE OR REPLACE FUNCTION public.notify_agent_on_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _agent uuid;
  _user uuid;
  _property uuid;
  _reg_no text;
  _dong text;
  _lot text;
  _prefix text;
  _target uuid;
  _title text;
BEGIN
  SELECT agent_user_id, user_id, property_id
    INTO _agent, _user, _property
  FROM public.chat_conversations
  WHERE id = NEW.conversation_id;

  IF NEW.sender_role = 'user' THEN
    _target := _agent;
    _title := '새 채팅 문의가 도착했습니다';
  ELSIF NEW.sender_role = 'agent' THEN
    _target := _user;
    _title := '담당자 답변이 도착했습니다';
  ELSE
    RETURN NEW;
  END IF;

  IF _target IS NULL THEN
    RETURN NEW;
  END IF;

  IF _property IS NOT NULL THEN
    SELECT reg_no, dong, lot_number INTO _reg_no, _dong, _lot
    FROM public.properties WHERE id = _property;
    _prefix := NULLIF(btrim(
      CASE WHEN _reg_no IS NOT NULL AND _reg_no <> '' THEN '[NO.' || _reg_no || '] ' ELSE '' END
      || COALESCE(NULLIF(btrim(concat_ws(' ', _dong, _lot)), ''), '')
    ), '');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    _target,
    'chat_inquiry',
    _title,
    CASE WHEN _prefix IS NOT NULL THEN _prefix || ' — ' ELSE '' END
      || LEFT(COALESCE(NEW.content, ''), 120),
    '/notifications?chat=' || NEW.conversation_id::text
  );

  UPDATE public.chat_conversations
  SET unread_for_agent = CASE WHEN NEW.sender_role = 'user' THEN COALESCE(unread_for_agent, 0) + 1 ELSE unread_for_agent END,
      unread_for_user = CASE WHEN NEW.sender_role = 'agent' THEN COALESCE(unread_for_user, 0) + 1 ELSE unread_for_user END,
      last_message = LEFT(COALESCE(NEW.content, ''), 200),
      last_message_at = now(),
      updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_agent_on_chat_message ON public.chat_messages;
CREATE TRIGGER trg_notify_agent_on_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_agent_on_chat_message();