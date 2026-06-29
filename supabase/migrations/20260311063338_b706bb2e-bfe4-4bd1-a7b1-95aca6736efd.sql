
-- 기존 INSERT 정책들 모두 제거 후 재생성
DROP POLICY IF EXISTS "Approved agents can insert property_reports" ON public.property_reports;
DROP POLICY IF EXISTS "Admins can insert property_reports" ON public.property_reports;

-- 로그인한 모든 사용자(승인 여부 무관)가 property_reports에 INSERT 가능
-- submitted_by는 null 허용이므로 비로그인도 별도 처리 필요
CREATE POLICY "Authenticated users can insert property_reports"
  ON public.property_reports FOR INSERT TO authenticated
  WITH CHECK (true);

-- 비로그인(anon) 사용자도 INSERT 허용 (오류제보, 임대제안서는 로그인 불필요)
CREATE POLICY "Anonymous users can insert property_reports"
  ON public.property_reports FOR INSERT TO anon
  WITH CHECK (true);
