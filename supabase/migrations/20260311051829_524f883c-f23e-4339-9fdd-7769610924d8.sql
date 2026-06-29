-- USING (true) 경고 해결: 승인된 중개사 업데이트 정책 교체
DROP POLICY IF EXISTS "Approved agents can update cheongju_contacts" ON public.cheongju_contacts;

CREATE POLICY "Approved agents can update cheongju_contacts"
  ON public.cheongju_contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE agent_profiles.user_id = auth.uid()
        AND agent_profiles.status = 'approved'
        AND agent_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE agent_profiles.user_id = auth.uid()
        AND agent_profiles.status = 'approved'
        AND agent_profiles.is_active = true
    )
  );