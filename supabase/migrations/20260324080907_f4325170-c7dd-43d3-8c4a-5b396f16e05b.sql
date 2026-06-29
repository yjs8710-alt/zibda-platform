-- 공시지가 없는 land_summary 행 삭제 → 다음 공적장부 열람 시 VWorld API로 재조회됨
DELETE FROM public.land_summary WHERE official_price IS NULL;