
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 1) Extend study_rooms
ALTER TABLE public.study_rooms
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS end_time timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_message text,
  ADD COLUMN IF NOT EXISTS completed_sessions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- Enforce allowed states
DO $$ BEGIN
  ALTER TABLE public.study_rooms DROP CONSTRAINT IF EXISTS study_rooms_state_check;
  ALTER TABLE public.study_rooms ADD CONSTRAINT study_rooms_state_check
    CHECK (state IN ('created','active','locked','full','empty','ended','expired'));
END $$;

-- 2) room_tasks
CREATE TABLE IF NOT EXISTS public.room_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_tasks TO authenticated;
GRANT ALL ON public.room_tasks TO service_role;
ALTER TABLE public.room_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read tasks" ON public.room_tasks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_tasks.room_id AND rm.user_id = auth.uid()));

CREATE POLICY "owner insert tasks" ON public.room_tasks FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.study_rooms sr WHERE sr.id = room_id AND sr.owner_id = auth.uid()));

CREATE POLICY "owner update tasks" ON public.room_tasks FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.study_rooms sr WHERE sr.id = room_id AND sr.owner_id = auth.uid()));

CREATE POLICY "owner delete tasks" ON public.room_tasks FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.study_rooms sr WHERE sr.id = room_id AND sr.owner_id = auth.uid()));

-- 3) room_task_completions
CREATE TABLE IF NOT EXISTS public.room_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.room_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.room_task_completions TO authenticated;
GRANT ALL ON public.room_task_completions TO service_role;
ALTER TABLE public.room_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read completions" ON public.room_task_completions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.room_tasks t
  JOIN public.room_members rm ON rm.room_id = t.room_id
  WHERE t.id = task_id AND rm.user_id = auth.uid()
));

CREATE POLICY "self mark completion" ON public.room_task_completions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.room_tasks t
  JOIN public.room_members rm ON rm.room_id = t.room_id
  WHERE t.id = task_id AND rm.user_id = auth.uid()
));

CREATE POLICY "self unmark completion" ON public.room_task_completions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 4) Realtime
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='room_tasks';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_tasks'; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='room_task_completions';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_task_completions'; END IF;
END $$;

-- 5) Helper: refresh room state
CREATE OR REPLACE FUNCTION public.refresh_room_state(_room_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.study_rooms;
  member_count int;
  new_state text;
BEGIN
  SELECT * INTO r FROM public.study_rooms WHERE id = _room_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF r.state = 'ended' THEN RETURN r.state; END IF;

  SELECT count(*) INTO member_count FROM public.room_members WHERE room_id = _room_id;

  IF r.end_time IS NOT NULL AND now() > r.end_time THEN
    new_state := 'expired';
  ELSIF r.password_hash IS NOT NULL THEN
    new_state := 'locked';
  ELSIF member_count >= r.max_members THEN
    new_state := 'full';
  ELSIF member_count = 0 THEN
    new_state := 'empty';
  ELSE
    new_state := 'active';
  END IF;

  IF new_state <> r.state THEN
    UPDATE public.study_rooms SET state = new_state, updated_at = now() WHERE id = _room_id;
  END IF;
  RETURN new_state;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refresh_room_state(uuid) TO authenticated;

-- 6) join_room RPC
CREATE OR REPLACE FUNCTION public.join_room(_room_id uuid, _password text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.study_rooms;
  member_count int;
  already_member boolean;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT * INTO r FROM public.study_rooms WHERE id = _room_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id=_room_id AND user_id=uid) INTO already_member;

  IF r.state = 'ended' THEN RETURN jsonb_build_object('ok', false, 'reason', 'ended'); END IF;
  IF r.end_time IS NOT NULL AND now() > r.end_time THEN
    UPDATE public.study_rooms SET state='expired' WHERE id=_room_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF NOT already_member THEN
    -- password check
    IF r.password_hash IS NOT NULL AND r.owner_id <> uid THEN
      IF _password IS NULL OR _password = '' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'password_required');
      END IF;
      IF r.password_hash <> crypt(_password, r.password_hash) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_password');
      END IF;
    END IF;
    -- capacity
    SELECT count(*) INTO member_count FROM public.room_members WHERE room_id=_room_id;
    IF member_count >= r.max_members THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'full');
    END IF;
    INSERT INTO public.room_members (room_id, user_id) VALUES (_room_id, uid)
      ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;

  PERFORM public.refresh_room_state(_room_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_room(uuid, text) TO authenticated;

-- 7) Extend room
CREATE OR REPLACE FUNCTION public.extend_room(_room_id uuid, _add_minutes int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.study_rooms;
  new_end timestamptz;
  total_minutes int;
BEGIN
  SELECT * INTO r FROM public.study_rooms WHERE id=_room_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF r.owner_id <> auth.uid() THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_owner'); END IF;
  IF r.start_time IS NULL OR r.end_time IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_schedule');
  END IF;
  new_end := r.end_time + make_interval(mins => _add_minutes);
  total_minutes := EXTRACT(EPOCH FROM (new_end - r.start_time))/60;
  IF total_minutes > 360 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_6h');
  END IF;
  UPDATE public.study_rooms SET end_time = new_end, updated_at = now() WHERE id=_room_id;
  RETURN jsonb_build_object('ok', true, 'end_time', new_end);
END;
$$;
GRANT EXECUTE ON FUNCTION public.extend_room(uuid, int) TO authenticated;

-- 8) Set password (owner only)
CREATE OR REPLACE FUNCTION public.set_room_password(_room_id uuid, _password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.study_rooms;
BEGIN
  SELECT * INTO r FROM public.study_rooms WHERE id=_room_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason','not_found'); END IF;
  IF r.owner_id <> auth.uid() THEN RETURN jsonb_build_object('ok', false, 'reason','not_owner'); END IF;
  IF _password IS NULL OR _password = '' THEN
    UPDATE public.study_rooms SET password_hash = NULL, updated_at = now() WHERE id=_room_id;
  ELSE
    UPDATE public.study_rooms
      SET password_hash = crypt(_password, gen_salt('bf', 8)),
          is_public = false,
          updated_at = now()
      WHERE id=_room_id;
  END IF;
  PERFORM public.refresh_room_state(_room_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_room_password(uuid, text) TO authenticated;

-- 9) Owner kick
CREATE OR REPLACE FUNCTION public.kick_member(_room_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.study_rooms;
BEGIN
  SELECT * INTO r FROM public.study_rooms WHERE id=_room_id;
  IF r.owner_id <> auth.uid() THEN RETURN jsonb_build_object('ok', false, 'reason','not_owner'); END IF;
  IF _user_id = r.owner_id THEN RETURN jsonb_build_object('ok', false, 'reason','cant_kick_owner'); END IF;
  DELETE FROM public.room_members WHERE room_id=_room_id AND user_id=_user_id;
  PERFORM public.refresh_room_state(_room_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.kick_member(uuid, uuid) TO authenticated;

-- 10) Trigger to refresh state when members change
CREATE OR REPLACE FUNCTION public.trg_refresh_room_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.refresh_room_state(OLD.room_id); RETURN OLD; END IF;
  PERFORM public.refresh_room_state(NEW.room_id); RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS room_members_state_refresh ON public.room_members;
CREATE TRIGGER room_members_state_refresh
AFTER INSERT OR DELETE ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_room_state();
