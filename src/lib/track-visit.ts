import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export function useTrackVisits() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    supabase.from("page_visits").insert({ path, user_id: user?.id ?? null });
  }, [path, user?.id]);
}
