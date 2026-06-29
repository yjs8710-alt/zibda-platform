ALTER TABLE public.user_active_sessions ADD COLUMN IF NOT EXISTS ip_address text;

CREATE OR REPLACE FUNCTION public.claim_device_slot(
  _device_type text,
  _device_id text,
  _user_agent text DEFAULT NULL,
  _ip_address text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _device_type NOT IN ('mobile','desktop') THEN RAISE EXCEPTION 'Invalid device type'; END IF;

  INSERT INTO public.user_active_sessions(user_id, device_type, device_id, user_agent, ip_address, last_seen_at)
  VALUES (_uid, _device_type, _device_id, _user_agent, _ip_address, now())
  ON CONFLICT (user_id, device_type)
  DO UPDATE SET device_id = EXCLUDED.device_id,
                user_agent = EXCLUDED.user_agent,
                ip_address = COALESCE(EXCLUDED.ip_address, public.user_active_sessions.ip_address),
                last_seen_at = now()
  RETURNING id INTO _row_id;

  RETURN _row_id;
END;
$$;