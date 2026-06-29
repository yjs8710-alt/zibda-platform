
-- 1. property-images 퍼블릭 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 버킷 RLS 정책: 누구나 읽기 가능
CREATE POLICY "property-images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

-- 3. 관리자만 업로드/삭제 가능
CREATE POLICY "property-images admin insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "property-images admin delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 4. properties 테이블에 images 컬럼 추가 (URL 배열)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
