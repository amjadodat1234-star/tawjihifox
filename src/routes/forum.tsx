import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Plus, Trash2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forum")({ component: () => <AuthGate><Forum /></AuthGate> });

interface Post { id: string; user_id: string; title: string; content: string; created_at: string }

function Forum() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

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
    const { error } = await supabase.from("posts").insert({ user_id: user.id, title, content, category: "general" });
    if (error) return toast.error("فشل النشر");
    toast.success("تم النشر");
    setTitle(""); setContent(""); setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المنشور؟")) return;
    await supabase.from("posts").delete().eq("id", id);
    load();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">المنتدى</h1>
          <p className="text-sm text-muted-foreground mt-1">شارك أفكارك وناقش مع الآخرين.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
          {showForm ? <><X className="h-4 w-4" />إلغاء</> : <><Plus className="h-4 w-4" />منشور جديد</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 space-y-3 float-in">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" required maxLength={200} className="w-full rounded-lg bg-secondary px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="اكتب محتوى منشورك..." required maxLength={5000} rows={5} className="w-full rounded-lg bg-secondary px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30 resize-none text-sm" />
          <div className="flex justify-end">
            <button type="submit" className="rounded-full bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:opacity-90">نشر</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {posts.length === 0 && (
          <div className="text-center text-muted-foreground py-16 card-soft">
            <p>لا توجد منشورات بعد.</p>
            <p className="text-xs mt-1">كن أوّل من يبدأ النقاش.</p>
          </div>
        )}
        {posts.map((p) => (
          <article key={p.id} className="card-soft hover-lift p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <Link to="/forum/$id" params={{ id: p.id }} className="flex-1 min-w-0">
                <h3 className="font-bold text-lg leading-snug hover:text-primary transition">{p.title}</h3>
              </Link>
              {p.user_id === user?.id && (
                <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive p-1 rounded" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{p.content}</p>
            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <span>{profiles[p.user_id] || "مستخدم"} · {new Date(p.created_at).toLocaleDateString("ar")}</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{counts[p.id] || 0}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
