-- Restrict anon column access on properties
REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id, title, building_name, address, district, type, room_type, unit_number,
  area, floor, deposit, monthly, manage_fee, build_year, total_floors,
  available_from, elevator, parking, images, lot_number, dong, registered_date,
  status, is_hot, is_new, lng, lat, description, agent_name, options,
  vacate_date, views, updated_at, created_at, registered_by
) ON public.properties TO anon;

-- Restrict anon column access on agent_profiles
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, user_id, name, phone, agency_name, license_number, agency_address,
  agency_phone, representative_name, member_type, created_at, updated_at
) ON public.agent_profiles TO anon;

-- Restrict anon column access on public_record_summary (hide memo)
REVOKE SELECT ON public.public_record_summary FROM anon;
GRANT SELECT (
  id, property_id, land_area, land_category, building_approval_date,
  building_floors, building_total_area, building_main_purpose,
  building_register_url, land_address, land_register_url, land_use_zone,
  created_at, updated_at
) ON public.public_record_summary TO anon;