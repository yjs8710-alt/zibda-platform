
-- 1. agent_profiles에 member_type 컬럼 추가 (대표중개사 / 소속중개사 / 중개보조원)
ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS member_type text NOT NULL DEFAULT '대표중개사';

-- 2. parent_user_id: 소속중개사·중개보조원이 대표중개사의 user_id를 참조
ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS parent_user_id uuid NULL;

-- 3. is_active: 사이트 접속 허용 여부 (false = 차단)
ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 4. member_type 유효값 제약
ALTER TABLE public.agent_profiles
  DROP CONSTRAINT IF EXISTS agent_profiles_member_type_check;
ALTER TABLE public.agent_profiles
  ADD CONSTRAINT agent_profiles_member_type_check
    CHECK (member_type IN ('대표중개사', '소속중개사', '중개보조원'));
