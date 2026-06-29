DROP POLICY IF EXISTS "Author or admin can update posts" ON public.community_posts;

CREATE POLICY "Author or admin can update posts"
ON public.community_posts
FOR UPDATE
USING ((author_user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    author_user_id = auth.uid()
    AND is_admin_post = false
    AND pinned = false
  )
);