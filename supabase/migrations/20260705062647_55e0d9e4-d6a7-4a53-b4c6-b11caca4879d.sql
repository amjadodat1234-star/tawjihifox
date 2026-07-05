
ALTER TABLE public.study_rooms
  ADD COLUMN IF NOT EXISTS timer_state text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS timer_mode text NOT NULL DEFAULT 'focus',
  ADD COLUMN IF NOT EXISTS timer_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS timer_paused_seconds_left integer,
  ADD COLUMN IF NOT EXISTS break_duration_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS focus_duration_minutes integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS invite_code text;

UPDATE public.study_rooms SET invite_code = substring(replace(gen_random_uuid()::text,'-','') from 1 for 8) WHERE invite_code IS NULL;
ALTER TABLE public.study_rooms ALTER COLUMN invite_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS study_rooms_invite_code_uniq ON public.study_rooms(invite_code);
ALTER TABLE public.study_rooms ALTER COLUMN invite_code SET DEFAULT substring(replace(gen_random_uuid()::text,'-','') from 1 for 8);

DROP POLICY IF EXISTS "owner sees members" ON public.room_members;
CREATE POLICY "owner sees members" ON public.room_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.study_rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid()));

DROP POLICY IF EXISTS "owner manages memberships" ON public.room_members;
CREATE POLICY "owner manages memberships" ON public.room_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.study_rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.study_rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid()));

DROP POLICY IF EXISTS "owner kicks members" ON public.room_members;
CREATE POLICY "owner kicks members" ON public.room_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.study_rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid()));

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.study_rooms; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.study_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_members REPLICA IDENTITY FULL;
ALTER TABLE public.room_messages REPLICA IDENTITY FULL;
