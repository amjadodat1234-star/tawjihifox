-- Study rooms (live study groups with shared timer, presence, chat)
CREATE TABLE public.study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  max_members INT NOT NULL DEFAULT 20,
  timer_started_at TIMESTAMPTZ,
  timer_duration_minutes INT DEFAULT 25,
  timer_running BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_rooms TO authenticated;
GRANT SELECT ON public.study_rooms TO anon;
GRANT ALL ON public.study_rooms TO service_role;
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public rooms visible to all" ON public.study_rooms FOR SELECT USING (is_public = true OR auth.uid() = owner_id);
CREATE POLICY "owner inserts room" ON public.study_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates room" ON public.study_rooms FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner deletes room" ON public.study_rooms FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.study_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Room members: presence-lite + focus minutes contribution
CREATE TABLE public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  focus_minutes INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_members TO authenticated;
GRANT SELECT ON public.room_members TO anon;
GRANT ALL ON public.room_members TO service_role;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members visible to all" ON public.room_members FOR SELECT USING (true);
CREATE POLICY "join self" ON public.room_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update self" ON public.room_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "leave self" ON public.room_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Room chat messages
CREATE TABLE public.room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.room_messages TO authenticated;
GRANT SELECT ON public.room_messages TO anon;
GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages readable" ON public.room_messages FOR SELECT USING (true);
CREATE POLICY "send messages when member" ON public.room_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS(SELECT 1 FROM public.room_members WHERE room_id = room_messages.room_id AND user_id = auth.uid()));
CREATE POLICY "delete own messages" ON public.room_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;

CREATE INDEX idx_room_members_room ON public.room_members(room_id);
CREATE INDEX idx_room_messages_room ON public.room_messages(room_id, created_at DESC);