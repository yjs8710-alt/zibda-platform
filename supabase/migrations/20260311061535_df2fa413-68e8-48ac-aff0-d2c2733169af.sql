
-- property_reports INSERT: submitted_by가 NULL이어도 허용하도록 수정
-- 기존 INSERT 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Approved agents can insert property_reports" ON public.property_reports;

CREATE POLICY "Approved agents can insert property_reports"
  ON public.property_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE user_id = auth.uid() AND status = 'approved' AND is_active = true
    )
  );

-- admin도 INSERT할 수 있도록 별도 정책 (별도 admin insert 정책)
DROP POLICY IF EXISTS "Admins can insert property_reports" ON public.property_reports;

CREATE POLICY "Admins can insert property_reports"
  ON public.property_reports FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
