
-- 승인된 중개사(approved agent_profiles)가 매물을 직접 등록할 수 있도록 INSERT 정책 추가
CREATE POLICY "Approved agents can insert properties"
ON public.properties
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE user_id = auth.uid()
      AND status = 'approved'
      AND is_active = true
  )
);
