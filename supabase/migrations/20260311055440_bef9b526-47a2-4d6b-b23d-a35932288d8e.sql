
CREATE TABLE public.property_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id TEXT NOT NULL,
  property_title TEXT NOT NULL,
  property_address TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('error_report', 'deal_complete', 'rental_proposal')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  error_content TEXT,
  deal_date TEXT,
  deal_memo TEXT,
  proposer_name TEXT,
  proposer_phone TEXT,
  proposer_company TEXT,
  proposal_deposit TEXT,
  proposal_monthly TEXT,
  proposal_period TEXT,
  proposal_content TEXT,
  submitted_by UUID,
  admin_memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on property_reports"
  ON public.property_reports FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved agents can insert property_reports"
  ON public.property_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_profiles
      WHERE user_id = auth.uid() AND status = 'approved' AND is_active = true
    )
  );

CREATE POLICY "Agents can view own reports"
  ON public.property_reports FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_property_reports_updated_at
  BEFORE UPDATE ON public.property_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
