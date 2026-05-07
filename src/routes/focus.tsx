import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Quote, Flame, Settings as SettingsIcon } from "lucide-react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/focus")({ component: () => <AuthGate><Focus /></AuthGate> });

const VERSES = [
  "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
  "وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ",
  "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
  "وَقُل رَّبِّ زِدْنِي عِلْمًا",
];

type Mode = "focus" | "short" | "long";

interface Streak { current_streak: number; longest_streak: number; total_focus_minutes: number }

function Focus() {
  const { user } = useAuth();
  const [focusMin, setFocusMin] = useState(() => Number(localStorage.getItem("focusMin") || 25));
  const [shortMin, setShortMin] = useState(() => Number(localStorage.getItem("shortMin") || 5));
  const [longMin, setLongMin] = useState(() => Number(localStorage.getItem("longMin") || 10));
  const [showSettings, setShowSettings] = useState(false);
  const [completedFocus, setCompletedFocus] = useState(() => Number(localStorage.getItem("dayFocusCount") || 0));
  const [mode, setMode] = useState<Mode>("focus");
  const [seconds, setSeconds] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [verse] = useState(() => VERSES[Math.floor(Math.random() * VERSES.length)]);
  const [streak, setStreak] = useState<Streak | null>(null);
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
  }, [running]); // eslint-disable-line

  const handleComplete = async () => {
    if (mode === "focus") {
      const newCount = completedFocus + 1;
      setCompletedFocus(newCount);
      localStorage.setItem("dayFocusCount", String(newCount));
      localStorage.setItem("dayFocusDate", new Date().toDateString());
      toast.success("أحسنت! انتهت جلسة التركيز 🔥");
      try { new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {/* ignore */}
      if (user) {
        await supabase.from("focus_sessions").insert({ user_id: user.id, duration_minutes: focusMin, type: "focus" });
        const { data } = await supabase.from("user_streaks").select("current_streak, longest_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle();
        if (data) setStreak(data);
      }
      // Auto-suggest long break after 3 sessions
      if (newCount % 3 === 0) {
        toast("استحقّيت استراحة طويلة! 🌿", { duration: 4000 });
        switchMode("long");
      } else { switchMode("short"); }
    } else {
      toast.success("انتهت الراحة، عُد للتركيز 💪");
      switchMode("focus");
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m); setRunning(false);
    setSeconds(m === "focus" ? focusMin * 60 : m === "short" ? shortMin * 60 : longMin * 60);
  };
  const reset = () => { setRunning(false); setSeconds(total); };

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <PageBackground dim={0.55}>
      <div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center px-4 py-8">
        <div className="glass mx-auto mb-6 max-w-xl rounded-2xl px-8 py-4 text-center font-quran">
          <Quote className="mx-auto mb-2 h-4 w-4 text-primary/70" />
          <p className="text-lg md:text-xl">{verse}</p>
        </div>

        {streak && (
          <div className="flex flex-wrap gap-3 mb-6 justify-center">
            <div className="glass-strong rounded-full px-4 py-2 flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="font-bold">{streak.current_streak}</span>
              <span className="text-muted-foreground">يوم متتالي</span>
            </div>
            <div className="glass-strong rounded-full px-4 py-2 text-sm">
              <span className="text-muted-foreground">أطول سترك:</span> <span className="font-bold">{streak.longest_streak}</span>
            </div>
            <div className="glass-strong rounded-full px-4 py-2 text-sm">
              <span className="text-muted-foreground">إجمالي:</span> <span className="font-bold">{streak.total_focus_minutes}</span> دقيقة
            </div>
          </div>
        )}

        <div className="relative mb-6">
          <svg className="w-72 h-72 md:w-80 md:h-80 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="92" fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="6" />
            <circle cx="100" cy="100" r="92" fill="none" stroke="url(#grad)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 578} 578`} className="transition-all duration-1000" />
            <defs><linearGradient id="grad"><stop offset="0%" stopColor="oklch(0.78 0.15 65)" /><stop offset="100%" stopColor="oklch(0.65 0.2 35)" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl md:text-7xl font-bold tabular-nums" style={{ textShadow: "0 4px 40px oklch(0.78 0.15 65 / 0.4)" }}>
              {mins}<span className="text-primary mx-1">:</span>{secs}
            </div>
            <p className="mt-2 text-muted-foreground text-sm">
              {mode === "focus" ? "جلسة تركيز" : mode === "short" ? "راحة قصيرة" : "راحة طويلة 🌿"}
            </p>
            <div className="text-xs text-muted-foreground mt-1">جلسات اليوم: {completedFocus}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-center mb-4">
          <button onClick={() => switchMode("focus")} className={`rounded-full px-5 py-2 text-sm transition-all ${mode === "focus" ? "bg-primary text-primary-foreground" : "glass hover:bg-secondary"}`}>تركيز</button>
          <button onClick={() => switchMode("short")} className={`rounded-full px-5 py-2 text-sm transition-all ${mode === "short" ? "bg-primary text-primary-foreground" : "glass hover:bg-secondary"}`}>راحة قصيرة</button>
          <button onClick={() => switchMode("long")} className={`rounded-full px-5 py-2 text-sm transition-all ${mode === "long" ? "bg-primary text-primary-foreground" : "glass hover:bg-secondary"}`}>راحة طويلة</button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={reset} className="flex h-12 w-12 items-center justify-center rounded-full glass-strong hover:bg-secondary transition" aria-label="إعادة"><RotateCcw className="h-5 w-5" /></button>
          <button onClick={() => setRunning(!running)} className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground glow-warm hover:scale-105 transition" aria-label={running ? "إيقاف" : "تشغيل"}>
            {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 mr-1" />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="flex h-12 w-12 items-center justify-center rounded-full glass-strong hover:bg-secondary transition" aria-label="إعدادات"><SettingsIcon className="h-5 w-5" /></button>
        </div>

        {showSettings && (
          <div className="glass-strong rounded-2xl p-5 mt-6 w-full max-w-md float-in">
            <h3 className="font-bold mb-3 text-sm">تخصيص المؤقت</h3>
            {[
              { label: "تركيز (دقيقة)", val: focusMin, set: setFocusMin, min: 5, max: 90 },
              { label: "راحة قصيرة", val: shortMin, set: setShortMin, min: 1, max: 30 },
              { label: "راحة طويلة (تنطلق بعد 3 جلسات)", val: longMin, set: setLongMin, min: 5, max: 60 },
            ].map((s) => (
              <div key={s.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1"><span>{s.label}</span><span className="text-primary font-bold">{s.val}</span></div>
                <input type="range" min={s.min} max={s.max} value={s.val} onChange={(e) => s.set(Number(e.target.value))} className="w-full accent-primary" />
              </div>
            ))}
          </div>
        )}
      </div>
    </PageBackground>
  );
}
