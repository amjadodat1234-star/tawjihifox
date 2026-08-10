import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { levelFor, ACHIEVEMENTS } from "@/lib/gamification";
import { useCohort, fieldName } from "@/lib/cohort";
import { Flame, Trophy, Target, CheckCircle2, Clock, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "تقدّمي — توجيهي فوكس" },
      { name: "description", content: "تابع دقائق دراستك، مهامك المنجزة، مستواك، إنجازاتك، وأيامك المتتالية." },
      { property: "og:title", content: "تقدّمي — توجيهي فوكس" },
      { property: "og:description", content: "مستواك، إنجازاتك، سلسلة أيامك، وترتيبك بين الطلاب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Progress,
});



function Progress() {
  const { user } = useAuth();
  const { generation, field } = useCohort();
  const [minutes, setMinutes] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tasks, setTasks] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [goal, setGoal] = useState(120);
  const [unlocked, setUnlocked] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: s }, { data: prof }, { data: sessions }, { data: done }, { data: all }, { data: ach }] = await Promise.all([
        supabase.from("user_streaks").select("current_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("daily_goal_minutes").eq("id", user.id).maybeSingle(),
        supabase.from("focus_sessions").select("duration_minutes, completed_at").eq("user_id", user.id).eq("type", "focus").gte("completed_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from("missions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
        supabase.from("user_streaks").select("user_id, total_focus_minutes").order("total_focus_minutes", { ascending: false }),
        supabase.from("user_achievements").select("code").eq("user_id", user.id),
      ]);
      const total = s?.total_focus_minutes ?? 0;
      setMinutes(total);
      setStreak(s?.current_streak ?? 0);
      setGoal(prof?.daily_goal_minutes ?? 120);
      setTodayMinutes((sessions ?? []).reduce((a, r) => a + (r.duration_minutes ?? 0), 0));
      const idx = (all ?? []).findIndex((r) => r.user_id === user.id);
      setRank(idx >= 0 ? idx + 1 : null);
      const codes = (ach ?? []).map((a) => a.code);
      setUnlocked(codes);

      const { count } = await supabase.from("missions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed");
      const taskCount = count ?? (done as unknown as number) ?? 0;
      setTasks(taskCount);

      // Unlock newly earned achievements
      const stats = { tasks: taskCount, minutes: total, streak: s?.current_streak ?? 0 };
      const fresh = ACHIEVEMENTS.filter((a) => a.test(stats) && !codes.includes(a.code));
      if (fresh.length) {
        await supabase.from("user_achievements").insert(fresh.map((a) => ({ user_id: user.id, code: a.code })));
        setUnlocked([...codes, ...fresh.map((a) => a.code)]);
        fresh.forEach((a) => toast.success(`إنجاز جديد ${a.icon} — ${a.name}`));
      }
    })();
  }, [user]);

  const saveGoal = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ daily_goal_minutes: goal }).eq("id", user.id);
    toast.success("تم حفظ هدفك اليومي");
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Trophy className="mx-auto h-10 w-10 text-primary mb-4" />
        <h1 className="text-2xl font-extrabold mb-2">سجّل الدخول لمتابعة تقدّمك</h1>
        <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">
          تسجيل الدخول <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const lv = levelFor(minutes);
  const goalPct = goal > 0 ? Math.min(100, Math.round((todayMinutes / goal) * 100)) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-extrabold text-gradient-primary mb-1">تقدّمي</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {generation ? `جيل ${generation}${field ? ` — ${fieldName(field)}` : ""}` : "لم تختر جيلك بعد"}
      </p>

      {/* Level */}
      <div className="surface-card rounded-3xl p-6 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">مستواك الحالي</p>
            <p className="text-2xl font-extrabold">{lv.current.name}</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">إجمالي الدراسة</p>
            <p className="text-2xl font-extrabold tabular-nums">{minutes} <span className="text-sm">دقيقة</span></p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full gradient-anim" style={{ width: `${lv.progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {lv.next ? `${lv.next.minMinutes - minutes} دقيقة للوصول إلى مستوى ${lv.next.name}` : "وصلت لأعلى مستوى 👑"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon: Clock, label: "دقائق اليوم", value: todayMinutes },
          { icon: CheckCircle2, label: "مهام منجزة", value: tasks },
          { icon: Flame, label: "أيام متتالية", value: streak },
          { icon: Trophy, label: "ترتيبك", value: rank ?? "—" },
        ].map((s) => (
          <div key={s.label} className="surface-card rounded-2xl p-4">
            <s.icon className="h-5 w-5 text-primary mb-2" />
            <p className="text-2xl font-extrabold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Daily goal */}
      <div className="surface-card rounded-3xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-extrabold">الهدف اليومي</h2>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden mb-2">
          <div className="h-full bg-emerald-500" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          أنجزت {todayMinutes} من {goal} دقيقة ({goalPct}%) — متبقٍ {Math.max(0, goal - todayMinutes)} دقيقة.
        </p>
        <div className="flex items-center gap-2">
          <input type="number" min={15} max={720} step={15} value={goal}
            onChange={(e) => setGoal(Math.max(15, Math.min(720, Number(e.target.value) || 0)))}
            className="w-28 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-primary" />
          <span className="text-sm text-muted-foreground">دقيقة يومياً</span>
          <button onClick={saveGoal} className="mr-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
            <Save className="h-4 w-4" /> حفظ
          </button>
        </div>
      </div>

      {/* Achievements */}
      <div className="surface-card rounded-3xl p-6">
        <h2 className="font-extrabold mb-4">الإنجازات ({unlocked.length}/{ACHIEVEMENTS.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const on = unlocked.includes(a.code);
            return (
              <div key={a.code} className={`rounded-2xl border p-4 transition ${on ? "border-primary/30 bg-primary/5" : "opacity-50"}`}>
                <div className="text-2xl mb-1">{a.icon}</div>
                <p className="font-bold text-sm">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
