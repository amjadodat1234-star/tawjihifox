import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/use-role";
import { Heart, MessageCircle, Trash2, Send, ImageIcon, Video, Pin, X, Flame, CornerDownLeft, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forum")({ component: Forum });

interface Post {
  id: string; user_id: string; title: string; content: string;
  created_at: string; image_url: string | null; pinned: boolean;
}
interface Comment { id: string; user_id: string; content: string; created_at: string; post_id: string; parent_id: string | null }

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return new Date(iso).toLocaleDateString("ar");
}

function isVideoUrl(url: string | null) {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

const VISIBLE_TOP_COMMENTS = 4;

function Forum() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const [counts, setCounts] = useState<Record<string, { likes: number; comments: number; liked: boolean }>>({});
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; postId: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

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

  // Esc closes lightbox
  useEffect(() => {
    if (!lightbox) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox]);

  const onPickFile = (kind: "image" | "video") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const limit = kind === "video" ? 50 : 5;
    if (f.size > limit * 1024 * 1024) return toast.error(`الحجم الأقصى ${limit} ميجا`);
    setMediaFile(f); setMediaKind(kind);
    setMediaPreview(URL.createObjectURL(f));
  };
  const clearMedia = () => {
    setMediaFile(null); setMediaPreview(null); setMediaKind(null);
    if (fileRef.current) fileRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("سجّل دخولك أولاً");
    if (!content.trim() && !mediaFile) return;
    setPosting(true);
    try {
      let image_url: string | null = null;
      if (mediaFile) {
        const ext = mediaFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("forum-media").upload(path, mediaFile);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("forum-media").getPublicUrl(path);
        image_url = data.publicUrl;
      }
      const title = content.split("\n")[0].slice(0, 100) || "منشور";
      const { error } = await supabase.from("posts").insert({ user_id: user.id, title, content: content.trim(), image_url });
      if (error) throw error;
      setContent(""); clearMedia();
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل النشر";
      toast.error(msg);
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

  const loadComments = async (postId: string) => {
    const { data } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at");
    if (!data) return;
    setCommentsByPost((s) => ({ ...s, [postId]: data as Comment[] }));
    const ids = [...new Set(data.map((c) => c.user_id))].filter((id) => !profiles[id]);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      if (profs) {
        setProfiles((s) => {
          const next = { ...s };
          profs.forEach((p) => { next[p.id] = { name: p.display_name || "مستخدم", avatar: p.avatar_url }; });
          return next;
        });
      }
    }
  };

  const openCommentBox = async (postId: string) => {
    if (openComments === postId) { setOpenComments(null); return; }
    setOpenComments(postId);
    if (!commentsByPost[postId]) await loadComments(postId);
  };

  const submitComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("سجّل دخولك للتعليق");
    if (!commentText.trim()) return;
    const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content: commentText.trim(), parent_id: null });
    if (error) return toast.error(error.message || "فشل إرسال التعليق");
    setCommentText("");
    setCounts((s) => ({ ...s, [postId]: { ...s[postId], comments: (s[postId]?.comments || 0) + 1 } }));
    loadComments(postId);
  };

  const submitReply = async (postId: string, parentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("سجّل دخولك للرد");
    if (!replyText.trim()) return;
    const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content: replyText.trim(), parent_id: parentId });
    if (error) return toast.error(error.message || "فشل إرسال الرد");
    setReplyText(""); setReplyingTo(null);
    setCounts((s) => ({ ...s, [postId]: { ...s[postId], comments: (s[postId]?.comments || 0) + 1 } }));
    loadComments(postId);
  };

  const removeComment = async (postId: string, cid: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", cid);
    if (error) return toast.error("تعذّر الحذف");
    setCounts((s) => ({ ...s, [postId]: { ...s[postId], comments: Math.max(0, (s[postId]?.comments || 1) - 1) } }));
    loadComments(postId);
  };

  const renderComment = (cm: Comment, postId: string, isReply = false) => {
    const a = profiles[cm.user_id];
    const replies = (commentsByPost[postId] || []).filter((c) => c.parent_id === cm.id);
    return (
      <div key={cm.id} className={isReply ? "mr-8" : ""}>
        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-[11px] font-bold overflow-hidden flex-shrink-0">
            {a?.avatar ? <img src={a.avatar} alt="" className="w-full h-full object-cover" /> : (a?.name?.[0] || "م")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-2xl px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-bold text-xs">{a?.name || "مستخدم"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{timeAgo(cm.created_at)}</span>
                  {(user?.id === cm.user_id || isAdmin) && (
                    <button onClick={() => removeComment(postId, cm.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words">{cm.content}</p>
            </div>
            {!isReply && (
              <button onClick={() => { setReplyingTo({ commentId: cm.id, postId }); setReplyText(""); }} className="text-[11px] text-muted-foreground hover:text-primary font-bold mt-1 mr-2 inline-flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> رد
              </button>
            )}
            {replyingTo?.commentId === cm.id && user && (
              <form onSubmit={(e) => submitReply(postId, cm.id, e)} className="flex gap-2 mt-2">
                <input
                  value={replyText} onChange={(e) => setReplyText(e.target.value)} autoFocus maxLength={1000}
                  placeholder={`الرد على ${a?.name || "مستخدم"}...`}
                  className="flex-1 rounded-full bg-card border border-border px-3 py-1.5 text-xs outline-none focus:border-primary" />
                <button type="button" onClick={() => setReplyingTo(null)} className="text-[11px] text-muted-foreground px-2">إلغاء</button>
                <button type="submit" disabled={!replyText.trim()} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-3 w-3 rotate-180" /></button>
              </form>
            )}
            {replies.length > 0 && (
              <div className="mt-2 space-y-2">
                {replies.map((r) => renderComment(r, postId, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="شارك أفكارك مع الجميع..."
              maxLength={5000} rows={2}
              className="flex-1 resize-none bg-transparent outline-none text-base placeholder:text-muted-foreground"
            />
          </div>
          {mediaPreview && (
            <div className="relative mt-3 rounded-xl overflow-hidden">
              {mediaKind === "video" ? (
                <video src={mediaPreview} controls className="w-full max-h-80" />
              ) : (
                <img src={mediaPreview} alt="" className="w-full max-h-80 object-cover" />
              )}
              <button type="button" onClick={clearMedia} className="absolute top-2 left-2 bg-foreground/70 text-background rounded-full p-1.5 hover:bg-foreground"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary">
                <ImageIcon className="h-4 w-4 text-emerald-500" /><span>صورة</span>
              </button>
              <button type="button" onClick={() => videoRef.current?.click()} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary">
                <Video className="h-4 w-4 text-rose-500" /><span>فيديو</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile("image")} className="hidden" />
              <input ref={videoRef} type="file" accept="video/*" onChange={onPickFile("video")} className="hidden" />
            </div>
            <button type="submit" disabled={posting || (!content.trim() && !mediaFile)} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
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
          const isVideo = isVideoUrl(p.image_url);
          const isOpen = openComments === p.id;
          const all = commentsByPost[p.id] || [];
          const topLevel = all.filter((cm) => !cm.parent_id);
          const expanded = expandedComments[p.id];
          const shown = expanded ? topLevel : topLevel.slice(0, VISIBLE_TOP_COMMENTS);
          const hiddenCount = topLevel.length - shown.length;
          return (
            <article key={p.id} className="surface-card rounded-2xl overflow-hidden slide-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold overflow-hidden">
                      {author?.avatar ? <img src={author.avatar} alt="" className="w-full h-full object-cover" /> : (author?.name?.[0] || "م")}
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
                    {c.likes > 4 && (
                      <span className="text-xs font-bold text-orange-500 inline-flex items-center gap-0.5"><Flame className="h-3.5 w-3.5" />{c.likes}</span>
                    )}
                    {isAdmin && (
                      <button onClick={() => togglePin(p)} className={`p-1.5 rounded-lg hover:bg-secondary ${p.pinned ? "text-primary" : "text-muted-foreground"}`}>
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
                isVideo ? (
                  <video src={p.image_url} controls className="w-full max-h-[500px] bg-black" />
                ) : (
                  <button onClick={() => setLightbox(p.image_url)} className="block w-full cursor-zoom-in">
                    <img src={p.image_url} alt="" className="w-full max-h-[500px] object-cover hover:opacity-95 transition" />
                  </button>
                )
              )}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border text-sm">
                <button onClick={() => toggleLike(p.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition ${c.liked ? "text-rose-500" : "text-muted-foreground"}`}>
                  <Heart className={`h-4 w-4 ${c.liked ? "fill-current" : ""}`} />
                  <span className="font-semibold">{c.likes}</span>
                </button>
                <button onClick={() => openCommentBox(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition text-muted-foreground">
                  <MessageCircle className="h-4 w-4" />
                  <span className="font-semibold">{c.comments}</span>
                  <span className="hidden sm:inline">تعليق</span>
                </button>
              </div>
              {isOpen && (
                <div className="border-t border-border bg-secondary/30 p-3 space-y-3">
                  {shown.map((cm) => renderComment(cm, p.id))}
                  {hiddenCount > 0 && (
                    <button onClick={() => setExpandedComments((s) => ({ ...s, [p.id]: true }))} className="w-full text-xs font-bold text-primary hover:bg-primary/5 rounded-lg py-2 flex items-center justify-center gap-1">
                      <ChevronDown className="h-3.5 w-3.5" /> عرض المزيد من التعليقات ({hiddenCount})
                    </button>
                  )}
                  {topLevel.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-2">لا توجد تعليقات. كن أوّل من يعلّق ✨</p>
                  )}
                  {user ? (
                    <form onSubmit={(e) => submitComment(p.id, e)} className="flex gap-2 pt-1">
                      <input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        maxLength={1000}
                        placeholder="اكتب تعليقك..."
                        className="flex-1 rounded-full bg-card border border-border px-4 py-2 text-sm outline-none focus:border-primary"
                      />
                      <button type="submit" disabled={!commentText.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4 rotate-180" /></button>
                    </form>
                  ) : (
                    <div className="text-xs text-center text-muted-foreground py-2">
                      <Link to="/login" className="text-primary font-bold underline">سجّل دخولك</Link> للتعليق
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out">
          <button onClick={(e) => { e.stopPropagation(); setLightbox(null); }} className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5"><X className="h-5 w-5" /></button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[95vh] max-w-[95vw] object-contain rounded-lg cursor-default" />
        </div>
      )}
    </div>
  );
}
