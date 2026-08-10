ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS generation text,
  ADD COLUMN IF NOT EXISTS field text,
  ADD COLUMN IF NOT EXISTS daily_goal_minutes integer NOT NULL DEFAULT 120;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'general';

CREATE TABLE IF NOT EXISTS public.study_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  subject text,
  duration_minutes integer NOT NULL DEFAULT 25,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_tasks TO authenticated;
GRANT ALL ON public.study_tasks TO service_role;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.study_tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER study_tasks_updated BEFORE UPDATE ON public.study_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own achievements select" ON public.user_achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own achievements insert" ON public.user_achievements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);