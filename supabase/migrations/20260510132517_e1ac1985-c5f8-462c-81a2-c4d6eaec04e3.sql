-- 시퀀스 생성
CREATE SEQUENCE IF NOT EXISTS public.property_reg_no_seq START 1;

-- reg_no 컬럼 추가
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS reg_no text;

-- 기존 매물에 reg_no 채우기 (created_at 순서대로)
DO $$
DECLARE
  r RECORD;
  n int := 1;
BEGIN
  FOR r IN SELECT id FROM public.properties WHERE reg_no IS NULL ORDER BY created_at ASC LOOP
    UPDATE public.properties SET reg_no = LPAD(n::text, 6, '0') WHERE id = r.id;
    n := n + 1;
  END LOOP;
  PERFORM setval('public.property_reg_no_seq', GREATEST(n, 1), false);
END $$;

-- 트리거 함수: 신규 INSERT 시 reg_no 자동 채우기
CREATE OR REPLACE FUNCTION public.set_property_reg_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reg_no IS NULL OR NEW.reg_no = '' THEN
    NEW.reg_no := LPAD(nextval('public.property_reg_no_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_property_reg_no ON public.properties;
CREATE TRIGGER trg_set_property_reg_no
BEFORE INSERT ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.set_property_reg_no();

-- 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_reg_no ON public.properties(reg_no);