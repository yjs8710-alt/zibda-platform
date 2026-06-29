
-- 1) agent_profiles: revoke broad anon SELECT, grant only public-safe columns
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, user_id, name, agency_name, license_number, agency_address,
  agency_phone, representative_name, member_type, phone, created_at, updated_at
) ON public.agent_profiles TO anon;

-- 2) properties: revoke broad anon SELECT, grant only public-safe columns
REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id, title, type, district, address, building_name, unit_number, room_type,
  area, floor, deposit, monthly, manage_fee, parking, elevator, available_from,
  total_floors, build_year, description, options, vacate_date, lat, lng,
  views, is_new, is_hot, images, lot_number, dong, agent_name,
  registered_by, registered_date, status, created_at, updated_at
) ON public.properties TO anon;

-- 3) page_views: prevent anon from attaching a user_id
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anon can insert anonymous page views"
  ON public.page_views FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Authenticated can insert own page views"
  ON public.page_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 4) storage: enforce ownership on property-images UPDATE
DROP POLICY IF EXISTS "Approved agents can update property-images" ON storage.objects;
CREATE POLICY "Approved agents can update own property-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-images'
    AND owner = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE user_id = auth.uid() AND status = 'approved' AND is_active = true
    )
  )
  WITH CHECK (
    bucket_id = 'property-images'
    AND owner = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE user_id = auth.uid() AND status = 'approved' AND is_active = true
    )
  );
