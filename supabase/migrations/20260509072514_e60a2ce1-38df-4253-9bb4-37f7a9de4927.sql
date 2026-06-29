
CREATE TABLE public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_user_id UUID,
  author_name TEXT NOT NULL DEFAULT '',
  author_agency TEXT NOT NULL DEFAULT '',
  is_admin_post BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved members and admins can view posts"
ON public.community_posts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM agent_profiles
    WHERE user_id = auth.uid() AND status = 'approved' AND is_active = true
  )
);

CREATE POLICY "Approved members and admins can insert posts"
ON public.community_posts FOR INSERT
TO authenticated
WITH CHECK (
  author_user_id = auth.uid() AND (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM agent_profiles
      WHERE user_id = auth.uid() AND status = 'approved' AND is_active = true
    )
  )
);

CREATE POLICY "Author or admin can update posts"
ON public.community_posts FOR UPDATE
TO authenticated
USING (author_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (author_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Author or admin can delete posts"
ON public.community_posts FOR DELETE
TO authenticated
USING (author_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
