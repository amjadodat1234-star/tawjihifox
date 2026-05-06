import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Plus, Trash2, Check } from "lucide-react";

export const Route = createFileRoute("/tasks")({ component: () => <AuthGate><Tasks /></AuthGate> });

interface Task { id: string; title: string; completed: boolean; due_date: string | null; }

function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setTasks(data);
  };
  useEffect(() => { load(); }, [user]); // eslint-disable-line

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    await supabase.from("tasks").insert({ user_id: user.id, title: title.trim() });
    setTitle(""); load();
  };
  const toggle = async (t: Task) => { await supabase.from("tasks").update({ completed: !t.completed }).eq("id", t.id); load(); };
  const remove = async (id: string) => { await supabase.from("tasks").delete().eq("id", id); load(); };

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold text-gradient-warm mb-6">المهام</h1>
        <form onSubmit={add} className="glass-strong rounded-2xl p-4 mb-6 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="أضف مهمة جديدة..." className="flex-1 bg-transparent outline-none px-2" />
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="h-5 w-5" /></button>
        </form>
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="glass rounded-xl p-4 flex items-center gap-3">
              <button onClick={() => toggle(t)} className={`h-6 w-6 rounded-md border-2 flex items-center justify-center ${t.completed ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                {t.completed && <Check className="h-4 w-4 text-primary-foreground" />}
              </button>
              <span className={`flex-1 ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
              <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد مهام بعد ✨</p>}
        </div>
      </div>
    </PageBackground>
  );
}
