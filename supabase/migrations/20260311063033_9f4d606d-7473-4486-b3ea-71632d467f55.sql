
-- 기존 (district, dong) unique constraint 제거
ALTER TABLE public.cheongju_contacts DROP CONSTRAINT IF EXISTS cheongju_contacts_district_dong_key;

-- (dong, lot_number) 조합으로 unique constraint 추가 (번지수 포함한 정확한 식별)
ALTER TABLE public.cheongju_contacts ADD CONSTRAINT cheongju_contacts_dong_lot_key UNIQUE (dong, lot_number);
