
-- properties 테이블에 등록자 user_id 컬럼 추가
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS registered_by uuid NULL;

CREATE INDEX IF NOT EXISTS idx_properties_registered_by ON public.properties (registered_by);
