
-- Revoke anon SELECT on sensitive columns of agent_profiles
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, user_id, name, agency_name, license_number,
  agency_address, agency_phone, representative_name,
  member_type, parent_user_id, is_active, status,
  created_at, updated_at
) ON public.agent_profiles TO anon;

-- Revoke anon SELECT on sensitive columns of properties
REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id, reg_no, title, type, address, building_name, district, dong, lot_number,
  unit_number, room_type, area, floor, deposit, monthly, manage_fee,
  parking, elevator, available_from, total_floors, build_year, description,
  options, images, lat, lng, views, is_new, is_hot, status,
  registered_date, registered_by, agent_name, created_at, updated_at, vacate_date
) ON public.properties TO anon;
