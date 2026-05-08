import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MessageSquare, Plus, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forum")({ component: () => <AuthGate><Forum /></AuthGate> });

interface Post { id: string; user_id: string; title: string; content: string; category: string; created_at: string }

const CATEGORIES = ["general", "religion", "arabic", "english", "history", "tips"];
const CAT_LABEL: Record<string, string> = { general: "عام", religion: "دين", arabic: "عربي", english: "إنجليزي", history: "تاريخ", tips: "نصائح" };

function Forum() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");

  const load = async () => {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (data) {
      setPosts(data as Post[]);
      const ids = [...new Set(data.map((p) => p.user_id))];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
        const map: Record<string, string> = {};
        profs?.forEach((p) => { map[p.id] = p.display_name || "مستخدم"; });
        setProfiles(map);
      }
      const { data: comments } = await supabase.from("comments").select("post_id");
      const c: Record<string, number> = {};
      comments?.forEach((cm) => { c[cm.post_id] = (c[cm.post_id] || 0) + 1; });
      setCounts(c);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("posts").insert({ user_id: user.id, title, content, category });
    if (error) return toast.error("فشل النشر");
    toast.success("تم النشر!");
    setTitle(""); setContent(""); setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المنشور؟")) return;
    await supabase.from("posts").delete().eq("id", id);
    load();
  };

  const filtered = filter === "all" ? posts : posts.filter((p) => p.category === filter);

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold text-gradient-warm">المنتدى</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4" />منشور جديد</button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="glass-strong rounded-2xl p-5 mb-6 space-y-3 float-in">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المنشور" required maxLength={200} className="w-full rounded-lg bg-secondary/50 px-4 py-2 outline-none focus:ring-2 focus:ring-primary" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="محتوى المنشور..." required maxLength={5000} rows={5} className="w-full rounded-lg bg-secondary/50 px-4 py-2 outline-none focus:ring-2 focus:ring-primary resize-none" />
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <button type="button" key={c} onClick={() => setCategory(c)} className={`rounded-full px-4 py-1.5 text-xs ${category === c ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{CAT_LABEL[c]}</button>
              ))}
            </div>
            <button type="submit" className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-2 font-bold">نشر</button>
          </form>
        )}

        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setFilter("all")} className={`rounded-full px-4 py-1.5 text-xs ${filter === "all" ? "bg-primary text-primary-foreground" : "glass-strong"}`}>الكل</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setFilter(c)} className={`rounded-full px-4 py-1.5 text-xs ${filter === c ? "bg-primary text-primary-foreground" : "glass-strong"}`}>{CAT_LABEL[c]}</button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد منشورات. كن أوّل من يبدأ! ✨</p>}
          {filtered.map((p) => (
            <div key={p.id} className="glass-strong rounded-2xl p-5 hover:bg-secondary/30 transition">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link to="/forum/$id" params={{ id: p.id }} className="flex-1">
                  <span className="inline-block text-[10px] bg-primary/20 text-primary rounded-full px-2 py-0.5 mb-2">{CAT_LABEL[p.category]}</span>
                  <h3 className="font-bold text-lg leading-tight hover:text-primary">{p.title}</h3>
                </Link>
                {p.user_id === user?.id && (
                  <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{p.content}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>{profiles[p.user_id] || "مستخدم"} · {new Date(p.created_at).toLocaleDateString("ar")}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{counts[p.id] || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
