DROP POLICY IF EXISTS "Anyone can view active approved agent profiles" ON public.agent_profiles;

CREATE POLICY "Public can view active approved agent profiles"
ON public.agent_profiles
FOR SELECT
TO public
USING (status = 'approved' AND is_active = true);