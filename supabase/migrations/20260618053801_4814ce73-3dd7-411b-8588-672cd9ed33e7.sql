
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, user_id, name, agency_name, agency_phone, representative_name,
  license_number, agency_address, member_type, created_at, updated_at
) ON public.agent_profiles TO anon;

REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id, title, building_name, address, district, type, room_type, unit_number, area, floor,
  deposit, monthly, manage_fee, parking, elevator, available_from, total_floors, build_year,
  description, vacate_date, options, views, lat, lng, is_new, is_hot, status,
  registered_date, checked_date, agent_name, created_at, updated_at, dong, lot_number,
  images, registered_by, reg_no, note
) ON public.properties TO anon;
