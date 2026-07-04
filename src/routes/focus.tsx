import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Flame, CheckCircle2, Target, ArrowRight, Calendar, CalendarDays, CalendarClock, Plus, Trash2, Trophy, Minus, ListChecks, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/focus")({ component: Focus });

type Period = "daily" | "weekly" | "monthly";
type MissionStatus = "pending" | "active" | "completed" | "failed";
interface Mission {
  id: string;
  name: string;
  target_minutes: number;
  done_minutes: number;
  period: Period;
  status: MissionStatus;
  created_at: string;
}
interface Streak { current_streak: number; longest_streak: number; total_focus_minutes: number }
interface LeaderRow { user_id: string; total_focus_minutes: number; display_name: string | null; avatar_url: string | null }

const MAX_MINUTES = 300; // 5 hours

// LocalStorage fallback for guests
const guestKey = (p: Period) => `missions_guest_${p}`;
function loadGuest(p: Period): Mission[] {
  try { return JSON.parse(localStorage.getItem(guestKey(p)) || "[]"); } catch { return []; }
}
function saveGuest(p: Period, list: Mission[]) { localStorage.setItem(guestKey(p), JSON.stringify(list)); }

function Focus() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("daily");
  const [tab, setTab] = useState<"active" | "done">("active");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [newName, setNewName] = useState("");
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(25);
  const [days, setDays] = useState(3);
  const [weeks, setWeeks] = useState(1);

  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [askComplete, setAskComplete] = useState<Mission | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Each period stores its target in minutes but the input unit differs
  const DAY_MIN = 24 * 60;
  const WEEK_MIN = 7 * DAY_MIN;
  const totalMin = period === "daily" ? hours * 60 + mins : period === "weekly" ? days * DAY_MIN : weeks * WEEK_MIN;
  const visible = missions.filter((m) => tab === "active" ? m.status !== "completed" : m.status === "completed");

  // Load missions
  const loadMissions = useCallback(async () => {
    if (!user) { setMissions(loadGuest(period)); return; }
    const { data } = await supabase.from("missions").select("*").eq("user_id", user.id).eq("period", period).order("created_at", { ascending: false });
    if (data) setMissions(data as Mission[]);
  }, [user, period]);

  useEffect(() => { loadMissions(); }, [loadMissions]);

  // Load streak + leaders
  useEffect(() => {
    if (user) {
      supabase.from("user_streaks").select("current_streak, longest_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data) setStreak(data); });
    }
    (async () => {
      const { data: streaks } = await supabase.from("user_streaks").select("user_id, total_focus_minutes").order("total_focus_minutes", { ascending: false }).limit(10);
      if (!streaks?.length) return;
      const ids = streaks.map((s) => s.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      const pmap = new Map((profs || []).map((p) => [p.id, p]));
      setLeaders(streaks.map((s) => ({
        user_id: s.user_id,
        total_focus_minutes: s.total_focus_minutes,
        display_name: pmap.get(s.user_id)?.display_name ?? null,
        avatar_url: pmap.get(s.user_id)?.avatar_url ?? null,
      })));
    })();
  }, [user]);

  // Resume active mission from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("activeTask");
      if (!raw) return;
      const t = JSON.parse(raw) as { name: string; endsAt: number; minutes: number; missionId?: string };
      const remaining = Math.floor((t.endsAt - Date.now()) / 1000);
      if (remaining > 0 && t.missionId) {
        // Will be matched when missions load
        setSeconds(remaining); setRunning(true);
        setActiveMission({ id: t.missionId, name: t.name, target_minutes: t.minutes, done_minutes: 0, period: "daily", status: "active", created_at: "" });
      } else { localStorage.removeItem("activeTask"); }
    } catch { /* noop */ }
  }, []);

  // Timer tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { setRunning(false); finishTimer(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line
  }, [running]);

  const addMission = async () => {
    if (!newName.trim()) return toast.error("اكتب اسم المهمة");
    const minAllowed = period === "daily" ? 5 : period === "weekly" ? DAY_MIN : WEEK_MIN;
    if (totalMin < minAllowed) return toast.error(period === "daily" ? "الحد الأدنى 5 دقائق" : period === "weekly" ? "يوم على الأقل" : "أسبوع على الأقل");
    const payload = { name: newName.trim(), target_minutes: totalMin, period, status: "pending" as const, done_minutes: 0 };
    if (user) {
      const { data, error } = await supabase.from("missions").insert({ ...payload, user_id: user.id }).select().single();
      if (error) return toast.error(error.message);
      setMissions((m) => [data as Mission, ...m]);
    } else {
      const m: Mission = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload };
      const next = [m, ...missions];
      setMissions(next); saveGuest(period, next);
    }
    setNewName(""); setHours(0); setMins(25); setDays(3); setWeeks(1);
    toast.success("تمت إضافة المهمة ✨");
  };

  const removeMission = async (id: string) => {
    if (!confirm("حذف المهمة؟")) return;
    if (user) await supabase.from("missions").delete().eq("id", id);
    const next = missions.filter((m) => m.id !== id);
    setMissions(next);
    if (!user) saveGuest(period, next);
  };

  const startMission = (m: Mission) => {
    const remainMin = Math.max(1, m.target_minutes - m.done_minutes);
    setActiveMission(m);
    setSeconds(remainMin * 60);
    setRunning(true);
    const endsAt = Date.now() + remainMin * 60 * 1000;
    localStorage.setItem("activeTask", JSON.stringify({ name: m.name, endsAt, minutes: remainMin, missionId: m.id }));
  };

  const cancelMission = () => {
    localStorage.removeItem("activeTask");
    setRunning(false); setSeconds(0); setActiveMission(null);
  };

  const togglePause = () => {
    if (!activeMission) return;
    if (running) { setRunning(false); return; }
    const endsAt = Date.now() + seconds * 1000;
    localStorage.setItem("activeTask", JSON.stringify({ name: activeMission.name, endsAt, minutes: activeMission.target_minutes, missionId: activeMission.id }));
    setRunning(true);
  };

  const finishTimer = () => {
    if (activeMission) setAskComplete(activeMission);
  };

  const recordResult = async (completed: boolean) => {
    if (!askComplete) return;
    const elapsed = Math.max(1, askComplete.target_minutes - Math.ceil(seconds / 60));
    const minutesDone = completed ? askComplete.target_minutes : elapsed;

    if (user) {
      await supabase.from("focus_sessions").insert({
        user_id: user.id, duration_minutes: minutesDone, type: "focus",
        task_name: askComplete.name, completed,
      });
      const newDone = askComplete.done_minutes + minutesDone;
      const status: MissionStatus = completed || newDone >= askComplete.target_minutes ? "completed" : "pending";
      await supabase.from("missions").update({
        done_minutes: newDone,
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      }).eq("id", askComplete.id);
      const { data } = await supabase.from("user_streaks").select("current_streak, longest_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle();
      if (data) setStreak(data);
    } else {
      // Update guest mission
      const next = missions.map((m) => {
        if (m.id !== askComplete.id) return m;
        const newDone = m.done_minutes + minutesDone;
        return { ...m, done_minutes: newDone, status: (completed || newDone >= m.target_minutes ? "completed" : "pending") as MissionStatus };
      });
      saveGuest(period, next);
    }
    await loadMissions();
    localStorage.removeItem("activeTask");
    setAskComplete(null); setActiveMission(null); setSeconds(0); setRunning(false);
    if (completed) toast.success("أحسنت! أنجزت المهمة 🎯");
    else toast("سُجِّلت المحاولة، حاول مرة أخرى 💪");
  };

  // === IN TIMER MODE ===
  if (activeMission) {
    const total = activeMission.target_minutes * 60;
    const progress = total > 0 ? ((total - seconds) / total) * 100 : 0;
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return (
      <div className="timer-bg min-h-screen flex flex-col items-center px-4 py-6 text-white">
        <button onClick={cancelMission} className="self-start relative z-10 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 backdrop-blur px-4 py-2 text-xs font-bold hover:bg-white/20 mb-4">
          <ArrowRight className="h-4 w-4" /> العودة للمهام
        </button>
        <div className="relative z-10 mb-4 text-center max-w-md">
          <p className="text-xs text-white/60">تعمل على</p>
          <p className="font-extrabold text-xl mt-1">{activeMission.name}</p>
        </div>
        <div className="relative z-10 mb-6">
          <svg className="w-72 h-72 md:w-80 md:h-80 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle cx="100" cy="100" r="92" fill="none" stroke="url(#g)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 578} 578`} className="transition-all duration-1000" />
            <defs><linearGradient id="g"><stop offset="0%" stopColor="oklch(0.78 0.15 65)" /><stop offset="100%" stopColor="oklch(0.62 0.14 180)" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl md:text-7xl font-bold tabular-nums" style={{ textShadow: "0 4px 40px rgba(255,200,100,0.4)" }}>
              {m}<span className="text-amber-300 mx-1">:</span>{s}
            </div>
            <p className="mt-2 text-white/70 text-sm">المتبقي</p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-4 mb-3">
          <button onClick={() => { setSeconds(activeMission.target_minutes * 60); setRunning(false); }} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20"><RotateCcw className="h-5 w-5" /></button>
          <button onClick={togglePause} className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-foreground shadow-lg">
            {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 mr-1" />}
          </button>
          <button onClick={() => setAskComplete(activeMission)} className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/90 hover:bg-emerald-500"><CheckCircle2 className="h-5 w-5" /></button>
        </div>
        <p className="relative z-10 text-xs text-white/60">اضغط ✓ للإنهاء المبكر</p>

        {askComplete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-card text-foreground rounded-3xl p-8 max-w-md w-full slide-up shadow-2xl text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
                <Target className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-extrabold mb-2">المهمة:</h2>
              <p className="font-bold mb-4">{askComplete.name}</p>
              <p className="text-base mb-6">هل أنجزتها بالكامل؟</p>
              <div className="flex gap-3">
                <button onClick={() => recordResult(false)} className="flex-1 rounded-2xl bg-secondary py-3 font-bold">لا، بعد</button>
                <button onClick={() => recordResult(true)} className="flex-1 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-bold">نعم ✓</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === MISSIONS BOARD ===
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gradient-primary">الإنجاز</h1>
          <p className="text-xs text-muted-foreground mt-1">حدّد ما ستنجزه، الوقت، وابدأ ✨</p>
        </div>
        {streak && (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-700 px-3 py-1.5">
              <Flame className="h-4 w-4" /><span className="font-bold">{streak.current_streak}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5">
              <Sparkles className="h-4 w-4" /><span className="font-bold tabular-nums">{streak.total_focus_minutes}</span><span className="text-xs">د</span>
            </div>
          </div>
        )}
      </div>

      {/* Period tabs */}
      <div className="surface-card rounded-2xl p-1.5 flex gap-1 mb-5">
        {([
          { p: "daily", label: "يومي", Icon: Calendar },
          { p: "weekly", label: "أسبوعي", Icon: CalendarDays },
          { p: "monthly", label: "شهري", Icon: CalendarClock },
        ] as const).map(({ p, label, Icon }) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${period === p ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:bg-secondary"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* Add mission card */}
      <div className="surface-card rounded-2xl p-5 mb-5 slide-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground"><Plus className="h-5 w-5" /></div>
          <h3 className="font-extrabold">أضف مهمة جديدة</h3>
        </div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">ماذا ستنجز؟</label>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120}
          placeholder="مثال: دراسة مادة التاريخ"
          className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm outline-none focus:border-primary mb-4" />
        <label className="block text-xs text-muted-foreground mb-2 font-semibold">
          {period === "daily" ? "المدة" : period === "weekly" ? "عدد الأيام لهذا الأسبوع" : "عدد الأسابيع لهذا الشهر"}
        </label>
        <div className="flex items-center justify-center gap-3 mb-2">
          {period === "daily" && (<>
            <Stepper value={hours} onChange={setHours} min={0} max={5} label="ساعة" />
            <div className="text-2xl font-extrabold text-muted-foreground">:</div>
            <Stepper value={mins} onChange={(v) => setMins(v)} min={0} max={59} step={5} label="دقيقة" />
          </>)}
          {period === "weekly" && (
            <Stepper value={days} onChange={setDays} min={1} max={7} label="يوم" />
          )}
          {period === "monthly" && (
            <Stepper value={weeks} onChange={setWeeks} min={1} max={4} label="أسبوع" />
          )}
        </div>
        <p className="text-center text-[11px] text-muted-foreground mb-4">
          {period === "daily" ? `الحد الأقصى: 5 ساعات (${MAX_MINUTES} دقيقة)` : period === "weekly" ? "من 1 إلى 7 أيام" : "من 1 إلى 4 أسابيع"}
        </p>
        <button onClick={addMission} disabled={!newName.trim() || totalMin < (period === "daily" ? 5 : period === "weekly" ? DAY_MIN : WEEK_MIN)}
          className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold py-3 hover:scale-[1.01] transition disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" /> أنشئ المهمة
        </button>
      </div>

      {/* Analytics header */}
      <div className="rounded-xl bg-secondary/50 border border-border px-4 py-2.5 mb-3 text-center text-sm font-bold text-muted-foreground flex items-center justify-center gap-2">
        <ListChecks className="h-4 w-4" /> تحليلاتي وإنجازاتي
      </div>

      {/* Done/Active tabs */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setTab("done")} className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${tab === "done" ? "bg-card border border-primary/30 shadow-sm text-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
          <CheckCircle2 className="inline h-4 w-4 ml-1" /> منجزاتي ({missions.filter((m) => m.status === "completed").length})
        </button>
        <button onClick={() => setTab("active")} className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${tab === "active" ? "bg-card border border-primary/30 shadow-sm text-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
          <ListChecks className="inline h-4 w-4 ml-1" /> قيد الإنجاز ({missions.filter((m) => m.status !== "completed").length})
        </button>
      </div>

      {/* Mission list */}
      <div className="space-y-2.5 mb-8">
        {visible.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-40" />
            {tab === "active" ? "لا توجد مهام قيد الإنجاز" : "لم تكمل أي مهمة بعد"}
            <div className="mt-1">{tab === "active" ? "أضف مهمة جديدة لتبدأ!" : "ابدأ بإنجاز أول مهمة 💪"}</div>
          </div>
        )}
        {visible.map((m, i) => {
          const pct = Math.min(100, Math.round((m.done_minutes / m.target_minutes) * 100));
          const isDone = m.status === "completed";
          return (
            <div key={m.id} className="surface-card rounded-2xl p-4 slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                    <h4 className={`font-bold truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>{m.name}</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatByPeriod(m.done_minutes, m.period)} / {formatByPeriod(m.target_minutes, m.period)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isDone && (
                    <button onClick={() => startMission(m)} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-1.5 text-xs font-bold flex items-center gap-1 hover:scale-105 transition">
                      <Play className="h-3 w-3" /> ابدأ
                    </button>
                  )}
                  <button onClick={() => removeMission(m.id)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full transition-all duration-500 ${isDone ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-primary to-accent"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[11px]">
                <span className="text-muted-foreground">{pct}%</span>
                <span className="text-muted-foreground">{period === "daily" ? "اليوم" : period === "weekly" ? "الأسبوع" : "الشهر"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard */}
      <div className="surface-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-extrabold">قائمة المتصدرين</h3>
          </div>
          <span className="text-[11px] rounded-full bg-secondary px-2.5 py-1 text-muted-foreground font-bold">أعلى 10</span>
        </div>
        <div className="space-y-1.5">
          {leaders.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">لا توجد بيانات بعد</p>}
          {leaders.map((l, i) => {
            const isMe = user && l.user_id === user.id;
            const initial = (l.display_name?.[0] || "?").toUpperCase();
            const rankColor = i === 0 ? "bg-amber-400 text-amber-900" : i === 1 ? "bg-slate-300 text-slate-700" : i === 2 ? "bg-orange-300 text-orange-900" : "bg-secondary text-muted-foreground";
            return (
              <div key={l.user_id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isMe ? "bg-primary/5 border border-primary/20" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${rankColor}`}>{i + 1}</div>
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {l.avatar_url ? <img src={l.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
                </div>
                <div className="flex-1 truncate text-sm font-bold">{l.display_name || "مستخدم"} {isMe && <span className="text-[10px] text-primary">(أنت)</span>}</div>
                <div className="text-sm tabular-nums">
                  <span className="font-extrabold text-primary">{Math.floor(l.total_focus_minutes / 60)}</span><span className="text-[10px] text-muted-foreground"> س </span>
                  <span className="font-extrabold text-primary">{l.total_focus_minutes % 60}</span><span className="text-[10px] text-muted-foreground"> د</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!user && (
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/login" className="text-primary font-bold underline">سجّل دخولك</Link> لحفظ مهامك ومنافسة المتصدرين
        </p>
      )}
    </div>
  );
}

function Stepper({ value, onChange, min, max, step = 1, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-secondary/40 p-1.5">
        <button onClick={() => onChange(Math.max(min, value - step))} className="h-8 w-8 rounded-lg bg-card hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition"><Minus className="h-3.5 w-3.5" /></button>
        <input type="number" min={min} max={max} value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-12 bg-transparent text-center text-2xl font-extrabold tabular-nums outline-none" />
        <button onClick={() => onChange(Math.min(max, value + step))} className="h-8 w-8 rounded-lg bg-card hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <span className="text-[10px] text-muted-foreground mt-1 font-semibold">{label}</span>
    </div>
  );
}

function formatDuration(min: number) {
  if (min < 60) return `${min} د`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m > 0 ? `${h} س ${m} د` : `${h} س`;
}
