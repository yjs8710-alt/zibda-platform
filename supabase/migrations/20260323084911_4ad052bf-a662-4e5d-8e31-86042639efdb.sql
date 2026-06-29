
-- 건축물대장 요약 테이블
CREATE TABLE public.building_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id text NOT NULL,
  building_name text,
  main_purpose text,
  approval_date text,
  land_area text,
  building_area text,
  total_area text,
  floors_above text,
  floors_below text,
  parking_count text,
  elevator boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.building_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view building_summary"
  ON public.building_summary FOR SELECT
  USING (true);

CREATE POLICY "Admins can do everything on building_summary"
  ON public.building_summary FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_building_summary_updated_at
  BEFORE UPDATE ON public.building_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 토지대장 요약 테이블
CREATE TABLE public.land_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id text NOT NULL,
  lot_number text,
  land_category text,
  land_area text,
  official_price text,
  use_zone text,
  road_access text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.land_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view land_summary"
  ON public.land_summary FOR SELECT
  USING (true);

CREATE POLICY "Admins can do everything on land_summary"
  ON public.land_summary FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_land_summary_updated_at
  BEFORE UPDATE ON public.land_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
