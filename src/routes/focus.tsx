import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCohort, subjectsFor, fieldName, subjectName } from "@/lib/cohort";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, SkipForward, Plus, Trash2, Flame, Target, CheckCircle2,
  ArrowRight, ArrowLeft, GraduationCap, Coffee, Brain, Trophy, X,
} from "lucide-react";

export const Route = createFileRoute("/focus")({
  head: () => ({
    meta: [
      { title: "نظام الإنجاز — توجيهي فوكس" },
      { name: "description", content: "حدّد مهمتك ومادتك ومدة الجلسة، وابدأ جلسات تركيز واستراحات منظّمة تُحتسب في تقدّمك وسلسلة أيامك." },
      { property: "og:title", content: "نظام الإنجاز — توجيهي فوكس" },
      { property: "og:description", content: "جلسات تركيز واستراحات ذكية لكل مادة حسب جيلك وحقلك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FocusPage,
});

type Phase = "focus" | "break" | "long_break";

interface Task {
  id: string;
  title: string;
  subject: string | null;
  duration_minutes: number;   // total target minutes
  done_minutes: number;
  sessions_done: number;
  session_minutes: number;
  break_minutes: number;
  long_break_minutes: number;
  status: "pending" | "active" | "completed";
  generation: string | null;
  field: string | null;
}

const GUEST_KEY = "focus_tasks_guest";
const loadGuest = (): Task[] => { try { return JSON.parse(localStorage.getItem(GUEST_KEY) || "[]"); } catch { return []; } };
const saveGuest = (t: Task[]) => localStorage.setItem(GUEST_KEY, JSON.stringify(t));

const fmt = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

function FocusPage() {
  const { user } = useAuth();
  const { generation, field, ready } = useCohort();
  const subjects = subjectsFor(generation, field);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [streak, setStreak] = useState<{ current_streak: number; total_focus_minutes: number } | null>(null);

  // new task form
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [hours, setHours] = useState(1);
  const [mins, setMins] = useState(0);
  const [sessionMin, setSessionMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(10);

  // runner
  const [runId, setRunId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("focus");
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [ask, setAsk] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = useMemo(() => tasks.find((t) => t.id === runId) ?? null, [tasks, runId]);
  const targetMin = hours * 60 + mins;

  const load = useCallback(async () => {
    if (!user) { setTasks(loadGuest()); return; }
    const { data } = await supabase.from("study_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setTasks(data as unknown as Task[]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) { setStreak(null); return; }
    supabase.from("user_streaks").select("current_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setStreak(data ?? { current_streak: 0, total_focus_minutes: 0 }));
  }, [user]);

  useEffect(() => { if (subjects.length && !subject) setSubject(subjects[0].id); }, [subjects, subject]);

  // countdown
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) { setRunning(false); queueMicrotask(onPhaseEnd); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const setBadge = (name: string | null, seconds = 0) => {
    if (!name || seconds <= 0) localStorage.removeItem("activeTask");
    else localStorage.setItem("activeTask", JSON.stringify({ name, endsAt: Date.now() + seconds * 1000 }));
  };

  const createTask = async () => {
    if (!title.trim()) return toast.error("اكتب ماذا ستنجز");
    if (targetMin < 5) return toast.error("الحد الأدنى 5 دقائق");
    if (sessionMin < 5 || sessionMin > 90) return toast.error("مدة الجلسة بين 5 و 90 دقيقة");
    const base = {
      title: title.trim(), subject: subject || null, duration_minutes: targetMin,
      session_minutes: sessionMin, break_minutes: breakMin, long_break_minutes: longBreakMin,
      done_minutes: 0, sessions_done: 0, status: "pending" as const,
      generation: generation, field: field,
    };
    if (user) {
      const { data, error } = await supabase.from("study_tasks").insert({ ...base, user_id: user.id }).select().single();
      if (error) return toast.error(error.message);
      setTasks((t) => [data as unknown as Task, ...t]);
    } else {
      const t: Task = { id: crypto.randomUUID(), ...base };
      const next = [t, ...tasks]; setTasks(next); saveGuest(next);
    }
    setTitle(""); setHours(1); setMins(0);
    toast.success("تمت إضافة المهمة ✨");
  };

  const removeTask = async (id: string) => {
    if (!confirm("حذف المهمة؟")) return;
    if (user) await supabase.from("study_tasks").delete().eq("id", id);
    const next = tasks.filter((t) => t.id !== id);
    setTasks(next); if (!user) saveGuest(next);
    if (runId === id) stopRun();
  };

  const patchTask = async (id: string, patch: Partial<Task>) => {
    const next = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setTasks(next);
    if (user) await supabase.from("study_tasks").update(patch as never).eq("id", id);
    else saveGuest(next);
  };

  const startTask = (t: Task) => {
    const remaining = Math.max(1, t.duration_minutes - t.done_minutes);
    const len = Math.min(t.session_minutes, remaining);
    setRunId(t.id); setPhase("focus"); setSecs(len * 60); setRunning(true);
    setBadge(t.title, len * 60);
    if (t.status === "pending") patchTask(t.id, { status: "active" });
  };

  const stopRun = () => { setRunning(false); setRunId(null); setSecs(0); setPhase("focus"); setBadge(null); };

  const startPhase = (p: Phase, minutes: number, name: string) => {
    setPhase(p); setSecs(minutes * 60); setRunning(true);
    setBadge(p === "focus" ? name : "استراحة", minutes * 60);
  };

  // fires when the countdown reaches zero
  const onPhaseEnd = async () => {
    const t = tasks.find((x) => x.id === runId);
    if (!t) return;
    if (phase !== "focus") {
      const remaining = Math.max(1, t.duration_minutes - t.done_minutes);
      startPhase("focus", Math.min(t.session_minutes, remaining), t.title);
      toast("انتهت الاستراحة — جلسة جديدة 💪");
      return;
    }
    const len = Math.min(t.session_minutes, Math.max(1, t.duration_minutes - t.done_minutes));
    await logSession(t, len);
    const doneMin = t.done_minutes + len;
    const sessions = t.sessions_done + 1;
    const finished = doneMin >= t.duration_minutes;
    await patchTask(t.id, {
      done_minutes: doneMin, sessions_done: sessions,
      status: finished ? "completed" : "active",
      ...(finished ? { completed_at: new Date().toISOString() } as Partial<Task> : {}),
    });
    if (finished) { setBadge(null); setAsk(true); setRunning(false); return; }
    const long = sessions % 3 === 0;
    startPhase(long ? "long_break" : "break", long ? t.long_break_minutes : t.break_minutes, t.title);
    toast.success(long ? "3 جلسات! استراحة طويلة ☕" : "جلسة مكتملة — استراحة قصيرة");
  };

  const logSession = async (t: Task, minutes: number) => {
    if (!user) return;
    await supabase.from("focus_sessions").insert({
      user_id: user.id, duration_minutes: minutes, type: "focus", completed: true,
      task_id: t.id, task_name: t.title, subject: t.subject,
      generation, field,
    } as never);
    const { data } = await supabase.from("user_streaks").select("current_streak, total_focus_minutes").eq("user_id", user.id).maybeSingle();
    if (data) setStreak(data);
  };

  // early finish of the current focus block
  const finishEarly = async () => {
    const t = active; if (!t) return;
    const planned = Math.min(t.session_minutes, Math.max(1, t.duration_minutes - t.done_minutes));
    const elapsed = Math.max(1, planned - Math.ceil(secs / 60));
    setRunning(false);
    if (phase === "focus") {
      await logSession(t, elapsed);
      await patchTask(t.id, { done_minutes: t.done_minutes + elapsed, sessions_done: t.sessions_done + 1 });
    }
    setBadge(null); setAsk(true);
  };

  const closeAsk = async (completed: boolean) => {
    const t = active;
    setAsk(false);
    if (t && completed) await patchTask(t.id, { status: "completed" });
    stopRun();
    toast[completed ? "success" : "message"](completed ? "أنجزت المهمة 🎯" : "تم حفظ تقدّمك، أكمل لاحقاً 💪");
  };

  // ===== runner screen =====
  if (active && !ask) {
    const total = (phase === "focus" ? Math.min(active.session_minutes, Math.max(1, active.duration_minutes - active.done_minutes))
      : phase === "long_break" ? active.long_break_minutes : active.break_minutes) * 60;
    const pct = total > 0 ? ((total - secs) / total) * 100 : 0;
    const isBreak = phase !== "focus";
    return (
      <div className="timer-bg min-h-screen flex flex-col items-center px-4 py-6 text-white">
        <button onClick={stopRun} className="self-start relative z-10 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 backdrop-blur px-4 py-2 text-xs font-bold hover:bg-white/20 mb-6">
          <ArrowRight className="h-4 w-4" /> العودة للمهام
        </button>

        <div className="relative z-10 text-center mb-5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${isBreak ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-200"}`}>
            {isBreak ? <Coffee className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
            {phase === "focus" ? "جلسة تركيز" : phase === "long_break" ? "استراحة طويلة" : "استراحة قصيرة"}
          </span>
          <p className="mt-3 text-xl font-extrabold">{active.title}</p>
          <p className="text-xs text-white/60 mt-1">
            {active.subject ? `${subjectName(active.subject)} · ` : ""}
            الجلسة {active.sessions_done + (isBreak ? 0 : 1)} · {active.done_minutes}/{active.duration_minutes} دقيقة
          </p>
        </div>

        <div className="relative z-10 mb-7">
          <svg className="w-72 h-72 md:w-80 md:h-80 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle cx="100" cy="100" r="92" fill="none" stroke="url(#fg)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 578} 578`} className="transition-all duration-1000" />
            <defs>
              <linearGradient id="fg">
                <stop offset="0%" stopColor={isBreak ? "oklch(0.8 0.15 160)" : "oklch(0.78 0.15 65)"} />
                <stop offset="100%" stopColor="oklch(0.62 0.14 180)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl md:text-7xl font-bold tabular-nums" style={{ textShadow: "0 4px 40px rgba(255,200,100,0.35)" }}>{fmt(secs)}</div>
            <p className="mt-2 text-white/70 text-sm">المتبقي</p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <button onClick={() => setSecs(total)} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20"><RotateCcw className="h-5 w-5" /></button>
          <button onClick={() => setRunning((r) => !r)} className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-foreground shadow-lg hover:scale-105 transition">
            {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 mr-1" />}
          </button>
          {isBreak ? (
            <button onClick={() => { setRunning(false); startPhase("focus", Math.min(active.session_minutes, Math.max(1, active.duration_minutes - active.done_minutes)), active.title); }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/90 hover:bg-emerald-500" title="تخطي الاستراحة"><SkipForward className="h-5 w-5" /></button>
          ) : (
            <button onClick={finishEarly} className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/90 hover:bg-emerald-500" title="إنهاء الجلسة"><CheckCircle2 className="h-5 w-5" /></button>
          )}
        </div>
        <p className="relative z-10 mt-4 text-xs text-white/60">استراحة طويلة تلقائية بعد كل 3 جلسات</p>
      </div>
    );
  }

  const list = tasks.filter((t) => (tab === "open" ? t.status !== "completed" : t.status === "completed"));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient-primary">نظام الإنجاز</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {ready && generation ? `جيل ${generation}${field ? ` — ${fieldName(field)}` : " — المواد المشتركة"}` : "اختر جيلك لتخصيص المواد"}
          </p>
        </div>
        {streak && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-700 px-3 py-1.5 text-sm font-bold"><Flame className="h-4 w-4" />{streak.current_streak}</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm font-bold tabular-nums"><Trophy className="h-4 w-4" />{streak.total_focus_minutes} د</span>
          </div>
        )}
      </div>

      {ready && !generation && (
        <div className="surface-card rounded-2xl p-5 mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span>اختر جيلك وحقلك ليصير كل شيء مخصّص لمسارك.</span>
          </div>
          <Link to="/" className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">اختيار الجيل <ArrowLeft className="h-3.5 w-3.5" /></Link>
        </div>
      )}

      {/* create task */}
      <div className="surface-card rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><Plus className="h-5 w-5" /></span>
          <h2 className="font-extrabold">مهمة جديدة</h2>
        </div>

        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ماذا ستنجز؟</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="مثال: حل أسئلة الوحدة الثالثة"
          className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm outline-none focus:border-primary mb-4" />

        {subjects.length > 0 && (
          <>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">المادة</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {subjects.map((s) => (
                <button key={s.id} onClick={() => setSubject(s.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold border transition ${subject === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="block text-xs font-semibold text-muted-foreground mb-2">كم من الوقت تحتاج لإنجازها؟</label>
        <div className="flex items-center gap-3 mb-4">
          <Stepper value={hours} onChange={setHours} min={0} max={8} label="ساعة" />
          <span className="text-2xl font-extrabold text-muted-foreground">:</span>
          <Stepper value={mins} onChange={setMins} min={0} max={55} step={5} label="دقيقة" />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Field label="الجلسة (د)" value={sessionMin} onChange={setSessionMin} min={5} max={90} />
          <Field label="استراحة قصيرة" value={breakMin} onChange={setBreakMin} min={1} max={30} />
          <Field label="استراحة طويلة" value={longBreakMin} onChange={setLongBreakMin} min={5} max={45} />
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          سيقسم الوقت تلقائياً إلى {Math.max(1, Math.ceil(targetMin / Math.max(5, sessionMin)))} جلسة، مع استراحة طويلة بعد كل 3 جلسات.
        </p>

        <button onClick={createTask} disabled={!title.trim() || targetMin < 5}
          className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent py-3 font-extrabold text-primary-foreground transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100">
          إنشاء المهمة
        </button>
      </div>

      {/* tabs */}
      <div className="surface-card rounded-2xl p-1.5 mb-4 grid grid-cols-2 gap-1">
        {([["open", "قيد الإنجاز"], ["done", "منجزة"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.length === 0 && (
          <div className="surface-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
            <Target className="mx-auto h-8 w-8 text-primary mb-3" />
            {tab === "open" ? "لا توجد مهام بعد — أضف أول مهمة وابدأ." : "لم تنجز أي مهمة بعد."}
          </div>
        )}
        {list.map((t) => {
          const pct = Math.min(100, Math.round((t.done_minutes / Math.max(1, t.duration_minutes)) * 100));
          return (
            <div key={t.id} className="surface-card rounded-2xl p-5 hover-lift">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-extrabold truncate">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t.subject ? `${subjectName(t.subject)} · ` : ""}{t.duration_minutes} دقيقة · جلسة {t.session_minutes} د · {t.sessions_done} جلسة منجزة
                  </p>
                </div>
                <button onClick={() => removeTask(t.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden mb-3">
                <div className={`h-full ${t.status === "completed" ? "bg-emerald-500" : "gradient-anim"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground tabular-nums">{t.done_minutes}/{t.duration_minutes} دقيقة ({pct}%)</span>
                {t.status === "completed" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> منجزة</span>
                ) : (
                  <button onClick={() => startTask(t)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90">
                    <Play className="h-3.5 w-3.5" /> ابدأ الجلسة
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ask && active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4">
          <div className="surface-card rounded-3xl p-8 max-w-md w-full text-center slide-up">
            <button onClick={() => closeAsk(false)} className="float-left rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground"><Target className="h-8 w-8" /></div>
            <h2 className="text-xl font-extrabold mb-1">{active.title}</h2>
            <p className="text-sm text-muted-foreground mb-6">سجّلنا {active.done_minutes} دقيقة. هل أنهيت هذه المهمة؟</p>
            <div className="flex gap-3">
              <button onClick={() => closeAsk(false)} className="flex-1 rounded-2xl bg-secondary py-3 font-bold">لا، سأكمل لاحقاً</button>
              <button onClick={() => closeAsk(true)} className="flex-1 rounded-2xl bg-gradient-to-r from-primary to-accent py-3 font-bold text-primary-foreground">نعم، أنجزتها</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onChange, min, max, step = 1, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-secondary/40 p-3 text-center">
      <div className="flex items-center justify-between">
        <button onClick={() => onChange(Math.max(min, value - step))} className="grid h-8 w-8 place-items-center rounded-lg bg-background hover:bg-secondary">−</button>
        <span className="text-2xl font-extrabold tabular-nums">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + step))} className="grid h-8 w-8 place-items-center rounded-lg bg-background hover:bg-secondary">+</button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-muted-foreground mb-1">{label}</span>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm tabular-nums outline-none focus:border-primary" />
    </label>
  );
}
