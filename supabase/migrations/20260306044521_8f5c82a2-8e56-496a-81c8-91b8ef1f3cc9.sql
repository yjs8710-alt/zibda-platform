
-- 1. 매물 테이블 (properties) - 청주시 매물 등록/수정/노출종료 지원
CREATE TABLE public.properties (
  id          uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text    NOT NULL,
  building_name text,
  address     text    NOT NULL,
  district    text,           -- 청주시 구 (서원구, 흥덕구, 상당구, 청원구)
  type        text    NOT NULL,
  room_type   text,
  unit_number text,
  area        text    NOT NULL DEFAULT '',
  floor       text    NOT NULL DEFAULT '',
  deposit     text    NOT NULL DEFAULT '',
  monthly     text    NOT NULL DEFAULT '',
  manage_fee  text    NOT NULL DEFAULT '',
  parking     text    NOT NULL DEFAULT '',
  elevator    boolean NOT NULL DEFAULT false,
  available_from text NOT NULL DEFAULT '',
  total_floors text   NOT NULL DEFAULT '',
  build_year  text    NOT NULL DEFAULT '',
  description text    NOT NULL DEFAULT '',
  building_memo text,
  room_memo   text,
  note        text,
  vacate_date text,
  building_password text,
  room_password text,
  options     text[]  NOT NULL DEFAULT '{}',
  views       integer NOT NULL DEFAULT 0,
  lat         double precision NOT NULL DEFAULT 0,
  lng         double precision NOT NULL DEFAULT 0,
  is_new      boolean NOT NULL DEFAULT false,
  is_hot      boolean NOT NULL DEFAULT false,
  status      text    NOT NULL DEFAULT 'active',  -- active | hidden
  registered_date date NOT NULL DEFAULT CURRENT_DATE,
  checked_date date,
  agent_name  text    NOT NULL DEFAULT '',
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on properties"
  ON public.properties FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active properties"
  ON public.properties FOR SELECT
  USING (status = 'active');

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. 청주시 지역별 전화번호 테이블
CREATE TABLE public.cheongju_contacts (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  district    text NOT NULL,        -- 구 (서원구, 흥덕구, 상당구, 청원구)
  dong        text NOT NULL,        -- 동/읍/면
  phone       text NOT NULL DEFAULT '',  -- 대표 전화번호
  contact_owner text,               -- 건물주 전화
  contact_manager text,             -- 관리인 전화
  memo        text,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(district, dong)
);

ALTER TABLE public.cheongju_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on cheongju_contacts"
  ON public.cheongju_contacts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved agents can view cheongju_contacts"
  ON public.cheongju_contacts FOR SELECT
  USING (true);

CREATE TRIGGER update_cheongju_contacts_updated_at
  BEFORE UPDATE ON public.cheongju_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. 기본 청주시 지역 데이터 삽입
INSERT INTO public.cheongju_contacts (district, dong, phone) VALUES
  ('서원구', '사창동', ''),
  ('서원구', '성화동', ''),
  ('서원구', '개신동', ''),
  ('서원구', '분평동', ''),
  ('서원구', '모충동', ''),
  ('서원구', '수곡동', ''),
  ('흥덕구', '복대동', ''),
  ('흥덕구', '가경동', ''),
  ('흥덕구', '봉명동', ''),
  ('흥덕구', '강서동', ''),
  ('흥덕구', '신봉동', ''),
  ('상당구', '중앙동', ''),
  ('상당구', '탑동', ''),
  ('상당구', '율량동', ''),
  ('상당구', '용암동', ''),
  ('청원구', '율봉동', ''),
  ('청원구', '내덕동', ''),
  ('청원구', '우암동', '');
