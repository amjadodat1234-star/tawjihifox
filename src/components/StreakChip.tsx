import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function StreakChip() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<number | null>(null);
  useEffect(() => {
    if (!user) { setStreak(null); return; }
    let alive = true;
    supabase.from("user_streaks").select("current_streak").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (alive) setStreak(data?.current_streak ?? 0); });
    const ch = supabase.channel(`streak-${user.id}`).on("postgres_changes",
      { event: "*", schema: "public", table: "user_streaks", filter: `user_id=eq.${user.id}` },
      (p) => setStreak((p.new as { current_streak?: number })?.current_streak ?? 0),
    ).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [user]);
  if (!user || streak === null) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
        <Link
          to="/leaderboard"
          className="group hidden md:flex items-center gap-1.5 rounded-full bg-gradient-to-l from-amber-500/15 to-orange-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-700 hover:from-amber-500/25 hover:to-orange-500/25 transition"
          title="سلسلة أيامك المتتالية في التركيز"
        >
          <motion.span animate={{ rotate: [0, -12, 12, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}>
            <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-600" />
          </motion.span>
          <span className="tabular-nums">{streak}</span>
          <span className="text-[10px] font-medium opacity-80">يوم</span>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
