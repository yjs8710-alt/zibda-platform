ALTER TABLE public.agent_profiles DROP CONSTRAINT IF EXISTS agent_profiles_member_type_check;
ALTER TABLE public.agent_profiles ADD CONSTRAINT agent_profiles_member_type_check
  CHECK (member_type = ANY (ARRAY['대표중개사'::text, '소속중개사'::text, '중개보조원'::text, '일반회원'::text]));