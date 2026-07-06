import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/AuthGate";
import { Radio, Plus, Users, Lock, Globe, LogIn, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/")({
  head: () => ({
    meta: [
      { title: "غرف المذاكرة الجماعية — توجيهي فوكس" },
      { name: "description", content: "انضم لغرف مذاكرة Live مع تايمر مشترك وشات فوري وترتيب الأعضاء." },
    ],
  }),
  component: () => (
    <AuthGate>
      <RoomsListPage />
    </AuthGate>
  ),
});

interface RoomRow {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  is_public: boolean;
  max_members: number;
  owner_id: string;
  invite_code: string;
  focus_duration_minutes: number;
  break_duration_minutes: number;
}

function RoomsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  // form
  const [form, setForm] = useState({
    name: "",
    subject: "",
    description: "",
    is_public: true,
    max_members: 20,
    focus_duration_minutes: 25,
    break_duration_minutes: 5,
  });

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("public-rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_rooms" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, () => void loadCounts())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("study_rooms")
      .select("id,name,subject,description,is_public,max_members,owner_id,invite_code,focus_duration_minutes,break_duration_minutes")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل الغرف");
    } else {
      setRooms((data ?? []) as RoomRow[]);
      await loadCounts((data ?? []).map((r) => r.id));
    }
    setLoading(false);
  }

  async function loadCounts(ids?: string[]) {
    const roomIds = ids ?? rooms.map((r) => r.id);
    if (roomIds.length === 0) return;
    const { data } = await supabase.from("room_members").select("room_id").in("room_id", roomIds);
    const c: Record<string, number> = {};
    (data ?? []).forEach((r: any) => {
      c[r.room_id] = (c[r.room_id] ?? 0) + 1;
    });
    setCounts(c);
  }

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("اكتب اسم الغرفة");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("study_rooms")
      .insert({
        owner_id: user.id,
        name: form.name.trim(),
        subject: form.subject.trim() || null,
        description: form.description.trim() || null,
        is_public: form.is_public,
        max_members: form.max_members,
        focus_duration_minutes: form.focus_duration_minutes,
        break_duration_minutes: form.break_duration_minutes,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("تعذر إنشاء الغرفة");
      return;
    }
    // auto-join owner
    await supabase.from("room_members").insert({ room_id: data.id, user_id: user.id }).select().single();
    setShowCreate(false);
    toast.success("تم إنشاء الغرفة");
    navigate({ to: "/rooms/$id", params: { id: data.id } });
  }

  async function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim().toLowerCase();
    if (!code) return;
    const { data, error } = await supabase
      .from("study_rooms")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (error || !data) {
      toast.error("رمز غير صحيح");
      return;
    }
    navigate({ to: "/rooms/$id", params: { id: data.id } });
  }

  return (
    <div className="min-h-screen container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            غرف المذاكرة Live
          </h1>
          <p className="text-sm text-muted-foreground mt-1">تايمر مشترك، شات فوري، ترتيب الأعضاء</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          غرفة جديدة
        </button>
      </div>

      <form onSubmit={joinByCode} className="surface-card rounded-2xl p-4 mb-6 flex gap-2 items-center">
        <LogIn className="h-4 w-4 text-muted-foreground" />
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="ادخل رمز دعوة (8 حروف)"
          className="flex-1 bg-transparent outline-none text-sm"
        />
        <button className="bg-secondary text-secondary-foreground rounded-full px-4 py-1.5 text-sm font-bold">
          دخول
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="surface-card rounded-2xl p-10 text-center">
          <p className="text-muted-foreground mb-4">ما في غرف بعد</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-primary-foreground rounded-full px-6 py-2 text-sm font-bold"
          >
            كن أول من ينشئ غرفة
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <Link
              key={r.id}
              to="/rooms/$id"
              params={{ id: r.id }}
              className="surface-card rounded-2xl p-4 hover-lift block"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold flex-1 truncate">{r.name}</h3>
                {r.is_public ? (
                  <Globe className="h-4 w-4 text-accent shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
              {r.subject && <p className="text-xs text-primary mb-1">{r.subject}</p>}
              {r.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{r.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {counts[r.id] ?? 0}/{r.max_members}
                </span>
                <span className="text-primary font-bold">{r.focus_duration_minutes} د</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={createRoom}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-xl font-bold mb-2">غرفة جديدة</h2>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="اسم الغرفة"
              className="w-full bg-input rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="المادة (اختياري)"
              className="w-full bg-input rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف (اختياري)"
              rows={2}
              className="w-full bg-input rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                مدة التركيز (دقيقة)
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={form.focus_duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, focus_duration_minutes: Number(e.target.value) || 25 })
                  }
                  className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none mt-1"
                />
              </label>
              <label className="text-xs">
                مدة الاستراحة (دقيقة)
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.break_duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, break_duration_minutes: Number(e.target.value) || 5 })
                  }
                  className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none mt-1"
                />
              </label>
              <label className="text-xs col-span-2">
                الحد الأقصى للأعضاء
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={form.max_members}
                  onChange={(e) => setForm({ ...form, max_members: Number(e.target.value) || 20 })}
                  className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none mt-1"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
              />
              غرفة عامة (يقدر أي شخص يشوفها ويدخلها)
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-secondary text-secondary-foreground rounded-full py-2 text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 bg-primary text-primary-foreground rounded-full py-2 text-sm font-bold disabled:opacity-50"
              >
                {creating ? "..." : "إنشاء"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
