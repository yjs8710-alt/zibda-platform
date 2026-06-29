-- 기존 (dong, lot_number) 유니크 제약 제거 (호수별 저장을 막는 원인)
ALTER TABLE public.cheongju_contacts
  DROP CONSTRAINT IF EXISTS cheongju_contacts_dong_lot_key;