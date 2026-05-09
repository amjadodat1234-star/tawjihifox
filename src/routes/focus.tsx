import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Flame, Settings as SettingsIcon, CheckCircle2, XCircle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/focus")({ component: Focus });

const SUBJECTS = ["دين", "عربي", "إنجليزي", "تاريخ الأردن", "رياضيات", "علوم", "أخرى"];
type Mode = "focus" | "short" | "long";
interface Streak { current_streak: number; longest_streak: number; total_focus_minutes: number }

function Focus() {
  const { user } = useAuth();
  const [task, setTask] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [focusMin, setFocusMin] = useState(() => Number(localStorage.getItem("focusMin") || 25));
  const [shortMin, setShortMin] = useState(() => Number(localStorage.getItem("shortMin") || 5));
  const [longMin, setLongMin] = useState(() => Number(localStorage.getItem("longMin") || 10));
  const [showSettings, setShowSettings] = useState(false);
  const [completedFocus, setCompletedFocus] = useState(() => Number(localStorage.getItem("dayFocusCount") || 0));
  const [mode, setMode] = useState<Mode>("focus");
  const [seconds, setSeconds] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [askComplete, setAskComplete] = useState<{ task: string; subject: string; minutes: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = mode === "focus" ? focusMin * 60 : mode === "short" ? shortMin * 60 : longMin * 60;
  const progress = total > 0 ? ((total - seconds) / total) * 100 : 0;

  useEffect(() => { localStorage.setItem("focusMin", String(focusMin)); }, [focusMin]);
  useEffect(() => { localStorage.setItem("shortMin", String(shortMin)); }, [shortMin]);
  useEffect(() => { localStorage.setItem("longMin", String(longMin)); }, [longMin]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_streaks").select("current_streak, longest_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data) setStreak(data); });
  }, [user]);

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
    if (mode === "focus") {
      setAskComplete({ task: task || "جلسة تركيز", subject, minutes: focusMin });
      try { new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {/* ignore */}
    } else {
      toast.success("انتهت الراحة، عُد للتركيز 💪");
      switchMode("focus");
    }
  };

  const recordSession = async (completed: boolean) => {
    if (!askComplete) return;
    const newCount = completedFocus + 1;
    setCompletedFocus(newCount);
    localStorage.setItem("dayFocusCount", String(newCount));

    if (user) {
      await supabase.from("focus_sessions").insert({
        user_id: user.id, duration_minutes: askComplete.minutes, type: "focus",
        task_name: askComplete.task, subject: askComplete.subject, completed,
      });
      const { data } = await supabase.from("user_streaks").select("current_streak, longest_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle();
      if (data) setStreak(data);
    }
    setAskComplete(null);
    if (completed) toast.success(`أحسنت! أنجزت "${askComplete.task}" 🎯`);
    else toast(`تم تسجيل المحاولة، حاول مرة أخرى 💪`);

    if (newCount % 3 === 0) {
      toast("استحقّيت استراحة طويلة! 🌿", { duration: 4000 });
      switchMode("long");
    } else { switchMode("short"); }
  };

  const switchMode = (m: Mode) => {
    setMode(m); setRunning(false);
    setSeconds(m === "focus" ? focusMin * 60 : m === "short" ? shortMin * 60 : longMin * 60);
  };
  const reset = () => { setRunning(false); setSeconds(total); };
  const start = () => {
    if (mode === "focus" && !task.trim()) return toast.error("حدّد المهمة أولاً");
    setRunning(true);
  };

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <div className="timer-bg min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 text-white">
      {/* Task setup banner */}
      {mode === "focus" && !running && (
        <div className="relative z-10 w-full max-w-xl glass-strong !bg-white/10 !border-white/20 rounded-2xl p-5 mb-6 slide-up">
          <div className="flex items-center gap-2 mb-3 text-white/90">
            <Target className="h-4 w-4" />
            <h3 className="font-bold text-sm">حدّد ما ستنجزه في هذه الجلسة</h3>
          </div>
          <input
            value={task} onChange={(e) => setTask(e.target.value)}
            placeholder="مثال: حل 15 سؤال من فصل البلاغة"
            className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 text-sm placeholder:text-white/50 outline-none focus:border-white/40 mb-2"
          />
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button key={s} onClick={() => setSubject(s)} className={`text-xs rounded-full px-3 py-1 transition ${subject === s ? "bg-white text-foreground font-bold" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {running && task && (
        <div className="relative z-10 mb-4 text-center">
          <p className="text-xs text-white/60">تعمل على</p>
          <p className="font-bold text-lg">{task}</p>
          <p className="text-xs text-white/70">{subject}</p>
        </div>
      )}

      {streak && (
        <div className="relative z-10 flex flex-wrap gap-3 mb-6 justify-center">
          <div className="rounded-full px-4 py-2 flex items-center gap-2 text-sm bg-white/10 border border-white/20">
            <Flame className="h-4 w-4 text-orange-300" />
            <span className="font-bold">{streak.current_streak}</span>
            <span className="text-white/70">يوم متتالي</span>
          </div>
          <div className="rounded-full px-4 py-2 text-sm bg-white/10 border border-white/20">
            <span className="text-white/70">أطول:</span> <span className="font-bold">{streak.longest_streak}</span>
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
          <p className="mt-2 text-white/70 text-sm">
            {mode === "focus" ? "جلسة تركيز" : mode === "short" ? "راحة قصيرة" : "راحة طويلة 🌿"}
          </p>
          <div className="text-xs text-white/50 mt-1">جلسات اليوم: {completedFocus}</div>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-3 justify-center mb-4">
        <button onClick={() => switchMode("focus")} className={`rounded-full px-5 py-2 text-sm transition-all ${mode === "focus" ? "bg-white text-foreground font-bold" : "bg-white/10 hover:bg-white/20 text-white"}`}>تركيز</button>
        <button onClick={() => switchMode("short")} className={`rounded-full px-5 py-2 text-sm transition-all ${mode === "short" ? "bg-white text-foreground font-bold" : "bg-white/10 hover:bg-white/20 text-white"}`}>راحة قصيرة</button>
        <button onClick={() => switchMode("long")} className={`rounded-full px-5 py-2 text-sm transition-all ${mode === "long" ? "bg-white text-foreground font-bold" : "bg-white/10 hover:bg-white/20 text-white"}`}>راحة طويلة</button>
      </div>

      <div className="relative z-10 flex items-center gap-4">
        <button onClick={reset} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition" aria-label="إعادة"><RotateCcw className="h-5 w-5" /></button>
        <button onClick={() => running ? setRunning(false) : start()} className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-foreground shadow-lg hover:scale-105 transition" aria-label={running ? "إيقاف" : "تشغيل"}>
          {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 mr-1" />}
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition" aria-label="إعدادات"><SettingsIcon className="h-5 w-5" /></button>
      </div>

      {!user && (
        <p className="relative z-10 mt-6 text-xs text-white/70">
          <Link to="/login" className="underline">سجّل دخولك</Link> لحفظ تقدمك وستركّك
        </p>
      )}

      {showSettings && (
        <div className="relative z-10 rounded-2xl p-5 mt-6 w-full max-w-md float-in bg-white/10 border border-white/20 backdrop-blur-md">
          <h3 className="font-bold mb-3 text-sm">تخصيص المؤقت</h3>
          {[
            { label: "تركيز (دقيقة)", val: focusMin, set: setFocusMin, min: 5, max: 90 },
            { label: "راحة قصيرة", val: shortMin, set: setShortMin, min: 1, max: 30 },
            { label: "راحة طويلة (بعد 3 جلسات)", val: longMin, set: setLongMin, min: 5, max: 60 },
          ].map((s) => (
            <div key={s.label} className="mb-3">
              <div className="flex justify-between text-xs mb-1"><span>{s.label}</span><span className="font-bold text-amber-300">{s.val}</span></div>
              <input type="range" min={s.min} max={s.max} value={s.val} onChange={(e) => s.set(Number(e.target.value))} className="w-full accent-amber-400" />
            </div>
          ))}
        </div>
      )}

      {/* Completion modal */}
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
              <button onClick={() => recordSession(true)} className="flex-1 flex items-center justify-center gap-2 rounded-full bg-emerald-500 text-white px-6 py-3 font-bold hover:bg-emerald-600 transition">
                <CheckCircle2 className="h-5 w-5" /> نعم، أنجزت
              </button>
              <button onClick={() => recordSession(false)} className="flex-1 flex items-center justify-center gap-2 rounded-full bg-secondary text-foreground px-6 py-3 font-bold hover:bg-secondary/80 transition">
                <XCircle className="h-5 w-5" /> لم أنجز
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
