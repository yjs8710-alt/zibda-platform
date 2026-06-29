
-- 1. Restrict public access on properties + safe public view
DROP POLICY IF EXISTS "Public can view active properties" ON public.properties;

CREATE OR REPLACE VIEW public.public_properties
WITH (security_invoker = false) AS
SELECT
  id, title, building_name, address, type, room_type, area, floor, total_floors,
  deposit, monthly, manage_fee, parking, elevator, available_from, build_year,
  description, images, options, is_new, is_hot, registered_date, registered_by,
  lat, lng, status
FROM public.properties
WHERE status = 'active';

GRANT SELECT ON public.public_properties TO anon, authenticated;

-- 2. Restrict public access on agent_profiles + safe public view
DROP POLICY IF EXISTS "Public can view active approved agent profiles" ON public.agent_profiles;

CREATE OR REPLACE VIEW public.public_agent_profiles
WITH (security_invoker = false) AS
SELECT
  user_id, name, agency_name, agency_address, agency_phone, phone,
  license_number, member_type, representative_name
FROM public.agent_profiles
WHERE status = 'approved' AND is_active = true;

GRANT SELECT ON public.public_agent_profiles TO anon, authenticated;

-- 3. Fix notifications INSERT to only allow self or admin
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Users or admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Replace license_number-based memo sharing with parent_user_id (office) relationship
DROP POLICY IF EXISTS "Same office members can view memos" ON public.property_user_memos;
CREATE POLICY "Same office members can view memos"
ON public.property_user_memos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.agent_profiles me
    JOIN public.agent_profiles writer ON
      COALESCE(me.parent_user_id, me.user_id) = COALESCE(writer.parent_user_id, writer.user_id)
    WHERE me.user_id = auth.uid()
      AND writer.user_id = property_user_memos.user_id
      AND me.is_active = true
      AND writer.is_active = true
      AND me.status = 'approved'
      AND writer.status = 'approved'
  )
);

-- 5. Lock down trigger-only SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.auto_link_parent_agent() FROM PUBLIC, anon, authenticated;
