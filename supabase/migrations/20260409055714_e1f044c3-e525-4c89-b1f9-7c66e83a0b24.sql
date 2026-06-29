
-- 사용자별 매물 메모 테이블
CREATE TABLE public.property_user_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL,
  user_id uuid NOT NULL,
  memo_type text NOT NULL CHECK (memo_type IN ('building', 'room')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, user_id, memo_type)
);

-- Enable RLS
ALTER TABLE public.property_user_memos ENABLE ROW LEVEL SECURITY;

-- 본인 메모 읽기
CREATE POLICY "Users can view own memos"
ON public.property_user_memos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 같은 중개사무소 소속 회원 메모 읽기 (같은 license_number 기준)
CREATE POLICY "Same office members can view memos"
ON public.property_user_memos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agent_profiles my_profile
    JOIN agent_profiles writer_profile ON my_profile.license_number = writer_profile.license_number
    WHERE my_profile.user_id = auth.uid()
      AND writer_profile.user_id = property_user_memos.user_id
      AND my_profile.is_active = true
      AND writer_profile.is_active = true
  )
);

-- 관리자는 모든 메모 열람
CREATE POLICY "Admins can view all memos"
ON public.property_user_memos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 인증된 사용자 메모 작성
CREATE POLICY "Authenticated users can insert own memos"
ON public.property_user_memos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 본인 메모 수정
CREATE POLICY "Users can update own memos"
ON public.property_user_memos
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 본인 메모 삭제
CREATE POLICY "Users can delete own memos"
ON public.property_user_memos
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_property_user_memos_updated_at
BEFORE UPDATE ON public.property_user_memos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 인덱스
CREATE INDEX idx_property_user_memos_property ON public.property_user_memos (property_id);
CREATE INDEX idx_property_user_memos_user ON public.property_user_memos (user_id);
