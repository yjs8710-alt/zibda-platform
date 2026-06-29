
-- 1. cheongju_contacts에 is_visible 컬럼 추가 (기본값 true = 노출)
ALTER TABLE public.cheongju_contacts
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

-- 2. 기존 데이터 모두 노출 상태로 초기화
UPDATE public.cheongju_contacts SET is_visible = true WHERE is_visible IS NULL;

-- 3. 기존 "Approved agents can view" 정책 삭제 후 재생성 (is_visible=true인 것만 노출)
DROP POLICY IF EXISTS "Approved agents can view cheongju_contacts" ON public.cheongju_contacts;

CREATE POLICY "Anyone can view visible cheongju_contacts"
  ON public.cheongju_contacts
  FOR SELECT
  USING (is_visible = true);
