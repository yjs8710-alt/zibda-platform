
-- Allow approved agents to update their own properties
CREATE POLICY "Approved agents can update own properties"
ON public.properties
FOR UPDATE
TO authenticated
USING (
  registered_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM agent_profiles
    WHERE agent_profiles.user_id = auth.uid()
      AND agent_profiles.status = 'approved'
      AND agent_profiles.is_active = true
  )
)
WITH CHECK (
  registered_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM agent_profiles
    WHERE agent_profiles.user_id = auth.uid()
      AND agent_profiles.status = 'approved'
      AND agent_profiles.is_active = true
  )
);

-- Allow approved agents to delete their own properties
CREATE POLICY "Approved agents can delete own properties"
ON public.properties
FOR DELETE
TO authenticated
USING (
  registered_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM agent_profiles
    WHERE agent_profiles.user_id = auth.uid()
      AND agent_profiles.status = 'approved'
      AND agent_profiles.is_active = true
  )
);
