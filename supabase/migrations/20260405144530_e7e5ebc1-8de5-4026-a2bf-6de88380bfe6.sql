DELETE FROM building_summary WHERE property_id IN (
  SELECT id::text FROM properties WHERE address LIKE '%개신동%41-5%'
);