
-- 1. agent_profiles: revoke broad anon SELECT and grant only safe columns
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, user_id, name, phone, agency_name, license_number, agency_address,
  member_type, agency_phone, representative_name, created_at, updated_at
) ON public.agent_profiles TO anon;

-- 2. properties: revoke broad anon SELECT and grant only safe columns
REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (
  id, title, type, address, building_name, district, dong, lot_number, unit_number,
  room_type, area, floor, deposit, monthly, manage_fee, parking, elevator,
  available_from, total_floors, build_year, description, vacate_date, options,
  views, lat, lng, is_new, is_hot, agent_name, registered_by, images,
  registered_date, status, created_at, updated_at
) ON public.properties TO anon;

-- 3. Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.properties;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_active_sessions;

-- 4. Restrict realtime channel subscriptions to authenticated users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. property_reports: allow agents to update/delete their own submissions
DROP POLICY IF EXISTS "Agents can update own reports" ON public.property_reports;
CREATE POLICY "Agents can update own reports"
ON public.property_reports
FOR UPDATE
TO authenticated
USING (submitted_by = auth.uid())
WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "Agents can delete own reports" ON public.property_reports;
CREATE POLICY "Agents can delete own reports"
ON public.property_reports
FOR DELETE
TO authenticated
USING (submitted_by = auth.uid());
