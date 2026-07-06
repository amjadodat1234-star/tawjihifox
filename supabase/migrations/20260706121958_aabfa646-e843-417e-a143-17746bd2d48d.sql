CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_room_member(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION private.is_room_owner(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.study_rooms WHERE id = _room_id AND owner_id = _user_id);
$$;

REVOKE ALL ON FUNCTION private.is_room_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_room_owner(UUID, UUID) FROM PUBLIC;

-- Drop old policies that reference public helpers, recreate using private ones
DROP POLICY IF EXISTS "members visible to same room" ON public.room_members;
DROP POLICY IF EXISTS "leave self or owner kick" ON public.room_members;
DROP POLICY IF EXISTS "messages readable by members or owner" ON public.room_messages;
DROP POLICY IF EXISTS "members send messages" ON public.room_messages;

CREATE POLICY "members visible to same room" ON public.room_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_room_member(room_id, auth.uid())
    OR private.is_room_owner(room_id, auth.uid())
  );
CREATE POLICY "leave self or owner kick" ON public.room_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_room_owner(room_id, auth.uid()));

CREATE POLICY "messages readable by members or owner" ON public.room_messages
  FOR SELECT TO authenticated
  USING (private.is_room_member(room_id, auth.uid()) OR private.is_room_owner(room_id, auth.uid()));
CREATE POLICY "members send messages" ON public.room_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (private.is_room_member(room_id, auth.uid()) OR private.is_room_owner(room_id, auth.uid()))
  );

-- Now drop the public copies
DROP FUNCTION IF EXISTS public.is_room_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_room_owner(UUID, UUID);