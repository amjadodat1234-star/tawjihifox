import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/AuthGate";
import { Radio, Plus, Users, Lock, Globe, LogIn, Loader2, Clock } from "lucide-react";
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
  state: string;
  password_hash: string | null;
  start_time: string | null;
  end_time: string | null;
}

const MAX_DURATION_MIN = 360; // 6h

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const [joinPass, setJoinPass] = useState<{ roomId: string; name: string } | null>(null);
  const [passInput, setPassInput] = useState("");

  const today = todayISO();

  const [form, setForm] = useState({
    name: "",
    subject: "",
    description: "",
    is_public: true,
    max_members: 20,
    focus_duration_minutes: 25,
    break_duration_minutes: 5,
    date: today,
    start_time: nowHHMM(),
    end_time: "",
    password: "",
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
      .select("id,name,subject,description,is_public,max_members,owner_id,invite_code,focus_duration_minutes,break_duration_minutes,state,password_hash,start_time,end_time" as any)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل الغرف");
    } else {
      setRooms((data ?? []) as any as RoomRow[]);
      await loadCounts(((data ?? []) as any[]).map((r) => r.id));
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

  // sort: highest active users first, then non-ended
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aEnded = a.state === "ended" || a.state === "expired";
      const bEnded = b.state === "ended" || b.state === "expired";
      if (aEnded !== bEnded) return aEnded ? 1 : -1;
      return (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
    });
  }, [rooms, counts]);

  function validateSchedule(): string | null {
    if (form.date !== today) return "لا يمكنك إنشاء غرفة ليوم آخر.";
    if (!form.start_time || !form.end_time) return "حدد وقت البداية والنهاية.";
    const start = new Date(`${form.date}T${form.start_time}`);
    const end = new Date(`${form.date}T${form.end_time}`);
    const now = new Date();
    if (start.getTime() < now.getTime() - 60_000) return "وقت البداية يجب أن يكون بعد الوقت الحالي.";
    if (end.getTime() <= start.getTime()) return "وقت النهاية يجب أن يكون بعد وقت البداية.";
    const diffMin = (end.getTime() - start.getTime()) / 60000;
    if (diffMin > MAX_DURATION_MIN) return "مدة الجلسة لا يمكن أن تتجاوز 6 ساعات.";
    return null;
  }

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("اكتب اسم الغرفة");
      return;
    }
    const err = validateSchedule();
    if (err) {
      toast.error(err);
      return;
    }
    if (!form.is_public && !form.password.trim()) {
      toast.error("الغرفة الخاصة تحتاج كلمة سر");
      return;
    }
    setCreating(true);
    const start = new Date(`${form.date}T${form.start_time}`).toISOString();
    const end = new Date(`${form.date}T${form.end_time}`).toISOString();
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
        start_time: start,
        end_time: end,
      } as any)
      .select("id")
      .single();
    if (error || !data) {
      setCreating(false);
      toast.error("تعذر إنشاء الغرفة");
      return;
    }
    if (!form.is_public && form.password.trim()) {
      await supabase.rpc("set_room_password" as any, { _room_id: data.id, _password: form.password.trim() });
    }
    await supabase.rpc("join_room" as any, { _room_id: data.id, _password: form.password.trim() || null });
    setCreating(false);
    setShowCreate(false);
    toast.success("تم إنشاء الغرفة");
    navigate({ to: "/rooms/$id", params: { id: data.id } });
  }

  async function attemptEnter(room: RoomRow, password?: string) {
    const { data, error } = await supabase.rpc("join_room" as any, {
      _room_id: room.id,
      _password: password ?? null,
    });
    if (error) {
      toast.error("تعذر الدخول");
      return;
    }
    const res = data as any;
    if (res?.ok) {
      setJoinPass(null);
      setPassInput("");
      navigate({ to: "/rooms/$id", params: { id: room.id } });
      return;
    }
    switch (res?.reason) {
      case "password_required":
        setJoinPass({ roomId: room.id, name: room.name });
        break;
      case "invalid_password":
        toast.error("كلمة السر غير صحيحة");
        break;
      case "full":
        toast.error("الغرفة ممتلئة");
        break;
      case "ended":
        toast.error("الغرفة منتهية");
        break;
      case "expired":
        toast.error("انتهى وقت الغرفة");
        break;
      default:
        toast.error("تعذر الدخول");
    }
  }

  function handleRoomClick(e: React.MouseEvent, room: RoomRow) {
    e.preventDefault();
    void attemptEnter(room);
  }

  async function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim().toLowerCase();
    if (!code) return;
    const { data, error } = await supabase
      .from("study_rooms")
      .select("id,name,is_public,password_hash,state,max_members,owner_id,focus_duration_minutes,break_duration_minutes,subject,description,invite_code,start_time,end_time" as any)
      .eq("invite_code", code)
      .maybeSingle();
    if (error || !data) {
      toast.error("رمز غير صحيح");
      return;
    }
    await attemptEnter(data as any);
  }

  const stateBadge = (s: string) => {
    const map: Record<string, { t: string; c: string }> = {
      active: { t: "نشطة", c: "bg-accent/20 text-accent" },
      empty: { t: "فارغة", c: "bg-muted text-muted-foreground" },
      full: { t: "ممتلئة", c: "bg-orange-500/20 text-orange-500" },
      locked: { t: "مقفلة", c: "bg-primary/20 text-primary" },
      ended: { t: "منتهية", c: "bg-destructive/20 text-destructive" },
      expired: { t: "انتهى الوقت", c: "bg-destructive/20 text-destructive" },
      created: { t: "جديدة", c: "bg-secondary text-secondary-foreground" },
    };
    const v = map[s] ?? map.created;
    return <span className={`text-[10px] rounded-full px-2 py-0.5 ${v.c}`}>{v.t}</span>;
  };

  return (
    <div className="min-h-screen container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            غرف المذاكرة Live
          </h1>
          <p className="text-sm text-muted-foreground mt-1">تايمر مشترك، شات فوري، مهام وترتيب</p>
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
      ) : sortedRooms.length === 0 ? (
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
          {sortedRooms.map((r) => (
            <Link
              key={r.id}
              to="/rooms/$id"
              params={{ id: r.id }}
              onClick={(e) => handleRoomClick(e, r)}
              className="surface-card rounded-2xl p-4 hover-lift block"
            >
              <div className="flex items-start justify-between mb-2 gap-2">
                <h3 className="font-bold flex-1 truncate">{r.name}</h3>
                <div className="flex items-center gap-1 shrink-0">
                  {r.password_hash ? (
                    <Lock className="h-4 w-4 text-primary" />
                  ) : r.is_public ? (
                    <Globe className="h-4 w-4 text-accent" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="mb-2">{stateBadge(r.state)}</div>
              {r.subject && <p className="text-xs text-primary mb-1">{r.subject}</p>}
              {r.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{r.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {counts[r.id] ?? 0}/{r.max_members}
                </span>
                {r.end_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(r.end_time).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Password prompt */}
      {joinPass && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setJoinPass(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const room = rooms.find((r) => r.id === joinPass.roomId);
              if (room) void attemptEnter(room, passInput);
            }}
            className="bg-card rounded-2xl p-6 w-full max-w-sm space-y-3"
          >
            <h2 className="font-bold flex items-center gap-2">
              <Lock className="h-4 w-4" /> {joinPass.name}
            </h2>
            <p className="text-xs text-muted-foreground">هذه الغرفة تحتاج كلمة سر</p>
            <input
              autoFocus
              type="password"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              placeholder="كلمة السر"
              className="w-full bg-input rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setJoinPass(null);
                  setPassInput("");
                }}
                className="flex-1 bg-secondary rounded-full py-2 text-sm font-bold"
              >
                إلغاء
              </button>
              <button type="submit" className="flex-1 bg-primary text-primary-foreground rounded-full py-2 text-sm font-bold">
                دخول
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create modal */}
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

            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs col-span-3">
                التاريخ (اليوم فقط)
                <input
                  type="date"
                  required
                  value={form.date}
                  min={today}
                  max={today}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none mt-1"
                />
              </label>
              <label className="text-xs">
                البداية
                <input
                  type="time"
                  required
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none mt-1"
                />
              </label>
              <label className="text-xs">
                النهاية
                <input
                  type="time"
                  required
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none mt-1"
                />
              </label>
              <div className="text-[10px] text-muted-foreground col-span-1 self-center">
                (بحد أقصى 6 ساعات)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                تركيز (دقيقة)
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={form.focus_duration_minutes}
                  onChange={(e) => setForm({ ...form, focus_duration_minutes: Number(e.target.value) || 25 })}
                  className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none mt-1"
                />
              </label>
              <label className="text-xs">
                استراحة (دقيقة)
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.break_duration_minutes}
                  onChange={(e) => setForm({ ...form, break_duration_minutes: Number(e.target.value) || 5 })}
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
                onChange={(e) => setForm({ ...form, is_public: e.target.checked, password: e.target.checked ? "" : form.password })}
              />
              غرفة عامة
            </label>
            {!form.is_public && (
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="كلمة سر الغرفة الخاصة"
                className="w-full bg-input rounded-xl px-4 py-2.5 text-sm outline-none"
              />
            )}

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
