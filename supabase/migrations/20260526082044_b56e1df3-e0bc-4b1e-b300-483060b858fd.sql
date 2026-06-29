
DROP VIEW IF EXISTS public.public_properties;
DROP VIEW IF EXISTS public.public_agent_profiles;

CREATE POLICY "Public can view active properties"
ON public.properties
FOR SELECT
TO anon
USING (status = 'active');

CREATE POLICY "Public can view active approved agent profiles"
ON public.agent_profiles
FOR SELECT
TO anon
USING (status = 'approved' AND is_active = true);

-- properties: hide room_password, building_password, note, building_memo, room_memo, vacate_date, checked_date, reg_no, district from anon
REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id, title, building_name, address, type, room_type, unit_number, area,
  floor, deposit, monthly, manage_fee, parking, elevator, available_from,
  total_floors, build_year, description, options, views, lat, lng,
  is_new, is_hot, status, registered_date, agent_name, created_at, updated_at,
  dong, lot_number, images, registered_by
) ON public.properties TO anon;

-- agent_profiles: hide business_number, allowed_pc_ip, phone_verified*, parent_user_id, status, is_active, agree_marketing
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, user_id, name, phone, agency_name, license_number, agency_address,
  member_type, agency_phone, representative_name, created_at, updated_at
) ON public.agent_profiles TO anon;
