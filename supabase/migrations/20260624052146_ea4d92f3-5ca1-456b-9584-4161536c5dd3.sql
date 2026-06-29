REVOKE SELECT ON public.properties FROM anon;
REVOKE SELECT (note) ON public.properties FROM anon;

GRANT SELECT (
  id,
  title,
  building_name,
  address,
  district,
  type,
  room_type,
  unit_number,
  area,
  floor,
  deposit,
  monthly,
  manage_fee,
  parking,
  elevator,
  available_from,
  total_floors,
  build_year,
  description,
  vacate_date,
  options,
  views,
  lat,
  lng,
  is_new,
  is_hot,
  status,
  registered_date,
  checked_date,
  agent_name,
  created_at,
  updated_at,
  dong,
  lot_number,
  images,
  registered_by,
  reg_no
) ON public.properties TO anon;

GRANT SELECT (note) ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;