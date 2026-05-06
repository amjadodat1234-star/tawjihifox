import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Plus, Flame, Trash2 } from "lucide-react";

export const Route = createFileRoute("/habits")({ component: () => <AuthGate><Habits /></AuthGate> });

interface Habit { id: string; name: string; icon: string | null; }

function Habits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!user) return;
    const { data: hs } = await supabase.from("habits").select("*").eq("user_id", user.id);
    const { data: logs } = await supabase.from("habit_logs").select("habit_id").eq("user_id", user.id).eq("log_date", today);
    if (hs) setHabits(hs);
    if (logs) setDoneToday(new Set(logs.map((l) => l.habit_id)));
  };
  useEffect(() => { load(); }, [user]); // eslint-disable-line

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    await supabase.from("habits").insert({ user_id: user.id, name: name.trim() });
    setName(""); load();
  };
  const toggle = async (h: Habit) => {
    if (!user) return;
    if (doneToday.has(h.id)) {
      await supabase.from("habit_logs").delete().eq("habit_id", h.id).eq("log_date", today);
    } else {
      await supabase.from("habit_logs").insert({ habit_id: h.id, user_id: user.id, log_date: today });
    }
    load();
  };
  const remove = async (id: string) => { await supabase.from("habits").delete().eq("id", id); load(); };

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold text-gradient-warm mb-6">العادات اليومية</h1>
        <form onSubmit={add} className="glass-strong rounded-2xl p-4 mb-6 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="عادة جديدة (مثل: قراءة 10 صفحات)" className="flex-1 bg-transparent outline-none px-2" />
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="h-5 w-5" /></button>
        </form>
        <div className="grid gap-3 sm:grid-cols-2">
          {habits.map((h) => {
            const done = doneToday.has(h.id);
            return (
              <div key={h.id} className={`glass rounded-2xl p-5 transition-all ${done ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-start justify-between">
                  <Flame className={`h-6 w-6 ${done ? "text-primary" : "text-muted-foreground"}`} />
                  <button onClick={() => remove(h.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <h3 className="mt-3 font-semibold">{h.name}</h3>
                <button onClick={() => toggle(h)} className={`mt-4 w-full rounded-full py-2 text-sm transition-colors ${done ? "bg-primary text-primary-foreground" : "glass-strong hover:bg-secondary"}`}>
                  {done ? "✓ مكتمل اليوم" : "تحديد كمكتمل"}
                </button>
              </div>
            );
          })}
          {habits.length === 0 && <p className="col-span-full text-center text-muted-foreground py-12">ابدأ ببناء عادة جديدة 🔥</p>}
        </div>
      </div>
    </PageBackground>
  );
}
