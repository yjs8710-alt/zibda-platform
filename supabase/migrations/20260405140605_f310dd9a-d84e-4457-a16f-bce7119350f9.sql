CREATE POLICY "Users can view own registered properties" ON public.properties
FOR SELECT TO authenticated
USING (registered_by = auth.uid());