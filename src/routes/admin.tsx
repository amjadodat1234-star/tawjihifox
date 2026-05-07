import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-role";
import { ShieldCheck, Users, Eye, MessageSquare, Lightbulb, Trash2, CheckCircle2, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({ component: () => <AuthGate><AdminPanel /></AuthGate> });

function AdminPanel() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ users: 0, totalVisits: 0, todayVisits: 0, posts: 0, suggestions: 0 });
  const [topPaths, setTopPaths] = useState<{ path: string; count: number }[]>([]);
  const [suggs, setSuggs] = useState<{ id: string; user_id: string; content: string; status: string; created_at: string; display_name?: string }[]>([]);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [isAdmin, loading, navigate]);

  const load = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [{ count: users }, { data: visits }, { count: posts }, { data: suggsData }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("page_visits").select("path, visited_at").limit(10000),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
    ]);
    const todayCount = visits?.filter((v) => new Date(v.visited_at) >= today).length || 0;
    const pathMap: Record<string, number> = {};
    visits?.forEach((v) => { pathMap[v.path] = (pathMap[v.path] || 0) + 1; });
    const tops = Object.entries(pathMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, count]) => ({ path, count }));
    setTopPaths(tops);
    setStats({ users: users || 0, totalVisits: visits?.length || 0, todayVisits: todayCount, posts: posts || 0, suggestions: suggsData?.length || 0 });

    if (suggsData?.length) {
      const ids = [...new Set(suggsData.map((s) => s.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = new Map(profs?.map((p) => [p.id, p.display_name]) || []);
      setSuggs(suggsData.map((s) => ({ ...s, display_name: map.get(s.user_id) || "مستخدم" })));
    }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const updateSugg = async (id: string, status: string) => {
    await supabase.from("suggestions").update({ status }).eq("id", id);
    toast.success("تم التحديث");
    load();
  };
  const delSugg = async (id: string) => {
    await supabase.from("suggestions").delete().eq("id", id);
    load();
  };

  if (loading) return <PageBackground><div className="p-8 text-center">...</div></PageBackground>;
  if (!isAdmin) return null;

  const cards = [
    { icon: Users, label: "المستخدمون", value: stats.users, color: "text-primary" },
    { icon: Eye, label: "زيارات اليوم", value: stats.todayVisits, color: "text-emerald-400" },
    { icon: Eye, label: "إجمالي الزيارات", value: stats.totalVisits, color: "text-sky-400" },
    { icon: MessageSquare, label: "المنشورات", value: stats.posts, color: "text-violet-400" },
    { icon: Lightbulb, label: "الاقتراحات", value: stats.suggestions, color: "text-amber-400" },
  ];

  return (
    <PageBackground dim={0.7}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">لوحة الأدمن</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          {cards.map((c) => (
            <div key={c.label} className="glass-strong rounded-2xl p-5">
              <c.icon className={`h-6 w-6 mb-2 ${c.color}`} />
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="glass-strong rounded-2xl p-5 mb-6">
          <h2 className="font-bold mb-3 flex items-center gap-2"><FileText className="h-5 w-5" />أكثر الصفحات زيارة</h2>
          <div className="space-y-2">
            {topPaths.length === 0 && <p className="text-sm text-muted-foreground">لا بيانات بعد</p>}
            {topPaths.map((p) => (
              <div key={p.path} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-lg">
                <code className="text-sm">{p.path}</code>
                <span className="text-sm font-bold tabular-nums">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Lightbulb className="h-5 w-5" />الاقتراحات</h2>
          <div className="space-y-2">
            {suggs.length === 0 && <p className="text-sm text-muted-foreground">لا اقتراحات بعد</p>}
            {suggs.map((s) => (
              <div key={s.id} className="bg-secondary/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-muted-foreground">{s.display_name} · {new Date(s.created_at).toLocaleString("ar")}</div>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 ${s.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : s.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-amber-500/20 text-amber-400"}`}>{s.status}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap mb-2">{s.content}</p>
                <div className="flex gap-2">
                  <button onClick={() => updateSugg(s.id, "approved")} className="text-xs rounded-full px-3 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />موافقة</button>
                  <button onClick={() => updateSugg(s.id, "rejected")} className="text-xs rounded-full px-3 py-1 bg-destructive/20 text-destructive hover:bg-destructive/30 flex items-center gap-1"><XCircle className="h-3 w-3" />رفض</button>
                  <button onClick={() => delSugg(s.id)} className="text-xs rounded-full px-3 py-1 bg-secondary hover:bg-destructive/20 hover:text-destructive flex items-center gap-1"><Trash2 className="h-3 w-3" />حذف</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
