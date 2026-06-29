CREATE OR REPLACE FUNCTION public.prevent_agent_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.admin_memo IS DISTINCT FROM OLD.admin_memo
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.admin_memo := OLD.admin_memo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_reports_prevent_status_change ON public.property_reports;
CREATE TRIGGER trg_property_reports_prevent_status_change
BEFORE UPDATE ON public.property_reports
FOR EACH ROW EXECUTE FUNCTION public.prevent_agent_status_change();