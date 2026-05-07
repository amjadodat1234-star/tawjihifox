import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Flame, Crown } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({ component: () => <AuthGate><Leaderboard /></AuthGate> });

interface Row { user_id: string; current_streak: number; longest_streak: number; total_focus_minutes: number; display_name: string | null }

function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"streak" | "minutes">("streak");

  useEffect(() => {
    (async () => {
      const { data: streaks } = await supabase.from("user_streaks").select("*").order(tab === "streak" ? "current_streak" : "total_focus_minutes", { ascending: false }).limit(50);
      if (!streaks) return;
      const ids = streaks.map((s) => s.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = new Map(profs?.map((p) => [p.id, p.display_name]) || []);
      setRows(streaks.map((s) => ({ ...s, display_name: map.get(s.user_id) || "مستخدم" })));
    })();
  }, [tab]);

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">المتصدرون</h1>
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("streak")} className={`rounded-full px-5 py-2 text-sm ${tab === "streak" ? "bg-primary text-primary-foreground" : "glass-strong"}`}>أعلى سترك</button>
          <button onClick={() => setTab("minutes")} className={`rounded-full px-5 py-2 text-sm ${tab === "minutes" ? "bg-primary text-primary-foreground" : "glass-strong"}`}>أكثر دقائق تركيز</button>
        </div>

        <div className="glass-strong rounded-2xl divide-y divide-border overflow-hidden">
          {rows.length === 0 && <p className="p-8 text-center text-muted-foreground">لا يوجد متصدرون بعد — كن أوّل من يبدأ!</p>}
          {rows.map((r, i) => (
            <div key={r.user_id} className="flex items-center gap-4 p-4 hover:bg-secondary/30">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm ${i === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-600 text-black" : i === 1 ? "bg-gradient-to-br from-slate-200 to-slate-400 text-black" : i === 2 ? "bg-gradient-to-br from-orange-400 to-orange-700 text-white" : "bg-secondary"}`}>
                {i < 3 ? <Crown className="h-4 w-4" /> : i + 1}
              </div>
              <div className="flex-1">
                <p className="font-bold">{r.display_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400" />{r.current_streak} يوم</span>
                  <span>{r.total_focus_minutes} دقيقة</span>
                </p>
              </div>
              <div className="text-2xl font-bold text-primary tabular-nums">
                {tab === "streak" ? r.current_streak : r.total_focus_minutes}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
