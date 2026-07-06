-- 1) DROP everything old
DROP TABLE IF EXISTS public.room_messages CASCADE;
DROP TABLE IF EXISTS public.room_members CASCADE;
DROP TABLE IF EXISTS public.study_rooms CASCADE;

-- 2) study_rooms
CREATE TABLE public.study_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  max_members INTEGER NOT NULL DEFAULT 20,
  invite_code TEXT NOT NULL UNIQUE DEFAULT substring(replace(gen_random_uuid()::text,'-','') from 1 for 8),
  focus_duration_minutes INTEGER NOT NULL DEFAULT 25,
  break_duration_minutes INTEGER NOT NULL DEFAULT 5,
  timer_state TEXT NOT NULL DEFAULT 'idle', -- idle|running|paused|break|finished
  timer_mode TEXT NOT NULL DEFAULT 'focus', -- focus|break
  timer_ends_at TIMESTAMPTZ,
  timer_paused_seconds_left INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_rooms TO authenticated;
GRANT ALL ON public.study_rooms TO service_role;

ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authed view public rooms or own" ON public.study_rooms
  FOR SELECT TO authenticated
  USING (is_public = true OR owner_id = auth.uid());
CREATE POLICY "owner inserts room" ON public.study_rooms
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates room" ON public.study_rooms
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner deletes room" ON public.study_rooms
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER trg_study_rooms_updated
  BEFORE UPDATE ON public.study_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) room_members
CREATE TABLE public.room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX idx_room_members_room ON public.room_members(room_id);
CREATE INDEX idx_room_members_user ON public.room_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_members TO authenticated;
GRANT ALL ON public.room_members TO service_role;

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper to avoid recursive RLS on room_members
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_owner(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_rooms WHERE id = _room_id AND owner_id = _user_id
  );
$$;

CREATE POLICY "members visible to same room" ON public.room_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_room_member(room_id, auth.uid())
    OR public.is_room_owner(room_id, auth.uid())
  );
CREATE POLICY "join self" ON public.room_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own membership" ON public.room_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "leave self or owner kick" ON public.room_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_owner(room_id, auth.uid()));

-- 4) room_messages
CREATE TABLE public.room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_room_messages_room ON public.room_messages(room_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_messages TO authenticated;
GRANT ALL ON public.room_messages TO service_role;

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages readable by members or owner" ON public.room_messages
  FOR SELECT TO authenticated
  USING (
    public.is_room_member(room_id, auth.uid())
    OR public.is_room_owner(room_id, auth.uid())
  );
CREATE POLICY "members send messages" ON public.room_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.is_room_member(room_id, auth.uid()) OR public.is_room_owner(room_id, auth.uid()))
  );
CREATE POLICY "delete own messages" ON public.room_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5) Enable realtime
ALTER TABLE public.study_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_members REPLICA IDENTITY FULL;
ALTER TABLE public.room_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.study_rooms;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;