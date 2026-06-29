CREATE POLICY "Approved agents can update property-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE user_id = auth.uid()
      AND status = 'approved'
      AND is_active = true
  )
)
WITH CHECK (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE user_id = auth.uid()
      AND status = 'approved'
      AND is_active = true
  )
);