
-- 1) agent_profiles: column-level grants for anon
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, user_id, name, agency_name, agency_phone, license_number,
  agency_address, member_type, representative_name, phone, created_at, updated_at
) ON public.agent_profiles TO anon;

-- 2) properties: column-level grants for anon (exclude room_password, building_password, note, building_memo, room_memo, checked_date, reg_no)
REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id, title, address, building_name, type, district, room_type, unit_number,
  area, floor, deposit, monthly, manage_fee, parking, elevator, available_from,
  total_floors, build_year, description, options, lat, lng, views, is_new, is_hot,
  registered_date, status, images, agent_name, dong, lot_number, registered_by,
  vacate_date, created_at, updated_at
) ON public.properties TO anon;

-- 3) jlbda storage bucket: explicit admin-only access policies
DROP POLICY IF EXISTS "Admins read jlbda" ON storage.objects;
DROP POLICY IF EXISTS "Admins insert jlbda" ON storage.objects;
DROP POLICY IF EXISTS "Admins update jlbda" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete jlbda" ON storage.objects;

CREATE POLICY "Admins read jlbda" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'jlbda' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert jlbda" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'jlbda' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update jlbda" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'jlbda' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'jlbda' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete jlbda" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'jlbda' AND public.has_role(auth.uid(), 'admin'::public.app_role));
