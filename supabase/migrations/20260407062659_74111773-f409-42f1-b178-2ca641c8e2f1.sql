-- 승인된 중개사도 property-images 버킷에 사진 업로드 가능
CREATE POLICY "approved_agents_insert_property_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM agent_profiles
    WHERE agent_profiles.user_id = auth.uid()
    AND agent_profiles.status = 'approved'
    AND agent_profiles.is_active = true
  )
);

-- 승인된 중개사도 본인이 업로드한 사진 삭제 가능
CREATE POLICY "approved_agents_delete_own_property_images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-images'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM agent_profiles
    WHERE agent_profiles.user_id = auth.uid()
    AND agent_profiles.status = 'approved'
    AND agent_profiles.is_active = true
  )
);