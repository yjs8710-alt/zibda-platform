
-- cheongju_contacts에 (dong, lot_number, unit_number) unique constraint 추가
-- unit_number가 NULL인 경우도 단일 레코드로 취급 (NULLS NOT DISTINCT)
ALTER TABLE public.cheongju_contacts
  ADD CONSTRAINT cheongju_contacts_dong_lot_unit_unique
  UNIQUE NULLS NOT DISTINCT (dong, lot_number, unit_number);
