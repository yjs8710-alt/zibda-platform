
-- 1) agent_profiles 자격 인증 관련 컬럼을 일반회원도 가입할 수 있도록 nullable + 기본값 처리
ALTER TABLE public.agent_profiles
  ALTER COLUMN license_number DROP NOT NULL,
  ALTER COLUMN business_number DROP NOT NULL,
  ALTER COLUMN agency_name DROP NOT NULL,
  ALTER COLUMN agency_address DROP NOT NULL,
  ALTER COLUMN representative_name DROP DEFAULT;

ALTER TABLE public.agent_profiles
  ALTER COLUMN representative_name DROP NOT NULL;

-- 2) 일반회원도 본인 매물 등록/수정 가능하도록 RLS 정책 갱신
-- 기존 정책 유지하되, 일반회원(member_type='일반회원') 조건 추가
DROP POLICY IF EXISTS "Approved agents can insert properties" ON public.properties;
CREATE POLICY "Approved members can insert properties"
ON public.properties FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE user_id = auth.uid()
      AND status = 'approved'
      AND is_active = true
  )
);

DROP POLICY IF EXISTS "Approved agents can update own properties" ON public.properties;
CREATE POLICY "Approved members can update own properties"
ON public.properties FOR UPDATE TO authenticated
USING (
  registered_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE user_id = auth.uid()
      AND status = 'approved'
      AND is_active = true
  )
)
WITH CHECK (
  registered_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE user_id = auth.uid()
      AND status = 'approved'
      AND is_active = true
  )
);

-- (위 정책은 일반회원도 agent_profiles에 approved 상태로 들어가므로 그대로 매칭됨)

-- 3) 본인 매물 삭제 정책 추가 (일반회원 본인 매물 관리)
DROP POLICY IF EXISTS "Members can delete own properties" ON public.properties;
CREATE POLICY "Members can delete own properties"
ON public.properties FOR DELETE TO authenticated
USING (
  registered_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE user_id = auth.uid()
      AND status = 'approved'
      AND is_active = true
  )
);
