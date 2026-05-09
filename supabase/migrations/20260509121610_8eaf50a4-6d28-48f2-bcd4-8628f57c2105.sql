
-- Likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own likes" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own likes" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Posts new fields
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

-- Focus sessions new fields
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS task_name TEXT;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS completed BOOLEAN;

-- Posts viewable by anonymous (public read)
DROP POLICY IF EXISTS "posts readable by all" ON public.posts;
CREATE POLICY "posts readable by all" ON public.posts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "comments readable by all" ON public.comments;
CREATE POLICY "comments readable by all" ON public.comments FOR SELECT TO anon, authenticated USING (true);

-- Storage bucket for forum media
INSERT INTO storage.buckets (id, name, public) VALUES ('forum-media', 'forum-media', true)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "forum media public read" ON storage.objects FOR SELECT USING (bucket_id = 'forum-media');
CREATE POLICY "forum media auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'forum-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "forum media owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'forum-media' AND auth.uid()::text = (storage.foldername(name))[1]);
