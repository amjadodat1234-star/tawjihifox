import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, Plus } from "lucide-react";

export const Route = createFileRoute("/quran")({ component: () => <AuthGate><Quran /></AuthGate> });

interface Log { id: string; pages: number; log_date: string; notes: string | null; }

function Quran() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [pages, setPages] = useState(1);
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("quran_logs").select("*").eq("user_id", user.id).order("log_date", { ascending: false }).limit(30);
    if (data) setLogs(data);
  };
  useEffect(() => { load(); }, [user]); // eslint-disable-line

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await supabase.from("quran_logs").insert({ user_id: user.id, pages, notes: notes || null });
    setPages(1); setNotes(""); load();
  };

  const total = logs.reduce((s, l) => s + l.pages, 0);

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold text-gradient-warm mb-2">ورد القرآن</h1>
        <p className="text-muted-foreground mb-6 text-sm">ثبات على القراءة كل يوم</p>

        <div className="glass-strong rounded-2xl p-6 mb-6 text-center">
          <BookOpen className="h-10 w-10 text-primary mx-auto mb-2" />
          <div className="text-4xl font-bold">{total}</div>
          <p className="text-sm text-muted-foreground mt-1">صفحة في آخر 30 يوم</p>
        </div>

        <form onSubmit={add} className="glass rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm">الصفحات اليوم:</label>
            <input type="number" min={1} max={100} value={pages} onChange={(e) => setPages(Number(e.target.value))} className="w-20 rounded-lg glass-strong px-3 py-1.5 outline-none" />
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className="w-full rounded-lg glass-strong px-3 py-2 outline-none text-sm" />
          <button className="w-full flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-2"><Plus className="h-4 w-4" />تسجيل</button>
        </form>

        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="glass rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{l.pages} صفحة</div>
                {l.notes && <div className="text-xs text-muted-foreground mt-0.5">{l.notes}</div>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(l.log_date).toLocaleDateString("ar")}</span>
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
