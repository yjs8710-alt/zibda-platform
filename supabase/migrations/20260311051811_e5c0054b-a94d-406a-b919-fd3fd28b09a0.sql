-- 승인된 중개사가 cheongju_contacts에 INSERT/UPDATE 할 수 있도록 정책 추가
CREATE POLICY "Approved agents can insert cheongju_contacts"
  ON public.cheongju_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE agent_profiles.user_id = auth.uid()
        AND agent_profiles.status = 'approved'
        AND agent_profiles.is_active = true
    )
  );

CREATE POLICY "Approved agents can update cheongju_contacts"
  ON public.cheongju_contacts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE agent_profiles.user_id = auth.uid()
        AND agent_profiles.status = 'approved'
        AND agent_profiles.is_active = true
    )
  );