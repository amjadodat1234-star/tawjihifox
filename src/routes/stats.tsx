import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BarChart3, Brain, BookOpen, ListTodo } from "lucide-react";

export const Route = createFileRoute("/stats")({ component: () => <AuthGate><Stats /></AuthGate> });

function Stats() {
  const { user } = useAuth();
  const [data, setData] = useState({ focus: 0, minutes: 0, tasks: 0, doneTasks: 0, pages: 0 });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [{ data: fs }, { data: ts }, { data: qs }] = await Promise.all([
        supabase.from("focus_sessions").select("duration_minutes").eq("user_id", user.id),
        supabase.from("tasks").select("completed").eq("user_id", user.id),
        supabase.from("quran_logs").select("pages").eq("user_id", user.id),
      ]);
      setData({
        focus: fs?.length || 0,
        minutes: fs?.reduce((s, x) => s + x.duration_minutes, 0) || 0,
        tasks: ts?.length || 0,
        doneTasks: ts?.filter((t) => t.completed).length || 0,
        pages: qs?.reduce((s, x) => s + x.pages, 0) || 0,
      });
    })();
  }, [user]);

  const cards = [
    { icon: Brain, label: "جلسات التركيز", value: data.focus, sub: `${data.minutes} دقيقة` },
    { icon: ListTodo, label: "المهام", value: `${data.doneTasks}/${data.tasks}`, sub: "مكتملة" },
    { icon: BookOpen, label: "صفحات قرآن", value: data.pages, sub: "إجمالي" },
  ];

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">الإحصائيات</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="glass-strong rounded-2xl p-6">
              <c.icon className="h-8 w-8 text-primary mb-3" />
              <div className="text-3xl font-bold">{c.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
