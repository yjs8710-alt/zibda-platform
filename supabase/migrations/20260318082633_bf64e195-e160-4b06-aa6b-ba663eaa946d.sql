-- cheongju_contacts에 호수(unit_number) 컬럼 추가
ALTER TABLE public.cheongju_contacts
  ADD COLUMN IF NOT EXISTS unit_number text DEFAULT NULL;

-- 인덱스: dong + lot_number + unit_number 조합 조회 최적화
CREATE INDEX IF NOT EXISTS idx_cheongju_contacts_unit
  ON public.cheongju_contacts (dong, lot_number, unit_number)
  WHERE unit_number IS NOT NULL;
