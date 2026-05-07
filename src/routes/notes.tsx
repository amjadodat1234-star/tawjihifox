import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notes")({ component: () => <AuthGate><Notes /></AuthGate> });

interface Note { id: string; title: string; content: string; color: string; updated_at: string }

const COLORS = ["amber", "emerald", "sky", "rose", "violet"];
const COLOR_BG: Record<string, string> = {
  amber: "from-amber-500/20 to-orange-500/10 border-amber-400/30",
  emerald: "from-emerald-500/20 to-teal-500/10 border-emerald-400/30",
  sky: "from-sky-500/20 to-blue-500/10 border-sky-400/30",
  rose: "from-rose-500/20 to-pink-500/10 border-rose-400/30",
  violet: "from-violet-500/20 to-purple-500/10 border-violet-400/30",
};

function Notes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Note | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    if (data) setNotes(data as Note[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const save = async () => {
    if (!editing || !user) return;
    if (editing.id) {
      await supabase.from("notes").update({ title: editing.title, content: editing.content, color: editing.color }).eq("id", editing.id);
    } else {
      await supabase.from("notes").insert({ user_id: user.id, title: editing.title, content: editing.content, color: editing.color });
    }
    setEditing(null); load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف المذكرة؟")) return;
    await supabase.from("notes").delete().eq("id", id);
    load();
  };

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold text-gradient-warm">مذكراتي</h1>
          </div>
          <button onClick={() => setEditing({ id: "", title: "", content: "", color: "amber", updated_at: "" })} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4" />مذكرة جديدة</button>
        </div>

        {notes.length === 0 && <p className="text-center text-muted-foreground py-16">لا توجد مذكرات. أضف أوّل مذكرة الآن! 📝</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <div key={n.id} onClick={() => setEditing(n)} className={`rounded-2xl p-5 cursor-pointer border bg-gradient-to-br backdrop-blur hover:scale-[1.02] transition relative ${COLOR_BG[n.color] || COLOR_BG.amber}`}>
              <button onClick={(e) => { e.stopPropagation(); del(n.id); }} className="absolute top-3 left-3 p-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              <h3 className="font-bold mb-2 line-clamp-1">{n.title || "بدون عنوان"}</h3>
              <p className="text-sm text-muted-foreground line-clamp-5 whitespace-pre-wrap">{n.content}</p>
              <p className="text-[10px] text-muted-foreground mt-3">{new Date(n.updated_at).toLocaleDateString("ar")}</p>
            </div>
          ))}
        </div>

        {editing && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setEditing(null)}>
            <div className="glass-strong rounded-2xl p-5 w-full max-w-2xl elev-shadow float-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold">{editing.id ? "تعديل" : "مذكرة جديدة"}</h2>
                <button onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
              </div>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="العنوان" className="w-full rounded-lg bg-secondary/50 px-4 py-2 mb-2 outline-none focus:ring-2 focus:ring-primary" />
              <textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} placeholder="اكتب مذكرتك..." rows={10} className="w-full rounded-lg bg-secondary/50 px-4 py-2 outline-none focus:ring-2 focus:ring-primary resize-none" />
              <div className="flex gap-2 mt-3 mb-3">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEditing({ ...editing, color: c })} className={`h-8 w-8 rounded-full border-2 bg-gradient-to-br ${COLOR_BG[c]} ${editing.color === c ? "ring-2 ring-primary" : ""}`} />
                ))}
              </div>
              <button onClick={save} className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-2.5 font-bold">{editing.id ? "حفظ" : "إنشاء"}</button>
            </div>
          </div>
        )}
      </div>
    </PageBackground>
  );
}
