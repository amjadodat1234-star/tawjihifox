import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BarChart3, Brain, BookOpen, GraduationCap, Flame, Trophy, FileText, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/stats")({ component: () => <AuthGate><Stats /></AuthGate> });

interface Attempt { subject: string; score: number; total: number; created_at: string }

function Stats() {
  const { user } = useAuth();
  const [data, setData] = useState({ focus: 0, minutes: 0, pages: 0, exams: 0, avgScore: 0, posts: 0, notes: 0, currentStreak: 0, longestStreak: 0 });
  const [recentAttempts, setRecentAttempts] = useState<Attempt[]>([]);
  const [weekly, setWeekly] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: fs }, { data: qs }, { data: attempts }, { data: posts }, { data: notes }, { data: streak }] = await Promise.all([
        supabase.from("focus_sessions").select("duration_minutes, completed_at").eq("user_id", user.id),
        supabase.from("quran_logs").select("pages").eq("user_id", user.id),
        supabase.from("exam_attempts").select("subject, score, total, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("posts").select("id").eq("user_id", user.id),
        supabase.from("notes").select("id").eq("user_id", user.id),
        supabase.from("user_streaks").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle(),
      ]);
      const totalMin = fs?.reduce((s, x) => s + x.duration_minutes, 0) || 0;
      const totalScore = attempts?.reduce((s, a) => s + (a.score / a.total) * 100, 0) || 0;
      setData({
        focus: fs?.length || 0,
        minutes: totalMin,
        pages: qs?.reduce((s, x) => s + x.pages, 0) || 0,
        exams: attempts?.length || 0,
        avgScore: attempts?.length ? Math.round(totalScore / attempts.length) : 0,
        posts: posts?.length || 0,
        notes: notes?.length || 0,
        currentStreak: streak?.current_streak || 0,
        longestStreak: streak?.longest_streak || 0,
      });
      setRecentAttempts(attempts || []);
      // Weekly focus minutes (last 7 days)
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const weeks = [0, 0, 0, 0, 0, 0, 0];
      fs?.forEach((s) => {
        const d = new Date(s.completed_at); d.setHours(0, 0, 0, 0);
        const diff = Math.floor((today.getTime() - d.getTime()) / (24 * 3600 * 1000));
        if (diff >= 0 && diff < 7) weeks[6 - diff] += s.duration_minutes;
      });
      setWeekly(weeks);
    })();
  }, [user]);

  const cards = [
    { icon: Flame, label: "السترك الحالي", value: data.currentStreak, sub: "يوم", color: "text-orange-400" },
    { icon: Trophy, label: "أطول سترك", value: data.longestStreak, sub: "يوم", color: "text-yellow-400" },
    { icon: Brain, label: "جلسات تركيز", value: data.focus, sub: `${data.minutes} دقيقة`, color: "text-primary" },
    { icon: GraduationCap, label: "اختبارات", value: data.exams, sub: `${data.avgScore}% متوسط`, color: "text-emerald-400" },
    { icon: BookOpen, label: "صفحات قرآن", value: data.pages, sub: "إجمالي", color: "text-teal-400" },
    { icon: FileText, label: "مذكرات", value: data.notes, sub: "محفوظة", color: "text-violet-400" },
    { icon: MessageSquare, label: "منشورات", value: data.posts, sub: "في المنتدى", color: "text-sky-400" },
  ];

  const maxWeek = Math.max(...weekly, 1);
  const days = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
  const today = new Date().getDay();
  const dayLabels = Array.from({ length: 7 }, (_, i) => days[(today - 6 + i + 7) % 7]);

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">إحصائياتك</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {cards.map((c) => (
            <div key={c.label} className="glass-strong rounded-2xl p-5">
              <c.icon className={`h-7 w-7 mb-3 ${c.color}`} />
              <div className="text-2xl font-bold tabular-nums">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        <div className="glass-strong rounded-2xl p-5 mb-6">
          <h2 className="font-bold mb-4">دقائق التركيز — آخر 7 أيام</h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {weekly.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[10px] text-muted-foreground">{m || ""}</div>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-primary to-accent transition-all" style={{ height: `${(m / maxWeek) * 100}%`, minHeight: m > 0 ? "4px" : "0" }} />
                <div className="text-[10px] text-muted-foreground">{dayLabels[i]}</div>
              </div>
            ))}
          </div>
        </div>

        {recentAttempts.length > 0 && (
          <div className="glass-strong rounded-2xl p-5">
            <h2 className="font-bold mb-3">آخر الاختبارات</h2>
            <div className="space-y-2">
              {recentAttempts.map((a, i) => {
                const pct = Math.round((a.score / a.total) * 100);
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-bold text-sm">{a.subject}</p>
                      <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("ar")}</p>
                    </div>
                    <div className={`text-lg font-bold ${pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-destructive"}`}>{a.score}/{a.total}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageBackground>
  );
}
