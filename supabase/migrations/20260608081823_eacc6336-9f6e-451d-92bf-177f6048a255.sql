
-- 1) agent_profiles: prevent self-approval / role escalation via UPDATE
DROP POLICY IF EXISTS "Users can update own profile" ON public.agent_profiles;

CREATE POLICY "Users can update own profile"
ON public.agent_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IS NOT DISTINCT FROM (SELECT ap.status FROM public.agent_profiles ap WHERE ap.user_id = auth.uid())
  AND is_active IS NOT DISTINCT FROM (SELECT ap.is_active FROM public.agent_profiles ap WHERE ap.user_id = auth.uid())
  AND member_type IS NOT DISTINCT FROM (SELECT ap.member_type FROM public.agent_profiles ap WHERE ap.user_id = auth.uid())
  AND parent_user_id IS NOT DISTINCT FROM (SELECT ap.parent_user_id FROM public.agent_profiles ap WHERE ap.user_id = auth.uid())
  AND license_number IS NOT DISTINCT FROM (SELECT ap.license_number FROM public.agent_profiles ap WHERE ap.user_id = auth.uid())
);

-- Harden trigger as well (defense in depth)
CREATE OR REPLACE FUNCTION public.prevent_agent_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status := OLD.status; END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN NEW.is_active := OLD.is_active; END IF;
    IF NEW.member_type IS DISTINCT FROM OLD.member_type THEN NEW.member_type := OLD.member_type; END IF;
    IF NEW.parent_user_id IS DISTINCT FROM OLD.parent_user_id THEN NEW.parent_user_id := OLD.parent_user_id; END IF;
    IF NEW.license_number IS DISTINCT FROM OLD.license_number THEN NEW.license_number := OLD.license_number; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) realtime.messages: scope subscriptions to topics the user owns
DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;

CREATE POLICY "Users can subscribe to their own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'user:' || auth.uid()::text
  OR realtime.topic() = 'notifications:' || auth.uid()::text
  OR (
    realtime.topic() LIKE 'conversation:%'
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id::text = split_part(realtime.topic(), ':', 2)
        AND c.user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
