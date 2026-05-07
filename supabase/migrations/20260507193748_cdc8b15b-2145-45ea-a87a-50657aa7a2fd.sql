
-- Restrict SECURITY DEFINER functions: revoke from public/anon
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_streak_on_focus() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Tighten page_visits insert policy: limit anon path only, prevent abuse
DROP POLICY IF EXISTS "anyone insert visits" ON public.page_visits;
CREATE POLICY "auth users insert own visits" ON public.page_visits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anon insert visits" ON public.page_visits FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Replace storage SELECT to prevent bucket listing — allow read of files only by exact path access pattern is fine since bucket is public; keep as is but mark intentional.
-- (Public files bucket listing is acceptable here.)
