ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS generation text,
  ADD COLUMN IF NOT EXISTS field text,
  ADD COLUMN IF NOT EXISTS semester text;

ALTER TABLE public.study_tasks
  ADD COLUMN IF NOT EXISTS generation text,
  ADD COLUMN IF NOT EXISTS field text,
  ADD COLUMN IF NOT EXISTS session_minutes integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS long_break_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS done_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_done integer NOT NULL DEFAULT 0;

ALTER TABLE public.focus_sessions
  ADD COLUMN IF NOT EXISTS task_id uuid,
  ADD COLUMN IF NOT EXISTS generation text,
  ADD COLUMN IF NOT EXISTS field text;

CREATE INDEX IF NOT EXISTS idx_exam_attempts_cohort ON public.exam_attempts (generation, field, subject);
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_status ON public.study_tasks (user_id, status);
