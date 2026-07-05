import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Plus, Radio, X, BookOpen, Sparkles, Lock, Globe, KeyRound, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/AuthGate";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/")({
  component: () => <AuthGate><RoomsList /></AuthGate>,
  head: () => ({
    meta: [
      { title: "غرف مذاكرة Live — توجيهي فوكس" },
      { name: "description", content: "انضم لغرف مذاكرة جماعية مع تايمر مشترك وشات مباشر." },
    ],
  }),
});

interface Room {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  owner_id: string;
  max_members: number;
  is_public: boolean;
  invite_code: string;
  timer_state: string;
  created_at: string;
  member_count?: number;
  am_owner?: boolean;
}

const SUBJECTS = ["عربي", "إنجليزي", "تاريخ الأردن", "تربية إسلامية", "علوم إسلامية", "أخرى"];

function RoomsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(20);
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    // RLS returns: public rooms + own rooms
    const { data: rms } = await supabase
      .from("study_rooms")
      .select("id, name, subject, description, owner_id, max_members, is_public, invite_code, timer_state, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (!rms) { setRooms([]); setLoading(false); return; }
    const ids = rms.map((r) => r.id);
    const { data: mem } = await supabase.from("room_members").select("room_id, status").in("room_id", ids);
    const counts = new Map<string, number>();
    (mem || []).forEach((m) => {
      if (m.status === "active") counts.set(m.room_id, (counts.get(m.room_id) || 0) + 1);
    });
    setRooms(rms.map((r) => ({ ...r, member_count: counts.get(r.id) || 0, am_owner: r.owner_id === user?.id })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  useEffect(() => {
    const ch = supabase
      .channel("rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_rooms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  const createRoom = async () => {
    if (!user) return toast.error("سجّل دخولك أولاً");
    if (!name.trim()) return toast.error("اكتب اسم الغرفة");
    setCreating(true);
    const { data, error } = await supabase.from("study_rooms").insert({
      owner_id: user.id,
      name: name.trim(),
      subject,
      description: description.trim() || null,
      is_public: isPublic,
      max_members: Math.max(2, Math.min(50, maxMembers)),
      focus_duration_minutes: Math.max(5, Math.min(120, focusMin)),
      break_duration_minutes: Math.max(3, Math.min(30, breakMin)),
    }).select().single();
    if (error || !data) { setCreating(false); return toast.error(error?.message || "فشل الإنشاء"); }
    await supabase.from("room_members").insert({ room_id: data.id, user_id: user.id, status: "active" });
    setCreating(false);
    setShowNew(false); setName(""); setDescription("");
    toast.success("تم إنشاء الغرفة ✨");
    navigate({ to: "/rooms/$id", params: { id: data.id } });
  };

  const joinByCode = async () => {
    const code = joinCode.trim().toLowerCase();
    if (!code) return toast.error("أدخل الرمز");
    const { data } = await supabase.from("study_rooms").select("id").eq("invite_code", code).maybeSingle();
    if (!data) return toast.error("رمز غير صحيح");
    setShowJoin(false); setJoinCode("");
    navigate({ to: "/rooms/$id", params: { id: data.id } });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gradient-primary flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary animate-pulse" /> غرف مذاكرة Live
          </h1>
          <p className="text-xs text-muted-foreground mt-1">تايمر مشترك، شات لحظي، حضور مباشر — كأنك جنبهم</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowJoin(true)}
            className="rounded-2xl bg-secondary hover:bg-secondary/70 font-bold px-3 py-2.5 text-sm flex items-center gap-1.5">
            <KeyRound className="h-4 w-4" /> رمز غرفة
          </button>
          <button onClick={() => setShowNew(true)}
            className="rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold px-4 py-2.5 text-sm flex items-center gap-2 hover:scale-[1.02] transition shadow-lg">
            <Plus className="h-4 w-4" /> غرفة جديدة
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="surface-card rounded-2xl p-5 h-32 animate-pulse" />)}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border p-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-primary opacity-60" />
          <p className="font-bold mb-1">ما في غرف حالياً</p>
          <p className="text-sm text-muted-foreground mb-4">كن أول من ينشئ غرفة مذاكرة جماعية</p>
          <button onClick={() => setShowNew(true)} className="rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 font-bold text-sm">
            <Plus className="inline h-4 w-4 ml-1" /> إنشاء غرفة
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rooms.map((r) => (
            <Link key={r.id} to="/rooms/$id" params={{ id: r.id }}
              className="surface-card rounded-2xl p-5 hover:scale-[1.01] transition group block">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-extrabold text-lg group-hover:text-primary transition truncate flex items-center gap-1.5">
                  {r.name}
                  {r.am_owner && <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                </h3>
                <span className={`flex items-center gap-1 text-xs rounded-full px-2 py-1 font-bold whitespace-nowrap ${
                  r.timer_state === "running" ? "bg-emerald-100 text-emerald-700" :
                  r.timer_state === "break" ? "bg-amber-100 text-amber-700" :
                  r.timer_state === "paused" ? "bg-slate-200 text-slate-700" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    r.timer_state === "running" ? "bg-emerald-500 animate-pulse" :
                    r.timer_state === "break" ? "bg-amber-500 animate-pulse" :
                    r.timer_state === "paused" ? "bg-slate-500" : "bg-slate-400"
                  }`} />
                  {r.timer_state === "running" ? "تركيز" : r.timer_state === "break" ? "استراحة" : r.timer_state === "paused" ? "متوقفة" : "جاهزة"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {r.subject && (
                  <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold">
                    <BookOpen className="h-3 w-3" /> {r.subject}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-bold ${r.is_public ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {r.is_public ? <><Globe className="h-3 w-3" /> عامة</> : <><Lock className="h-3 w-3" /> خاصة</>}
                </span>
              </div>
              {r.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{r.description}</p>}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-bold text-foreground">{r.member_count}</span>
                <span>/ {r.max_members} عضو</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => !creating && setShowNew(false)}>
          <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold">إنشاء غرفة جديدة</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="h-5 w-5" /></button>
            </div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">اسم الغرفة</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
              placeholder="مثال: جلسة مراجعة عربي"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">المادة</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl bg-secondary/50 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary">
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">الحد الأقصى</label>
                <input type="number" min={2} max={50} value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))}
                  className="w-full rounded-xl bg-secondary/50 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">تركيز (دقيقة)</label>
                <input type="number" min={5} max={120} value={focusMin} onChange={(e) => setFocusMin(Number(e.target.value))}
                  className="w-full rounded-xl bg-secondary/50 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">استراحة (دقيقة)</label>
                <input type="number" min={3} max={30} value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))}
                  className="w-full rounded-xl bg-secondary/50 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">وصف (اختياري)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2}
              placeholder="ماذا ستذاكرون؟"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-3 resize-none" />
            <div className="flex gap-2 mb-4">
              <button onClick={() => setIsPublic(true)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border ${isPublic ? "bg-primary/10 border-primary text-primary" : "border-border bg-secondary/30"}`}>
                <Globe className="h-3.5 w-3.5" /> عامة
              </button>
              <button onClick={() => setIsPublic(false)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border ${!isPublic ? "bg-primary/10 border-primary text-primary" : "border-border bg-secondary/30"}`}>
                <Lock className="h-3.5 w-3.5" /> خاصة (دعوة فقط)
              </button>
            </div>
            <button onClick={createRoom} disabled={!name.trim() || creating}
              className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold py-3 disabled:opacity-50 flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> {creating ? "جاري الإنشاء…" : "إنشاء ودخول"}
            </button>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowJoin(false)}>
          <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold">دخول بالرمز</h2>
              <button onClick={() => setShowJoin(false)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">الصق رمز الدعوة الخاص بالغرفة</p>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="مثال: a3f9c2b1"
              onKeyDown={(e) => { if (e.key === "Enter") joinByCode(); }}
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-3 tracking-widest text-center font-mono" />
            <button onClick={joinByCode} disabled={!joinCode.trim()}
              className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold py-3 disabled:opacity-50">
              دخول
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
