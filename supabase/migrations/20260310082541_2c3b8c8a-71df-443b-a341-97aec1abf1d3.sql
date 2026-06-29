
-- 기존 agent_profiles RLS 정책 모두 삭제 후 PERMISSIVE로 재생성
-- (기존 정책들이 RESTRICTIVE로 설정되어 관리자·일반 사용자 모두 조회 불가 문제 수정)

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.agent_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.agent_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.agent_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.agent_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.agent_profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.agent_profiles;

-- 일반 사용자: 자신의 프로필 조회 가능 (로그인 상태 확인용)
CREATE POLICY "Users can view own profile"
ON public.agent_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 일반 사용자: 자신의 프로필 삽입 가능 (회원가입시)
CREATE POLICY "Users can insert own profile"
ON public.agent_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 일반 사용자: 자신의 프로필 수정 가능
CREATE POLICY "Users can update own profile"
ON public.agent_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 관리자: 모든 프로필 조회 가능 (대시보드 회원 목록)
CREATE POLICY "Admins can view all profiles"
ON public.agent_profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 관리자: 모든 프로필 수정 가능 (승인/거절/차단)
CREATE POLICY "Admins can update all profiles"
ON public.agent_profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 관리자: 모든 프로필 삭제 가능
CREATE POLICY "Admins can delete all profiles"
ON public.agent_profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
