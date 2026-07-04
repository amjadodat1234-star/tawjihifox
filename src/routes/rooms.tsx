import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Plus, Radio, X, BookOpen, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms")({
  component: RoomsList,
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
  created_at: string;
  member_count?: number;
}

const SUBJECTS = ["عربي", "إنجليزي", "تاريخ الأردن", "تربية إسلامية", "علوم إسلامية", "أخرى"];

function RoomsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: rms } = await supabase
      .from("study_rooms")
      .select("id, name, subject, description, owner_id, max_members, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!rms) { setRooms([]); setLoading(false); return; }
    const ids = rms.map((r) => r.id);
    const { data: mem } = await supabase.from("room_members").select("room_id").in("room_id", ids);
    const counts = new Map<string, number>();
    (mem || []).forEach((m) => counts.set(m.room_id, (counts.get(m.room_id) || 0) + 1));
    setRooms(rms.map((r) => ({ ...r, member_count: counts.get(r.id) || 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_rooms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const createRoom = async () => {
    if (!user) return toast.error("سجّل دخولك أولاً");
    if (!name.trim()) return toast.error("اكتب اسم الغرفة");
    const { data, error } = await supabase.from("study_rooms").insert({
      owner_id: user.id, name: name.trim(), subject, description: description.trim() || null,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("room_members").insert({ room_id: data.id, user_id: user.id });
    setShowNew(false); setName(""); setDescription("");
    toast.success("تم إنشاء الغرفة ✨");
    navigate({ to: "/rooms/$id", params: { id: data.id } });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gradient-primary flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary animate-pulse" /> غرف مذاكرة Live
          </h1>
          <p className="text-xs text-muted-foreground mt-1">ذاكر مع غيرك بتايمر مشترك وشات مباشر</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold px-4 py-2.5 text-sm flex items-center gap-2 hover:scale-[1.02] transition shadow-lg">
          <Plus className="h-4 w-4" /> غرفة جديدة
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface-card rounded-2xl p-5 h-32 animate-pulse" />
          ))}
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
              className="surface-card rounded-2xl p-5 hover:scale-[1.01] transition group">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-extrabold text-lg group-hover:text-primary transition truncate">{r.name}</h3>
                <span className="flex items-center gap-1 text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 font-bold whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              {r.subject && (
                <div className="inline-flex items-center gap-1 text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold mb-2">
                  <BookOpen className="h-3 w-3" /> {r.subject}
                </div>
              )}
              {r.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{r.description}</p>}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-bold">{r.member_count}</span>
                <span>/ {r.max_members} عضو</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold">إنشاء غرفة جديدة</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="h-5 w-5" /></button>
            </div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">اسم الغرفة</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
              placeholder="مثال: جلسة مراجعة عربي"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-3" />
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">المادة</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-3">
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">وصف (اختياري)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2}
              placeholder="ماذا ستذاكرون؟"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary mb-4 resize-none" />
            <button onClick={createRoom} disabled={!name.trim()}
              className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold py-3 disabled:opacity-50 flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> إنشاء ودخول
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
