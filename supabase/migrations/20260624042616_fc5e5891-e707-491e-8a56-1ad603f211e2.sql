
-- 게스트/회원 매물 문의 알림: 매물번호 + 주소(동/지번) + 이름(연락처):내용 형태로 본문 갱신
CREATE OR REPLACE FUNCTION public.notify_agent_on_guest_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agent uuid;
  _reg_no text;
  _dong text;
  _lot text;
  _addr text;
  _prefix text;
BEGIN
  IF NEW.agent_user_id IS NULL AND NEW.property_id IS NOT NULL THEN
    SELECT registered_by INTO _agent FROM public.properties WHERE id = NEW.property_id;
    NEW.agent_user_id := _agent;
  END IF;

  IF NEW.property_id IS NOT NULL THEN
    SELECT reg_no, dong, lot_number
      INTO _reg_no, _dong, _lot
    FROM public.properties WHERE id = NEW.property_id;
  END IF;

  _reg_no := COALESCE(NULLIF(_reg_no, ''), NULLIF(NEW.property_reg_no, ''));
  _addr   := NULLIF(btrim(concat_ws(' ', _dong, _lot)), '');
  _prefix := COALESCE(
    CASE WHEN _reg_no IS NOT NULL THEN '[NO.' || _reg_no || '] ' ELSE '' END
    || COALESCE(_addr, ''),
    ''
  );
  _prefix := NULLIF(btrim(_prefix), '');

  IF NEW.agent_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.agent_user_id,
      'guest_inquiry',
      '새 매물 문의가 도착했습니다',
      CASE WHEN _prefix IS NOT NULL THEN _prefix || ' — ' ELSE '' END
        || NEW.name || '(' || NEW.phone || '): '
        || COALESCE(NULLIF(NEW.message, ''), '문의 메시지 없음'),
      '/notifications?inquiry=' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 채팅 메시지(사용자 발신) 알림: 매물 정보 추가 + 링크에 대화ID 포함
CREATE OR REPLACE FUNCTION public.notify_agent_on_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agent uuid;
  _property uuid;
  _reg_no text;
  _dong text;
  _lot text;
  _prefix text;
BEGIN
  IF NEW.sender_role <> 'user' THEN
    RETURN NEW;
  END IF;

  SELECT agent_user_id, property_id INTO _agent, _property
  FROM public.chat_conversations
  WHERE id = NEW.conversation_id;

  IF _agent IS NULL THEN
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
    _agent,
    'chat_inquiry',
    '새 채팅 문의가 도착했습니다',
    CASE WHEN _prefix IS NOT NULL THEN _prefix || ' — ' ELSE '' END
      || LEFT(COALESCE(NEW.content, ''), 120),
    '/notifications?chat=' || NEW.conversation_id::text
  );

  UPDATE public.chat_conversations
  SET unread_for_agent = COALESCE(unread_for_agent, 0) + 1,
      last_message = LEFT(COALESCE(NEW.content, ''), 200),
      last_message_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;
