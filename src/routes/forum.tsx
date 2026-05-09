import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/use-role";
import { Heart, MessageCircle, Trash2, Send, ImageIcon, Pin, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forum")({ component: Forum });

interface Post {
  id: string; user_id: string; title: string; content: string;
  created_at: string; image_url: string | null; pinned: boolean;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return new Date(iso).toLocaleDateString("ar");
}

function Forum() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const [counts, setCounts] = useState<Record<string, { likes: number; comments: number; liked: boolean }>>({});
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("posts").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (!data) return;
    setPosts(data as Post[]);
    const ids = [...new Set(data.map((p) => p.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      const map: Record<string, { name: string; avatar: string | null }> = {};
      profs?.forEach((p) => { map[p.id] = { name: p.display_name || "مستخدم", avatar: p.avatar_url }; });
      setProfiles(map);
    }
    const { data: comments } = await supabase.from("comments").select("post_id");
    const { data: likes } = await supabase.from("post_likes").select("post_id, user_id");
    const c: Record<string, { likes: number; comments: number; liked: boolean }> = {};
    data.forEach((p) => { c[p.id] = { likes: 0, comments: 0, liked: false }; });
    comments?.forEach((cm) => { if (c[cm.post_id]) c[cm.post_id].comments++; });
    likes?.forEach((l) => {
      if (c[l.post_id]) {
        c[l.post_id].likes++;
        if (user && l.user_id === user.id) c[l.post_id].liked = true;
      }
    });
    setCounts(c);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("الحجم الأقصى 5 ميجا");
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };
  const clearImage = () => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ""; };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("سجّل دخولك أولاً");
    if (!content.trim() && !imageFile) return;
    setPosting(true);
    try {
      let image_url: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("forum-media").upload(path, imageFile);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("forum-media").getPublicUrl(path);
        image_url = data.publicUrl;
      }
      const title = content.split("\n")[0].slice(0, 100) || "منشور";
      const { error } = await supabase.from("posts").insert({ user_id: user.id, title, content: content.trim(), image_url });
      if (error) throw error;
      setContent(""); clearImage();
      load();
    } catch (err: unknown) {
      toast.error("فشل النشر");
      console.error(err);
    } finally { setPosting(false); }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return toast("سجّل دخولك للتفاعل");
    const cur = counts[postId];
    setCounts((s) => ({ ...s, [postId]: { ...cur, liked: !cur.liked, likes: cur.likes + (cur.liked ? -1 : 1) } }));
    if (cur.liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المنشور؟")) return;
    await supabase.from("posts").delete().eq("id", id);
    load();
  };
  const togglePin = async (p: Post) => {
    await supabase.from("posts").update({ pinned: !p.pinned }).eq("id", p.id);
    load();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Composer */}
      {user ? (
        <form onSubmit={submit} className="surface-card rounded-2xl p-4 mb-5 slide-up">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
              {(user.email?.[0] || "?").toUpperCase()}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="شارك أفكارك مع الجميع..."
              maxLength={5000}
              rows={2}
              className="flex-1 resize-none bg-transparent outline-none text-base placeholder:text-muted-foreground"
            />
          </div>
          {imagePreview && (
            <div className="relative mt-3 rounded-xl overflow-hidden">
              <img src={imagePreview} alt="" className="w-full max-h-80 object-cover" />
              <button type="button" onClick={clearImage} className="absolute top-2 left-2 bg-foreground/70 text-background rounded-full p-1.5 hover:bg-foreground"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary transition">
              <ImageIcon className="h-4 w-4 text-emerald-500" />
              <span>صورة</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
            <button type="submit" disabled={posting || (!content.trim() && !imageFile)} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50 hover:opacity-90">
              <Send className="h-3.5 w-3.5 rotate-180" />
              {posting ? "ينشر..." : "نشر"}
            </button>
          </div>
        </form>
      ) : (
        <div className="surface-card rounded-2xl p-5 mb-5 text-center">
          <p className="text-sm text-muted-foreground mb-3">سجّل دخولك للمشاركة في النقاش</p>
          <Link to="/login" className="inline-block rounded-full bg-primary text-primary-foreground px-6 py-2 text-sm font-bold">تسجيل الدخول</Link>
        </div>
      )}

      {/* Feed */}
      <div className="space-y-4">
        {posts.length === 0 && (
          <div className="surface-card rounded-2xl p-12 text-center text-muted-foreground">
            لا توجد منشورات بعد. كن أوّل من يشارك! ✨
          </div>
        )}
        {posts.map((p, i) => {
          const c = counts[p.id] || { likes: 0, comments: 0, liked: false };
          const author = profiles[p.user_id];
          const canDelete = user && (user.id === p.user_id || isAdmin);
          return (
            <article key={p.id} className="surface-card rounded-2xl overflow-hidden slide-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
                      {author?.avatar ? <img src={author.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : (author?.name?.[0] || "م")}
                    </div>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-1.5">
                        {author?.name || "مستخدم"}
                        {p.user_id === user?.id && <span className="text-[10px] text-primary">(أنت)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{timeAgo(p.created_at)}{p.pinned && <span className="mr-2 text-primary inline-flex items-center gap-1"><Pin className="h-3 w-3" />مثبّت</span>}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <button onClick={() => togglePin(p)} className={`p-1.5 rounded-lg hover:bg-secondary ${p.pinned ? "text-primary" : "text-muted-foreground"}`} aria-label="تثبيت">
                        <Pin className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap mb-3">{p.content}</p>
              </div>
              {p.image_url && (
                <Link to="/forum/$id" params={{ id: p.id }}>
                  <img src={p.image_url} alt="" className="w-full max-h-[500px] object-cover" />
                </Link>
              )}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border text-sm">
                <button onClick={() => toggleLike(p.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition ${c.liked ? "text-rose-500" : "text-muted-foreground"}`}>
                  <Heart className={`h-4 w-4 ${c.liked ? "fill-current" : ""}`} />
                  <span className="font-semibold">{c.likes}</span>
                </button>
                <Link to="/forum/$id" params={{ id: p.id }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition text-muted-foreground">
                  <MessageCircle className="h-4 w-4" />
                  <span className="font-semibold">{c.comments}</span>
                  <span className="hidden sm:inline">تعليق</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
