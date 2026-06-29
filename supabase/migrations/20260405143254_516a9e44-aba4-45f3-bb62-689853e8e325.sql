DELETE FROM building_summary WHERE property_id IN (
  SELECT id::text FROM properties WHERE dong = '개신동' AND lot_number = '41-5'
) AND main_purpose IS NULL AND approval_date IS NULL;