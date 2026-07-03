import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { generateStudyPlan, getStudyPlan } from "@/lib/tutor.functions";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { CalendarDays, Sparkles, Target, Loader2, TrendingUp, Flame, LogIn } from "lucide-react";

export const Route = createFileRoute("/plan")({
  component: PlanPage,
  head: () => ({
    meta: [
      { title: "خطة مذاكرة ذكية — توجيهي فوكس" },
      { name: "description", content: "خطة مذاكرة تكيفية تحسب أيامك المتبقية وتوزّع المواد حسب نقاط ضعفك." },
    ],
  }),
});

const DEFAULT_SUBJECTS = ["اللغة العربية", "اللغة الإنجليزية", "التربية الإسلامية", "تاريخ الأردن"];

type SubjRow = { name: string; weakness: number };
type PlanShape = {
  days_left: number;
  daily_hours: number;
  distribution: { name: string; weakness: number; daily_minutes: number }[];
  today_focus: string;
};

function PlanPage() {
  const { user } = useAuth();
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState(3);
  const [subjects, setSubjects] = useState<SubjRow[]>(
    DEFAULT_SUBJECTS.map((n) => ({ name: n, weakness: 3 })),
  );
  const [plan, setPlan] = useState<PlanShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const gen = useServerFn(generateStudyPlan);
  const get = useServerFn(getStudyPlan);

  useEffect(() => {
    if (!user) { setInitial(false); return; }
    get().then((row) => {
      if (row) {
        setExamDate(row.exam_date);
        setDailyHours(Number(row.daily_hours));
        setSubjects(row.subjects as SubjRow[]);
        setPlan(row.plan as PlanShape);
      }
    }).finally(() => setInitial(false));
  }, [user, get]);

  const submit = async () => {
    if (!examDate) return toast.error("اختر تاريخ التوجيهي");
    setLoading(true);
    try {
      const p = await gen({ data: { examDate, dailyHours, subjects } });
      setPlan(p);
      toast.success("تم توليد خطتك 🎯");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally { setLoading(false); }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Target className="mx-auto h-12 w-12 text-primary mb-3" />
        <h1 className="text-2xl font-extrabold mb-2">خطة مذاكرة ذكية</h1>
        <p className="text-sm text-muted-foreground mb-6">سجّل دخولك حتى نبني لك جدولاً يتكيف مع أيامك ونقاط ضعفك.</p>
        <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold">
          <LogIn className="h-4 w-4" /> سجّل دخول
        </Link>
      </div>
    );
  }

  if (initial) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/25">
          <Target className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold">خطة مذاكرتي</h1>
        <p className="mt-1 text-sm text-muted-foreground">توزيع ذكي لوقتك بناءً على نقاط ضعفك</p>
      </motion.div>

      {/* Setup form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface-card rounded-3xl p-5 md:p-6">
        <h2 className="font-bold mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> المدخلات</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">تاريخ التوجيهي</span>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">عدد ساعات المذاكرة اليومية</span>
            <input type="number" min={0.5} max={12} step={0.5} value={dailyHours}
              onChange={(e) => setDailyHours(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">قيّم نقاط ضعفك (1 = قوي، 5 = ضعيف جداً)</p>
          <div className="space-y-2">
            {subjects.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <input type="range" min={1} max={5} value={s.weakness}
                  onChange={(e) => setSubjects((arr) => arr.map((r, j) => j === i ? { ...r, weakness: Number(e.target.value) } : r))}
                  className="flex-1 accent-primary" />
                <span className="w-6 text-center text-sm font-bold text-primary">{s.weakness}</span>
              </div>
            ))}
          </div>
        </div>

        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
          onClick={submit} disabled={loading}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-3 font-bold disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {plan ? "أعِد توليد الخطة" : "ولّد خطتي"}
        </motion.button>
      </motion.div>

      {/* Plan output */}
      {plan && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-3">
          <div className="surface-card rounded-2xl p-5 md:col-span-1 bg-gradient-to-br from-primary/10 to-accent/10">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase"><Flame className="h-3.5 w-3.5" /> عدّ تنازلي</div>
            <div className="mt-2 text-5xl font-extrabold text-gradient-primary tabular-nums">{plan.days_left}</div>
            <div className="text-sm text-muted-foreground">يوم للتوجيهي</div>
          </div>
          <div className="surface-card rounded-2xl p-5 md:col-span-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase"><TrendingUp className="h-3.5 w-3.5" /> تركيز اليوم</div>
            <div className="mt-2 text-2xl font-extrabold">{plan.today_focus}</div>
            <p className="text-sm text-muted-foreground mt-1">هذه أضعف مادة عندك — ابدأ فيها اليوم للحصول على أقصى تحسّن.</p>
            <Link to="/tutor" className="mt-3 inline-flex items-center gap-1 text-sm text-primary font-bold hover:underline">
              اطلب من أستاذ فوكس شرحاً ←
            </Link>
          </div>
          <div className="surface-card rounded-2xl p-5 md:col-span-3">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase mb-3">التوزيع اليومي</div>
            <div className="space-y-2">
              {plan.distribution.map((d) => {
                const maxMin = Math.max(...plan.distribution.map((x) => x.daily_minutes));
                const pct = maxMin ? (d.daily_minutes / maxMin) * 100 : 0;
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{d.name}</span>
                      <span className="tabular-nums text-muted-foreground">{d.daily_minutes} دقيقة</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-primary to-accent" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
