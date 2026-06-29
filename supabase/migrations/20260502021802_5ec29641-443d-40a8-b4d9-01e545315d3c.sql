-- Allow anonymous (public) users to view active properties for shared links
CREATE POLICY "Public can view active properties"
ON public.properties
FOR SELECT
TO anon
USING (status = 'active');