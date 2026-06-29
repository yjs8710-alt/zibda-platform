CREATE POLICY "Anyone can view active approved agent profiles"
ON public.agent_profiles
FOR SELECT
TO anon
USING (status = 'approved' AND is_active = true);