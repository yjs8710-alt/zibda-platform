
-- 1) Track logged-in member on guest inquiries (nullable for true guests)
ALTER TABLE public.guest_inquiries
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) RPC: agent/admin starts (or fetches) chat conversation tied to an inquiry
CREATE OR REPLACE FUNCTION public.start_chat_from_inquiry(_inquiry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inq RECORD;
  _conv_id uuid;
  _user_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, agent_user_id, property_id, name, phone, message
    INTO _inq
  FROM public.guest_inquiries
  WHERE id = _inquiry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found';
  END IF;

  -- Only the assigned agent or an admin may start the chat
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR _inq.agent_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Need a registered member to chat with (guests cannot receive in-app chat)
  IF _inq.user_id IS NULL THEN
    RAISE EXCEPTION 'guest_no_account';
  END IF;

  -- Reuse an existing conversation matching member + agent + property
  SELECT id INTO _conv_id
  FROM public.chat_conversations
  WHERE user_id = _inq.user_id
    AND ((_inq.agent_user_id IS NULL AND agent_user_id IS NULL)
         OR agent_user_id = _inq.agent_user_id)
    AND ((_inq.property_id IS NULL AND property_id IS NULL)
         OR property_id = _inq.property_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF _conv_id IS NULL THEN
    _user_name := COALESCE(NULLIF(btrim(_inq.name), ''), '회원') || ' (' || COALESCE(_inq.phone, '') || ')';
    INSERT INTO public.chat_conversations (user_id, user_name, agent_user_id, property_id, last_message, last_message_at)
    VALUES (_inq.user_id, _user_name, _inq.agent_user_id, _inq.property_id,
            LEFT(COALESCE(_inq.message, ''), 200), now())
    RETURNING id INTO _conv_id;

    -- Seed first message from inquirer so agent sees the original question
    IF _inq.message IS NOT NULL AND btrim(_inq.message) <> '' THEN
      INSERT INTO public.chat_messages (conversation_id, sender_id, sender_role, content)
      VALUES (_conv_id, _inq.user_id, 'user', _inq.message);
    END IF;
  END IF;

  RETURN _conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_chat_from_inquiry(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_chat_from_inquiry(uuid) TO authenticated;
