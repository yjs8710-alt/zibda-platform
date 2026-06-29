
-- 1. chat_conversations 확장
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS agent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unread_for_agent integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_agent ON public.chat_conversations(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_property ON public.chat_conversations(property_id);

-- 유니크 인덱스: user + agent + property (null 포함)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_chat_conv_user_agent_property
  ON public.chat_conversations(
    user_id,
    COALESCE(agent_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 2. 중개사용 RLS 정책 추가
DROP POLICY IF EXISTS "Agents can view conversations they are assigned to" ON public.chat_conversations;
CREATE POLICY "Agents can view conversations they are assigned to"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (agent_user_id = auth.uid());

DROP POLICY IF EXISTS "Agents can update assigned conversations" ON public.chat_conversations;
CREATE POLICY "Agents can update assigned conversations"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (agent_user_id = auth.uid())
  WITH CHECK (agent_user_id = auth.uid());

-- 3. chat_messages 정책: 담당 중개사 조회/생성
DROP POLICY IF EXISTS "Agents can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Agents can view messages in their conversations"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Agents can insert messages in their conversations" ON public.chat_messages;
CREATE POLICY "Agents can insert messages in their conversations"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.agent_user_id = auth.uid()
    )
  );

-- 4. 중개사 알림 트리거
CREATE OR REPLACE FUNCTION public.notify_agent_on_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agent uuid;
  _property uuid;
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

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    _agent,
    'chat_inquiry',
    '새 채팅 문의가 도착했습니다',
    LEFT(COALESCE(NEW.content, ''), 100),
    '/agent/chat'
  );

  UPDATE public.chat_conversations
  SET unread_for_agent = COALESCE(unread_for_agent, 0) + 1,
      last_message = LEFT(COALESCE(NEW.content, ''), 200),
      last_message_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agent_on_chat_message ON public.chat_messages;
CREATE TRIGGER trg_notify_agent_on_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_agent_on_chat_message();
