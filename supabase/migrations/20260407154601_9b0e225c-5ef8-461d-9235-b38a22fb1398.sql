
-- Second pass: sync build_year from newly fetched building_summary
UPDATE properties p
SET build_year = LEFT(bs.approval_date, 4)
FROM building_summary bs
WHERE bs.property_id = p.id::text
  AND (p.build_year IS NULL OR p.build_year = '')
  AND bs.approval_date IS NOT NULL
  AND bs.approval_date != ''
  AND LENGTH(bs.approval_date) >= 4;
