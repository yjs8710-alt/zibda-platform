
-- 기존 restrictive 정책 삭제 후 permissive 정책으로 재생성
DROP POLICY IF EXISTS "Anyone can view visible cheongju_contacts" ON public.cheongju_contacts;
DROP POLICY IF EXISTS "Admins can do everything on cheongju_contacts" ON public.cheongju_contacts;

-- 일반/비로그인 사용자: is_visible=true 항목 조회 가능 (PERMISSIVE)
CREATE POLICY "Anyone can view visible cheongju_contacts"
  ON public.cheongju_contacts
  FOR SELECT
  USING (is_visible = true);

-- 관리자: 모든 작업 가능 (PERMISSIVE)
CREATE POLICY "Admins can do everything on cheongju_contacts"
  ON public.cheongju_contacts
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
