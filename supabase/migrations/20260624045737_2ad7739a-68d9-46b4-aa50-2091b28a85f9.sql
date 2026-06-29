DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;

CREATE POLICY "Users can broadcast to their own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR realtime.topic() = ('notifications:' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'conversation:%'
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id::text = split_part(realtime.topic(), ':', 2)
        AND (c.user_id = auth.uid() OR c.agent_user_id = auth.uid())
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);