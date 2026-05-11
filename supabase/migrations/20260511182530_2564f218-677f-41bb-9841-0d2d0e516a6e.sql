
-- Add parent_id to comments for replies
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id uuid;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);

-- Missions table
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  target_minutes int NOT NULL,
  done_minutes int NOT NULL DEFAULT 0,
  period text NOT NULL CHECK (period IN ('daily','weekly','monthly')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own missions"
ON public.missions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_missions_user_period ON public.missions(user_id, period, status);
