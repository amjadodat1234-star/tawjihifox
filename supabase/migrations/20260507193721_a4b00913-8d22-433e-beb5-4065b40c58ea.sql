
-- 1. App role enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles viewable by self or admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Update handle_new_user to also assign default role + admin for specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  IF NEW.email = 'amjadodat1234@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- If admin user already exists, grant role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'amjadodat1234@gmail.com'
ON CONFLICT DO NOTHING;

-- 3. Posts (forum)
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts readable by authenticated" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users or admin delete posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 4. Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users or admin delete comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 5. Notes
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'amber',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own notes" ON public.notes FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- 6. Suggestions
CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users insert suggestions" ON public.suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "users see own suggestions" ON public.suggestions FOR SELECT TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates suggestions" ON public.suggestions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin or owner delete suggestions" ON public.suggestions FOR DELETE TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));

-- 7. Study files (metadata; storage bucket separately)
CREATE TABLE public.study_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "files readable" ON public.study_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own files" ON public.study_files FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "users or admin delete files" ON public.study_files FOR DELETE TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));

-- Storage bucket for study files
INSERT INTO storage.buckets (id, name, public) VALUES ('study-files','study-files', true) ON CONFLICT DO NOTHING;
CREATE POLICY "study files publicly readable" ON storage.objects FOR SELECT USING (bucket_id='study-files');
CREATE POLICY "auth users upload study files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='study-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own study files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='study-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 8. Exam attempts
CREATE TABLE public.exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  year TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own attempts" ON public.exam_attempts FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- 9. Page visits (analytics)
CREATE TABLE public.page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  path TEXT NOT NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone insert visits" ON public.page_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "admin reads visits" ON public.page_visits FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 10. User streaks
CREATE TABLE public.user_streaks (
  user_id UUID PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_focus_date DATE,
  total_focus_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks readable by all auth" ON public.user_streaks FOR SELECT TO authenticated USING (true);
CREATE POLICY "users manage own streak" ON public.user_streaks FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- Function to update streak on focus session
CREATE OR REPLACE FUNCTION public.update_streak_on_focus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev_date DATE;
  cur_streak INTEGER;
  long_streak INTEGER;
BEGIN
  IF NEW.type <> 'focus' THEN RETURN NEW; END IF;
  SELECT last_focus_date, current_streak, longest_streak INTO prev_date, cur_streak, long_streak
  FROM public.user_streaks WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_focus_date, total_focus_minutes)
    VALUES (NEW.user_id, 1, 1, CURRENT_DATE, NEW.duration_minutes);
    RETURN NEW;
  END IF;
  IF prev_date = CURRENT_DATE THEN
    UPDATE public.user_streaks SET total_focus_minutes = total_focus_minutes + NEW.duration_minutes, updated_at = now() WHERE user_id = NEW.user_id;
  ELSIF prev_date = CURRENT_DATE - 1 THEN
    cur_streak := cur_streak + 1;
    IF cur_streak > long_streak THEN long_streak := cur_streak; END IF;
    UPDATE public.user_streaks SET current_streak = cur_streak, longest_streak = long_streak, last_focus_date = CURRENT_DATE, total_focus_minutes = total_focus_minutes + NEW.duration_minutes, updated_at = now() WHERE user_id = NEW.user_id;
  ELSE
    UPDATE public.user_streaks SET current_streak = 1, last_focus_date = CURRENT_DATE, total_focus_minutes = total_focus_minutes + NEW.duration_minutes, updated_at = now() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER focus_session_streak AFTER INSERT ON public.focus_sessions FOR EACH ROW EXECUTE FUNCTION public.update_streak_on_focus();

-- 11. Drop old tables (habits, tasks)
DROP TABLE IF EXISTS public.habit_logs CASCADE;
DROP TABLE IF EXISTS public.habits CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;

-- updated_at trigger for notes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
