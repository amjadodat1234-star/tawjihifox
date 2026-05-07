import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ChevronRight, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forum/$id")({ component: () => <AuthGate><PostPage /></AuthGate> });

interface Post { id: string; user_id: string; title: string; content: string; category: string; created_at: string }
interface Comment { id: string; user_id: string; content: string; created_at: string }

function PostPage() {
  const { id } = useParams({ from: "/forum/$id" });
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [text, setText] = useState("");

  const load = async () => {
    const { data: p } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
    if (p) setPost(p as Post);
    const { data: cs } = await supabase.from("comments").select("*").eq("post_id", id).order("created_at");
    if (cs) {
      setComments(cs as Comment[]);
      const ids = [...new Set([...cs.map((c) => c.user_id), p?.user_id].filter(Boolean) as string[])];
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map: Record<string, string> = {};
      profs?.forEach((pr) => { map[pr.id] = pr.display_name || "مستخدم"; });
      setProfiles(map);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("comments").insert({ post_id: id, user_id: user.id, content: text.trim() });
    if (error) return toast.error("فشل");
    setText(""); load();
  };

  const removeComment = async (cid: string) => {
    await supabase.from("comments").delete().eq("id", cid);
    load();
  };

  if (!post) return <PageBackground><div className="p-8 text-center">جارٍ التحميل...</div></PageBackground>;

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/forum" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"><ChevronRight className="h-4 w-4" />العودة للمنتدى</Link>
        <div className="glass-strong rounded-2xl p-6 mb-6">
          <h1 className="text-2xl font-bold mb-3">{post.title}</h1>
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
            بقلم {profiles[post.user_id] || "مستخدم"} · {new Date(post.created_at).toLocaleString("ar")}
          </p>
        </div>

        <h2 className="font-bold text-lg mb-3">التعليقات ({comments.length})</h2>
        <form onSubmit={submit} className="flex gap-2 mb-4">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="اكتب تعليقك..." className="flex-1 rounded-full glass-strong px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
          <button type="submit" disabled={!text.trim()} className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground disabled:opacity-50"><Send className="h-5 w-5 rotate-180" /></button>
        </form>

        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="glass rounded-xl p-4 flex justify-between gap-2">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{profiles[c.user_id] || "مستخدم"} · {new Date(c.created_at).toLocaleString("ar")}</div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </div>
              {c.user_id === user?.id && <button onClick={() => removeComment(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
