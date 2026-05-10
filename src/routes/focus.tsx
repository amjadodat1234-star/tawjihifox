import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Flame, Settings as SettingsIcon, CheckCircle2, XCircle, Target, ArrowRight, Calendar, CalendarDays, CalendarClock, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/focus")({ component: Focus });

interface Streak { current_streak: number; longest_streak: number; total_focus_minutes: number }
interface Mission { id: string; name: string; targetMin: number; doneMin: number; createdAt: number }
type Period = "daily" | "weekly" | "monthly";

function loadMissions(p: Period): Mission[] {
  try { return JSON.parse(localStorage.getItem(`missions_${p}`) || "[]"); } catch { return []; }
}
function saveMissions(p: Period, m: Mission[]) { localStorage.setItem(`missions_${p}`, JSON.stringify(m)); }

function Focus() {
  const { user } = useAuth();
  const [task, setTask] = useState("");
  const [plannedMin, setPlannedMin] = useState(25);
  const [shortMin, setShortMin] = useState(() => Number(localStorage.getItem("shortMin") || 5));
  const [longMin, setLongMin] = useState(() => Number(localStorage.getItem("longMin") || 10));
  const [showSettings, setShowSettings] = useState(false);
  const [completedFocus, setCompletedFocus] = useState(() => Number(localStorage.getItem("dayFocusCount") || 0));
  const [phase, setPhase] = useState<"setup" | "focus" | "short" | "long">("setup");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [askComplete, setAskComplete] = useState<{ task: string; minutes: number } | null>(null);
  const [missionPeriod, setMissionPeriod] = useState<Period>("daily");
  const [missions, setMissions] = useState<Mission[]>(() => loadMissions("daily"));
  const [newMissionName, setNewMissionName] = useState("");
  const [newMissionMin, setNewMissionMin] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = phase === "focus" ? plannedMin * 60 : phase === "short" ? shortMin * 60 : phase === "long" ? longMin * 60 : 1;
  const progress = total > 0 ? ((total - seconds) / total) * 100 : 0;

  useEffect(() => { localStorage.setItem("shortMin", String(shortMin)); }, [shortMin]);
  useEffect(() => { localStorage.setItem("longMin", String(longMin)); }, [longMin]);
  useEffect(() => { setMissions(loadMissions(missionPeriod)); }, [missionPeriod]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_streaks").select("current_streak, longest_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data) setStreak(data); });
  }, [user]);

  // Resume active task on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("activeTask");
      if (!raw) return;
      const t = JSON.parse(raw) as { name: string; endsAt: number; minutes: number };
      const remaining = Math.floor((t.endsAt - Date.now()) / 1000);
      if (remaining > 0) {
        setTask(t.name); setPlannedMin(t.minutes); setPhase("focus");
        setSeconds(remaining); setRunning(true);
      } else {
        localStorage.removeItem("activeTask");
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => { if (s <= 1) { setRunning(false); handleComplete(); return 0; } return s - 1; });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line
  }, [running]);

  const handleComplete = () => {
    localStorage.removeItem("activeTask");
    if (phase === "focus") {
      setAskComplete({ task: task || "جلسة تركيز", minutes: plannedMin });
    } else {
      toast.success("انتهت الراحة، عُد للإنجاز 💪");
      setPhase("setup");
      setTask(""); setSeconds(0);
    }
  };

  const recordSession = async (completed: boolean) => {
    if (!askComplete) return;
    const newCount = completedFocus + 1;
    setCompletedFocus(newCount);
    localStorage.setItem("dayFocusCount", String(newCount));

    // Add to active mission progress (daily/weekly/monthly all-period match by name)
    (["daily", "weekly", "monthly"] as Period[]).forEach((p) => {
      const list = loadMissions(p);
      const idx = list.findIndex((m) => m.name.trim() === askComplete.task.trim());
      if (idx !== -1) {
        list[idx].doneMin += askComplete.minutes;
        saveMissions(p, list);
        if (p === missionPeriod) setMissions(list);
      }
    });

    if (user) {
      await supabase.from("focus_sessions").insert({
        user_id: user.id, duration_minutes: askComplete.minutes, type: "focus",
        task_name: askComplete.task, completed,
      });
      const { data } = await supabase.from("user_streaks").select("current_streak, longest_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle();
      if (data) setStreak(data);
    }
    setAskComplete(null);
    if (completed) toast.success(`أحسنت! أنجزت "${askComplete.task}" 🎯`);
    else toast(`تم تسجيل المحاولة، حاول مرة أخرى 💪`);

    if (newCount % 3 === 0) {
      toast("استحقّيت استراحة طويلة! 🌿", { duration: 4000 });
      setPhase("long"); setSeconds(longMin * 60); setRunning(true);
    } else {
      setPhase("short"); setSeconds(shortMin * 60); setRunning(true);
    }
  };

  const startTask = () => {
    if (!task.trim()) return toast.error("اكتب اسم المهمة أولاً");
    if (plannedMin < 1) return toast.error("حدّد المدة");
    const endsAt = Date.now() + plannedMin * 60 * 1000;
    localStorage.setItem("activeTask", JSON.stringify({ name: task, endsAt, minutes: plannedMin }));
    setPhase("focus"); setSeconds(plannedMin * 60); setRunning(true);
  };
  const cancelTask = () => {
    localStorage.removeItem("activeTask");
    setRunning(false); setPhase("setup"); setSeconds(0); setTask("");
  };
  const reset = () => { setRunning(false); setSeconds(total); };
  const togglePause = () => {
    if (running) { setRunning(false); return; }
    if (phase === "focus") {
      const endsAt = Date.now() + seconds * 1000;
      localStorage.setItem("activeTask", JSON.stringify({ name: task, endsAt, minutes: plannedMin }));
    }
    setRunning(true);
  };

  const addMission = () => {
    if (!newMissionName.trim() || newMissionMin <= 0) return;
    const next = [...missions, { id: crypto.randomUUID(), name: newMissionName.trim(), targetMin: newMissionMin, doneMin: 0, createdAt: Date.now() }];
    setMissions(next); saveMissions(missionPeriod, next);
    setNewMissionName(""); setNewMissionMin(60);
  };
  const removeMission = (id: string) => {
    const next = missions.filter((m) => m.id !== id);
    setMissions(next); saveMissions(missionPeriod, next);
  };
  const useMissionAsTask = (m: Mission) => {
    setTask(m.name);
    const remain = Math.max(15, Math.min(120, m.targetMin - m.doneMin));
    setPlannedMin(remain);
  };

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <div className="timer-bg min-h-screen flex flex-col items-center px-4 py-6 text-white">
      <Link to="/" className="self-start relative z-10 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 backdrop-blur px-4 py-2 text-xs font-bold hover:bg-white/20 mb-4">
        <ArrowRight className="h-4 w-4" /> العودة
      </Link>

      {phase === "setup" && (
        <div className="relative z-10 w-full max-w-xl glass-strong !bg-white/10 !border-white/20 rounded-3xl p-6 mb-6 slide-up">
          <div className="flex items-center gap-2 mb-4 text-white/90">
            <Target className="h-5 w-5 text-amber-300" />
            <h3 className="font-extrabold text-base">حدّد ما ستنجزه الآن</h3>
          </div>
          <label className="block text-xs text-white/70 mb-1">المهمة</label>
          <input
            value={task} onChange={(e) => setTask(e.target.value)}
            placeholder="مثال: حل 15 سؤال من فصل البلاغة"
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm placeholder:text-white/40 outline-none focus:border-amber-300 mb-4"
          />
          <label className="block text-xs text-white/70 mb-1">كم دقيقة ستستغرق؟ <span className="text-amber-300 font-bold">{plannedMin}</span> دقيقة</label>
          <input type="range" min={5} max={120} step={5} value={plannedMin} onChange={(e) => setPlannedMin(Number(e.target.value))} className="w-full accent-amber-400 mb-2" />
          <div className="flex flex-wrap gap-2 mb-5">
            {[15, 25, 45, 60, 90].map((m) => (
              <button key={m} onClick={() => setPlannedMin(m)} className={`text-xs rounded-full px-3 py-1 ${plannedMin === m ? "bg-white text-foreground font-bold" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>{m} د</button>
            ))}
          </div>
          <button onClick={startTask} className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-foreground font-extrabold py-3 hover:scale-[1.02]">
            تم — ابدأ الإنجاز
          </button>
        </div>
      )}

      {phase !== "setup" && (
        <>
          <div className="relative z-10 mb-4 text-center max-w-md">
            <p className="text-xs text-white/60">{phase === "focus" ? "تعمل على" : phase === "short" ? "راحة قصيرة" : "راحة طويلة 🌿"}</p>
            {task && phase === "focus" && <p className="font-extrabold text-xl">{task}</p>}
          </div>

          {streak && (
            <div className="relative z-10 flex flex-wrap gap-3 mb-6 justify-center">
              <div className="rounded-full px-4 py-2 flex items-center gap-2 text-sm bg-white/10 border border-white/20">
                <Flame className="h-4 w-4 text-orange-300" />
                <span className="font-bold">{streak.current_streak}</span>
                <span className="text-white/70">يوم متتالي</span>
              </div>
              <div className="rounded-full px-4 py-2 text-sm bg-white/10 border border-white/20">
                <span className="text-white/70">المجموع:</span> <span className="font-bold">{streak.total_focus_minutes}</span> د
              </div>
            </div>
          )}

          <div className="relative z-10 mb-6">
            <svg className="w-72 h-72 md:w-80 md:h-80 -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle cx="100" cy="100" r="92" fill="none" stroke="url(#grad)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 578} 578`} className="transition-all duration-1000" />
              <defs><linearGradient id="grad"><stop offset="0%" stopColor="oklch(0.78 0.15 65)" /><stop offset="100%" stopColor="oklch(0.62 0.14 180)" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-6xl md:text-7xl font-bold tabular-nums" style={{ textShadow: "0 4px 40px rgba(255,200,100,0.4)" }}>
                {mins}<span className="text-amber-300 mx-1">:</span>{secs}
              </div>
              <p className="mt-2 text-white/70 text-sm">المتبقي</p>
              <div className="text-xs text-white/50 mt-1">جلسات اليوم: {completedFocus}</div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-4 mb-3">
            <button onClick={reset} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20" aria-label="إعادة"><RotateCcw className="h-5 w-5" /></button>
            <button onClick={togglePause} className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-foreground shadow-lg" aria-label={running ? "إيقاف" : "تشغيل"}>
              {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 mr-1" />}
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20" aria-label="إعدادات"><SettingsIcon className="h-5 w-5" /></button>
          </div>

          {phase === "focus" && (
            <button onClick={cancelTask} className="relative z-10 text-xs text-white/60 hover:text-white/90 underline mb-3">إلغاء المهمة الحالية</button>
          )}

          {showSettings && (
            <div className="relative z-10 rounded-2xl p-5 mt-2 w-full max-w-md bg-white/10 border border-white/20 backdrop-blur-md">
              <h3 className="font-bold mb-3 text-sm">تخصيص فترات الراحة</h3>
              {[
                { label: "راحة قصيرة (دقيقة)", val: shortMin, set: setShortMin, min: 1, max: 30 },
                { label: "راحة طويلة (بعد 3 جلسات)", val: longMin, set: setLongMin, min: 5, max: 60 },
              ].map((s) => (
                <div key={s.label} className="mb-3">
                  <div className="flex justify-between text-xs mb-1"><span>{s.label}</span><span className="font-bold text-amber-300">{s.val}</span></div>
                  <input type="range" min={s.min} max={s.max} value={s.val} onChange={(e) => s.set(Number(e.target.value))} className="w-full accent-amber-400" />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Missions panel */}
      <div className="relative z-10 w-full max-w-xl mt-8 mb-10">
        <h3 className="font-extrabold text-lg mb-3 flex items-center gap-2"><Target className="h-5 w-5 text-amber-300" /> أهدافي</h3>
        <div className="flex gap-2 mb-3">
          {([
            { p: "daily", label: "يومي", Icon: Calendar },
            { p: "weekly", label: "أسبوعي", Icon: CalendarDays },
            { p: "monthly", label: "شهري", Icon: CalendarClock },
          ] as const).map(({ p, label, Icon }) => (
            <button key={p} onClick={() => setMissionPeriod(p)} className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm transition ${missionPeriod === p ? "bg-white text-foreground font-bold" : "bg-white/10 hover:bg-white/20 text-white/80"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2 mb-3">
          {missions.length === 0 && <p className="text-sm text-white/50 text-center py-3">لا توجد أهداف بعد. أضف أول هدف ⬇</p>}
          {missions.map((m) => {
            const pct = Math.min(100, Math.round((m.doneMin / m.targetMin) * 100));
            return (
              <div key={m.id} className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => useMissionAsTask(m)} className="text-[11px] rounded-full bg-amber-400/90 text-foreground px-2.5 py-1 font-bold">ابدأ</button>
                    <button onClick={() => removeMission(m.id)} className="text-white/50 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[11px] text-white/60 mt-1">{m.doneMin} / {m.targetMin} د — {pct}%</div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input value={newMissionName} onChange={(e) => setNewMissionName(e.target.value)} placeholder="اسم الهدف" className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-amber-300" />
          <input type="number" min={1} value={newMissionMin} onChange={(e) => setNewMissionMin(Number(e.target.value))} className="w-20 rounded-xl bg-white/10 border border-white/20 px-2 py-2 text-sm outline-none focus:border-amber-300" />
          <button onClick={addMission} className="rounded-xl bg-amber-400 text-foreground px-4 py-2 font-bold flex items-center gap-1"><Plus className="h-4 w-4" /></button>
        </div>
        <p className="text-[11px] text-white/40 mt-1">المدة بالدقائق. عند إنجاز مهمة بنفس اسم الهدف يُحدَّث التقدّم تلقائياً.</p>
      </div>

      {!user && (
        <p className="relative z-10 text-xs text-white/70">
          <Link to="/login" className="underline">سجّل دخولك</Link> لحفظ تقدمك وستركّك
        </p>
      )}

      {askComplete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-card text-foreground rounded-3xl p-8 max-w-md w-full slide-up shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Target className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">انتهى الوقت!</h2>
            <p className="text-sm text-muted-foreground mb-1">المهمة:</p>
            <p className="font-bold mb-4">{askComplete.task}</p>
            <p className="text-base mb-6">هل أنجزت المهمة؟</p>
            <div className="flex gap-3">
              <button onClick={() => recordSession(true)} className="flex-1 flex items-center justify-center gap-2 rounded-full bg-emerald-500 text-white px-6 py-3 font-bold hover:bg-emerald-600">
                <CheckCircle2 className="h-5 w-5" /> نعم، أنجزت
              </button>
              <button onClick={() => recordSession(false)} className="flex-1 flex items-center justify-center gap-2 rounded-full bg-secondary text-foreground px-6 py-3 font-bold hover:bg-secondary/80">
                <XCircle className="h-5 w-5" /> لم أنجز
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
