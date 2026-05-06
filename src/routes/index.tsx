import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Quote } from "lucide-react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: () => <AuthGate><Focus /></AuthGate> });

const VERSES = [
  "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
  "وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ",
  "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
  "وَقُل رَّبِّ زِدْنِي عِلْمًا",
  "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
];

type Mode = "focus" | "break";

function Focus() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("focus");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [verse] = useState(() => VERSES[Math.floor(Math.random() * VERSES.length)]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDuration = mode === "focus" ? 25 * 60 : 5 * 60;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setRunning(false);
            handleComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]); // eslint-disable-line

  const handleComplete = async () => {
    toast.success(mode === "focus" ? "أحسنت! انتهت جلسة التركيز" : "انتهت الراحة، عُد للتركيز");
    if (mode === "focus" && user) {
      await supabase.from("focus_sessions").insert({ user_id: user.id, duration_minutes: 25, type: "focus" });
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setRunning(false);
    setSeconds(m === "focus" ? 25 * 60 : 5 * 60);
  };
  const reset = () => { setRunning(false); setSeconds(totalDuration); };

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <PageBackground dim={0.5}>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="glass mx-auto mb-12 max-w-xl rounded-2xl px-8 py-5 text-center">
          <Quote className="mx-auto mb-2 h-4 w-4 text-primary/70" />
          <p className="text-base md:text-lg leading-relaxed">{verse}</p>
        </div>

        <div className="text-center">
          <div className="text-[clamp(5rem,18vw,12rem)] font-bold leading-none tracking-tight" style={{ textShadow: "0 4px 40px oklch(0.78 0.15 65 / 0.4)" }}>
            <span>{mins}</span>
            <span className="text-primary mx-2">:</span>
            <span>{secs}</span>
          </div>
          <p className="mt-2 text-muted-foreground text-sm">{mode === "focus" ? "جلسة تركيز" : "جلسة راحة"}</p>
        </div>

        <div className="mt-10 flex items-center gap-4">
          <button onClick={reset} className="flex h-12 w-12 items-center justify-center rounded-full glass-strong hover:bg-secondary transition-colors" aria-label="إعادة">
            <RotateCcw className="h-5 w-5" />
          </button>
          <button onClick={() => setRunning(!running)} className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground glow-warm hover:scale-105 transition-transform" aria-label={running ? "إيقاف" : "تشغيل"}>
            {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 mr-1" />}
          </button>
          <div className="flex flex-col gap-2">
            <button onClick={() => switchMode("focus")} className={`rounded-full px-5 py-1.5 text-sm transition-all ${mode === "focus" ? "bg-primary text-primary-foreground" : "glass hover:bg-secondary"}`}>تركيز</button>
            <button onClick={() => switchMode("break")} className={`rounded-full px-5 py-1.5 text-sm transition-all ${mode === "break" ? "bg-primary text-primary-foreground" : "glass hover:bg-secondary"}`}>راحة</button>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
