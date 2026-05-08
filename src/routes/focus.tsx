import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Settings as SettingsIcon } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/focus")({ component: () => <AuthGate><Focus /></AuthGate> });

type Mode = "focus" | "short" | "long";

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = mode === "focus" ? focusMin * 60 : mode === "short" ? shortMin * 60 : longMin * 60;
  const progress = total > 0 ? ((total - seconds) / total) * 100 : 0;

  useEffect(() => { localStorage.setItem("focusMin", String(focusMin)); }, [focusMin]);
  useEffect(() => { localStorage.setItem("shortMin", String(shortMin)); }, [shortMin]);
  useEffect(() => { localStorage.setItem("longMin", String(longMin)); }, [longMin]);

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
      toast.success("انتهت جلسة التركيز");
      if (user) {
        await supabase.from("focus_sessions").insert({ user_id: user.id, duration_minutes: focusMin, type: "focus" });
      }
      if (newCount % 3 === 0) { switchMode("long"); } else { switchMode("short"); }
    } else {
      toast.success("انتهت الراحة");
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
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden flex flex-col items-center justify-center px-4 py-10">
      {/* Ambient animated background — only when running */}
      {running && (
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="ambient-orb" style={{ width: 480, height: 480, background: "oklch(0.85 0.12 260 / 0.35)", top: "-10%", right: "-10%" }} />
          <div className="ambient-orb" style={{ width: 420, height: 420, background: "oklch(0.88 0.10 200 / 0.3)", bottom: "-15%", left: "-10%", animationDelay: "3s" }} />
          <div className="ambient-orb" style={{ width: 360, height: 360, background: "oklch(0.9 0.08 320 / 0.25)", top: "30%", left: "30%", animationDelay: "6s" }} />
        </div>
      )}

      {/* Mode tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-background mb-10">
        {[
          { id: "focus" as Mode, label: "تركيز" },
          { id: "short" as Mode, label: "راحة قصيرة" },
          { id: "long" as Mode, label: "راحة طويلة" },
        ].map((t) => (
          <button key={t.id} onClick={() => switchMode(t.id)} className={`rounded-full px-4 py-1.5 text-sm transition ${mode === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
        ))}
      </div>

      {/* Timer ring */}
      <div className={`relative ${running ? "ring-pulse" : ""}`}>
        <svg className="w-72 h-72 md:w-96 md:h-96 -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" fill="none" stroke="oklch(0.92 0.005 260)" strokeWidth="3" />
          <circle cx="100" cy="100" r="92" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 578} 578`} className="transition-all duration-1000 ease-linear" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-6xl md:text-7xl font-bold tabular-nums tracking-tight">
            {mins}<span className="text-muted-foreground/40 mx-0.5">:</span>{secs}
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {mode === "focus" ? "Focus" : mode === "short" ? "Short Break" : "Long Break"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-10">
        <button onClick={reset} className="h-11 w-11 grid place-items-center rounded-full border border-border bg-background hover:bg-secondary" aria-label="إعادة">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button onClick={() => setRunning(!running)} className="h-14 px-8 rounded-full bg-primary text-primary-foreground font-semibold flex items-center gap-2 hover:opacity-90 shadow-sm">
          {running ? <><Pause className="h-5 w-5" />إيقاف</> : <><Play className="h-5 w-5" />ابدأ</>}
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className="h-11 w-11 grid place-items-center rounded-full border border-border bg-background hover:bg-secondary" aria-label="إعدادات">
          <SettingsIcon className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">جلسات اليوم: <span className="text-foreground font-semibold">{completedFocus}</span></p>

      {showSettings && (
        <div className="card-soft p-5 mt-8 w-full max-w-md float-in">
          <h3 className="font-bold mb-4 text-sm">الإعدادات</h3>
          {[
            { label: "تركيز (دقيقة)", val: focusMin, set: setFocusMin, min: 5, max: 90 },
            { label: "راحة قصيرة", val: shortMin, set: setShortMin, min: 1, max: 30 },
            { label: "راحة طويلة (بعد 3 جلسات)", val: longMin, set: setLongMin, min: 5, max: 60 },
          ].map((s) => (
            <div key={s.label} className="mb-4 last:mb-0">
              <div className="flex justify-between text-xs mb-1.5"><span className="text-muted-foreground">{s.label}</span><span className="font-bold">{s.val}</span></div>
              <input type="range" min={s.min} max={s.max} value={s.val} onChange={(e) => s.set(Number(e.target.value))} className="w-full accent-primary" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
