
CREATE POLICY "Representatives can view sub-members"
ON public.agent_profiles
FOR SELECT
TO authenticated
USING (
  parent_user_id = auth.uid()
);
