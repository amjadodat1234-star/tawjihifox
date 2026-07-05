
-- 1. Move has_role to a private schema so PostgREST doesn't expose it
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Rewrite policies that referenced public.has_role to use private.has_role
DROP POLICY IF EXISTS "roles viewable by self or admin" ON public.user_roles;
DROP POLICY IF EXISTS "admin manages roles" ON public.user_roles;
CREATE POLICY "roles viewable by self or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin reads visits" ON public.page_visits;
CREATE POLICY "admin reads visits" ON public.page_visits FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Revoke execute on the public wrapper so signed-in users can't call it via API
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, authenticated, anon;

-- 2. page_visits: restrict anon inserts (short path only, no arbitrary long payloads)
DROP POLICY IF EXISTS "anon insert visits" ON public.page_visits;
CREATE POLICY "anon insert visits" ON public.page_visits FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND path IS NOT NULL AND length(path) <= 200 AND path LIKE '/%');

-- 3. profiles: restrict SELECT to authenticated users
DROP POLICY IF EXISTS "profiles viewable by everyone" ON public.profiles;
CREATE POLICY "profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);

-- 4. study_rooms: restrict to authenticated
DROP POLICY IF EXISTS "public rooms visible to all" ON public.study_rooms;
CREATE POLICY "rooms visible to authenticated" ON public.study_rooms FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = owner_id);

-- 5. room_members: authenticated members of same room (or self)
DROP POLICY IF EXISTS "members visible to all" ON public.room_members;
CREATE POLICY "members visible to room members" ON public.room_members FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.room_members m WHERE m.room_id = room_members.room_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.study_rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid())
  );

-- 6. room_messages: only members of the room can read
DROP POLICY IF EXISTS "messages readable" ON public.room_messages;
CREATE POLICY "messages readable by room members" ON public.room_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.room_members m WHERE m.room_id = room_messages.room_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.study_rooms r WHERE r.id = room_messages.room_id AND r.owner_id = auth.uid())
  );

-- 7. Storage: drop broad public SELECT policies (public buckets still serve via getPublicUrl,
--    but listing/enumeration is disallowed)
DROP POLICY IF EXISTS "study files publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "forum media public read" ON storage.objects;
