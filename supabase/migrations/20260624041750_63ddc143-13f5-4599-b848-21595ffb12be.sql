
-- Fix 1: properties_passwords_in_note_anon_readable
-- Anonymous users could read landlord phone numbers stored in properties.note.
-- Revoke anonymous column-level SELECT on `note` so it is never exposed to anon.
REVOKE SELECT (note) ON public.properties FROM anon;

-- Fix 2: properties_passwords_column_grant_reliance
-- Defense-in-depth: explicitly revoke any anon access to password columns
-- (currently not granted, but lock this in so a future GRANT regression cannot
--  expose passwords) and provide a security-definer function for authorized
-- agents/admins to read passwords structurally rather than via column grants.
REVOKE SELECT (building_password, room_password) ON public.properties FROM anon;

CREATE OR REPLACE FUNCTION public.get_property_passwords(_property_id uuid)
RETURNS TABLE(building_password text, room_password text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR EXISTS (
       SELECT 1 FROM public.agent_profiles
       WHERE user_id = auth.uid()
         AND status = 'approved'
         AND is_active = true
     )
  THEN
    RETURN QUERY
      SELECT p.building_password, p.room_password
      FROM public.properties p
      WHERE p.id = _property_id;
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_property_passwords(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_property_passwords(uuid) TO authenticated;

-- Fix 3: realtime_conversation_agent_topic_gap
-- Allow assigned agents (chat_conversations.agent_user_id) to subscribe to
-- their conversation realtime topics, not only the conversation owner.
DROP POLICY IF EXISTS "Users can subscribe to their own realtime topics" ON realtime.messages;
CREATE POLICY "Users can subscribe to their own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || (auth.uid())::text)
  OR realtime.topic() = ('notifications:' || (auth.uid())::text)
  OR (
    realtime.topic() LIKE 'conversation:%'
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE (c.id)::text = split_part(realtime.topic(), ':', 2)
        AND (c.user_id = auth.uid() OR c.agent_user_id = auth.uid())
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
