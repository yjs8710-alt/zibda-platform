
-- 1) properties: 익명 SELECT 제거, 승인된 중개사/관리자만 활성 매물 조회 가능
DROP POLICY IF EXISTS "Anyone can view active properties" ON public.properties;

CREATE POLICY "Approved agents and admins can view active properties"
  ON public.properties
  FOR SELECT
  TO authenticated
  USING (
    status = 'active' AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.agent_profiles
        WHERE user_id = auth.uid()
          AND status = 'approved'
          AND is_active = true
      )
    )
  );

-- 2) property_reports: 인증 사용자 INSERT 시 submitted_by = auth.uid() 강제
DROP POLICY IF EXISTS "Authenticated users can insert property_reports" ON public.property_reports;

CREATE POLICY "Authenticated users can insert own property_reports"
  ON public.property_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- 익명 INSERT는 submitted_by가 NULL이어야만 허용 (사칭 방지)
DROP POLICY IF EXISTS "Anonymous users can insert property_reports" ON public.property_reports;

CREATE POLICY "Anonymous users can insert anonymous property_reports"
  ON public.property_reports
  FOR INSERT
  TO anon
  WITH CHECK (submitted_by IS NULL);
