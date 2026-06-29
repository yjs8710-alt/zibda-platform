-- 활성 디바이스 세션 관리 테이블
CREATE TABLE public.user_active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('mobile','desktop')),
  device_id text NOT NULL,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_type)
);

ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;

-- 본인 세션 조회/관리
CREATE POLICY "Users view own sessions"
ON public.user_active_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sessions"
ON public.user_active_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
ON public.user_active_sessions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own sessions"
ON public.user_active_sessions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 관리자는 전체 관리
CREATE POLICY "Admins manage all sessions"
ON public.user_active_sessions FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX idx_active_sessions_user ON public.user_active_sessions(user_id);

-- 디바이스 클레임 함수: 같은 슬롯의 기존 device_id를 새 값으로 덮어씀
-- 반환값: 클레임 후의 device_id (기존 클라이언트는 자기 device_id와 다르면 강제 로그아웃)
CREATE OR REPLACE FUNCTION public.claim_device_slot(
  _device_type text,
  _device_id text,
  _user_agent text DEFAULT NULL
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

  INSERT INTO public.user_active_sessions(user_id, device_type, device_id, user_agent, last_seen_at)
  VALUES (_uid, _device_type, _device_id, _user_agent, now())
  ON CONFLICT (user_id, device_type)
  DO UPDATE SET device_id = EXCLUDED.device_id,
                user_agent = EXCLUDED.user_agent,
                last_seen_at = now()
  RETURNING id INTO _row_id;

  RETURN _row_id;
END;
$$;

-- 현재 활성 device_id 검증 함수: 다르면 false
CREATE OR REPLACE FUNCTION public.verify_device_slot(
  _device_type text,
  _device_id text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _current text;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  SELECT device_id INTO _current
  FROM public.user_active_sessions
  WHERE user_id = _uid AND device_type = _device_type;
  RETURN _current IS NOT NULL AND _current = _device_id;
END;
$$;

-- 실시간 활성화 (다른 기기 강제 로그아웃 알림용)
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_active_sessions;
ALTER TABLE public.user_active_sessions REPLICA IDENTITY FULL;