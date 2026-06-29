-- 1) Remove permissive public SELECT
DROP POLICY IF EXISTS "anyone can read inquiry messages" ON public.inquiry_messages;

-- 2) Restrict direct SELECT to authenticated participants / admin
CREATE POLICY "participants can read inquiry messages"
ON public.inquiry_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.guest_inquiries gi
    WHERE gi.id = inquiry_messages.inquiry_id
      AND (gi.agent_user_id = auth.uid() OR gi.user_id = auth.uid())
  )
);

-- 3) Capability-token RPC: caller must know the inquiry UUID
CREATE OR REPLACE FUNCTION public.get_inquiry_messages(_inquiry_id uuid)
RETURNS TABLE (id uuid, sender_role text, content text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.sender_role, m.content, m.created_at
  FROM public.inquiry_messages m
  WHERE m.inquiry_id = _inquiry_id
  ORDER BY m.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_inquiry_messages(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_inquiry_messages(uuid) TO anon, authenticated;