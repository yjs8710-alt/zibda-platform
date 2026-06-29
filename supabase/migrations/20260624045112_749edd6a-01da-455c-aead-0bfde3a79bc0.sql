-- Revoke anon SELECT on properties.note (landlord phone exposure)
REVOKE SELECT (note) ON public.properties FROM anon;

-- Ensure authenticated and service_role retain access
GRANT SELECT (note) ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;