import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/AuthGate";
import { secondsLeft, fmt, type RoomTimerRow } from "@/lib/room-timer";
import {
  ArrowRight, Play, Pause, Square, Coffee, RotateCcw, Send, Users, Trophy,
  Copy, Loader2, Crown, Settings, Lock, Unlock, Pin, UserX, Plus, Check,
  Trash2, Clock, LogOut,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/$id")({
  head: () => ({
    meta: [
      { title: "غرفة مذاكرة Live — توجيهي فوكس" },
      { name: "description", content: "غرفة مذاكرة مع تايمر مشترك وشات مباشر" },
    ],
  }),
  component: () => <AuthGate><RoomPage /></AuthGate>,
});

interface RoomRow extends RoomTimerRow {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  owner_id: string;
  invite_code: string;
  is_public: boolean;
  max_members: number;
  state: string;
  password_hash: string | null;
  pinned_message: string | null;
  start_time: string | null;
  end_time: string | null;
  completed_sessions: number;
  error_count: number;
}
interface MemberRow { id: string; user_id: string; focus_minutes: number; joined_at: string; }
interface MessageRow { id: string; user_id: string; content: string; created_at: string; }
interface Profile { id: string; display_name: string | null; avatar_url: string | null; }
interface TaskRow { id: string; room_id: string; title: string; created_by: string; created_at: string; position: number; }
interface TaskCompletion { id: string; task_id: string; user_id: string; completed_at: string; }

function RoomPage() {
  const { id: roomId } = useParams({ from: "/rooms/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [presence, setPresence] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "members" | "tasks" | "board">("chat");
  const [tick, setTick] = useState(0);
  const [msgDraft, setMsgDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [passDraft, setPassDraft] = useState("");
  const [extendMin, setExtendMin] = useState(15);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const creditedRef = useRef<string | null>(null);

  // Join via RPC first
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setJoining(true);
      const { data, error } = await supabase.rpc("join_room" as any, { _room_id: roomId, _password: null });
      if (!alive) return;
      if (error) {
        setError("تعذر الدخول للغرفة");
        setJoining(false);
        setLoading(false);
        return;
      }
      const res = data as any;
      if (!res?.ok) {
        const reason = res?.reason;
        if (reason === "password_required") {
          setError("هذه الغرفة تحتاج كلمة سر — ادخل عن طريق قائمة الغرف");
        } else if (reason === "full") setError("الغرفة ممتلئة");
        else if (reason === "ended") setError("الغرفة منتهية");
        else if (reason === "expired") setError("انتهى وقت الغرفة");
        else if (reason === "not_found") setError("الغرفة غير موجودة");
        else setError("تعذر الدخول");
        setJoining(false);
        setLoading(false);
        return;
      }
      setJoining(false);
      await loadAll();
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  async function loadAll() {
    const { data: r } = await supabase.from("study_rooms").select("*").eq("id", roomId).maybeSingle();
    if (r) {
      setRoom(r as any as RoomRow);
      setPinDraft((r as any).pinned_message ?? "");
    }
    await Promise.all([loadMembers(), loadMessages(), loadTasks()]);
  }

  async function loadMembers() {
    const { data } = await supabase
      .from("room_members").select("id,user_id,focus_minutes,joined_at")
      .eq("room_id", roomId).order("joined_at", { ascending: true });
    const rows = (data ?? []) as MemberRow[];
    setMembers(rows);
    await ensureProfiles(rows.map((m) => m.user_id));
  }
  async function loadMessages() {
    const { data } = await supabase
      .from("room_messages").select("id,user_id,content,created_at")
      .eq("room_id", roomId).order("created_at", { ascending: true }).limit(200);
    const rows = (data ?? []) as MessageRow[];
    setMessages(rows);
    await ensureProfiles(rows.map((m) => m.user_id));
  }
  async function loadTasks() {
    const { data: t } = await supabase.from("room_tasks" as any)
      .select("*").eq("room_id", roomId).order("position", { ascending: true });
    setTasks((t ?? []) as any as TaskRow[]);
    const ids = ((t ?? []) as any[]).map((x) => x.id);
    if (ids.length === 0) { setCompletions([]); return; }
    const { data: c } = await supabase.from("room_task_completions" as any)
      .select("*").in("task_id", ids);
    setCompletions((c ?? []) as any as TaskCompletion[]);
  }
  async function ensureProfiles(userIds: string[]) {
    const missing = Array.from(new Set(userIds)).filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", missing);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        (data as Profile[]).forEach((p) => (next[p.id] = p));
        return next;
      });
    }
  }

  // Realtime
  useEffect(() => {
    if (!user || !room) return;
    const ch = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom((r) => (r ? ({ ...r, ...(payload.new as any) } as RoomRow) : r)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "study_rooms", filter: `id=eq.${roomId}` },
        () => { toast.error("تم حذف الغرفة"); navigate({ to: "/rooms" }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => void loadMembers())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          await ensureProfiles([m.user_id]);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_tasks", filter: `room_id=eq.${roomId}` },
        () => void loadTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_task_completions" },
        () => void loadTasks())
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, Array<{ user_id: string }>>;
        const online = new Set<string>();
        Object.values(state).forEach((arr) => arr.forEach((p) => online.add(p.user_id)));
        setPresence(online);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id, !!room]);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, tab]);

  // Focus credit + completed session count
  useEffect(() => {
    if (!room || !user) return;
    if (room.timer_state !== "finished" || room.timer_mode !== "focus") return;
    const key = `${room.id}:${room.timer_ends_at ?? ""}`;
    if (creditedRef.current === key) return;
    creditedRef.current = key;
    (async () => {
      const mins = room.focus_duration_minutes;
      const mine = members.find((m) => m.user_id === user.id);
      if (mine) {
        await supabase.from("room_members").update({ focus_minutes: mine.focus_minutes + mins }).eq("id", mine.id);
      }
      await supabase.from("focus_sessions").insert({ user_id: user.id, duration_minutes: mins, type: "focus" });
      if (room.owner_id === user.id) {
        await supabase.from("study_rooms").update({ completed_sessions: room.completed_sessions + 1 } as any).eq("id", room.id);
      }
      toast.success(`+${mins} دقيقة تركيز`);
    })();
  }, [room?.timer_state, room?.timer_mode, room?.timer_ends_at, user?.id]); // eslint-disable-line

  // Auto-expire check
  useEffect(() => {
    if (!room?.end_time) return;
    const check = () => {
      if (room.end_time && new Date(room.end_time).getTime() < Date.now() && room.state !== "expired" && room.state !== "ended") {
        void supabase.rpc("refresh_room_state" as any, { _room_id: roomId });
      }
    };
    check();
    const i = setInterval(check, 15000);
    return () => clearInterval(i);
  }, [room?.end_time, room?.state, roomId]);

  const isOwner = !!user && !!room && user.id === room.owner_id;
  const secs = room ? secondsLeft(room, Date.now() + tick * 0) : 0;
  const totalSecs = room ? (room.timer_mode === "break" ? room.break_duration_minutes : room.focus_duration_minutes) * 60 : 1;
  const progress = room ? 1 - secs / totalSecs : 0;

  // Ranking: completed count desc, then last completion time asc (faster first)
  const rankedMembers = useMemo(() => {
    const compsPerUser = new Map<string, TaskCompletion[]>();
    for (const c of completions) {
      const arr = compsPerUser.get(c.user_id) ?? [];
      arr.push(c);
      compsPerUser.set(c.user_id, arr);
    }
    const totalTasks = tasks.length;
    return [...members]
      .map((m) => {
        const cs = compsPerUser.get(m.user_id) ?? [];
        const last = cs.length ? Math.max(...cs.map((c) => new Date(c.completed_at).getTime())) : Infinity;
        return { m, done: cs.length, last, allDone: totalTasks > 0 && cs.length >= totalTasks };
      })
      .sort((a, b) => {
        if (b.done !== a.done) return b.done - a.done;
        if (a.done > 0) return a.last - b.last;
        return b.m.focus_minutes - a.m.focus_minutes;
      });
  }, [members, completions, tasks.length]);

  async function updateTimer(patch: Partial<RoomRow>) {
    if (!room || !isOwner) return;
    const { error } = await supabase.from("study_rooms").update(patch as any).eq("id", room.id);
    if (error) toast.error("تعذر التحديث");
  }
  async function startFocus() {
    if (!room) return;
    const s = room.timer_state === "paused" && room.timer_mode === "focus"
      ? (room.timer_paused_seconds_left ?? room.focus_duration_minutes * 60)
      : room.focus_duration_minutes * 60;
    await updateTimer({
      timer_state: "running", timer_mode: "focus",
      timer_ends_at: new Date(Date.now() + s * 1000).toISOString(),
      timer_paused_seconds_left: null,
    });
  }
  async function pauseTimer() {
    if (!room) return;
    await updateTimer({ timer_state: "paused", timer_paused_seconds_left: secondsLeft(room), timer_ends_at: null });
  }
  async function startBreak() {
    if (!room) return;
    const focusLeft = room.timer_mode === "focus" && (room.timer_state === "running" || room.timer_state === "paused")
      ? secondsLeft(room) : null;
    await updateTimer({
      timer_state: "break", timer_mode: "break",
      timer_ends_at: new Date(Date.now() + room.break_duration_minutes * 60 * 1000).toISOString(),
      timer_paused_seconds_left: focusLeft,
    });
  }
  async function endBreakResumeFocus() {
    if (!room) return;
    const focusLeft = room.timer_paused_seconds_left ?? room.focus_duration_minutes * 60;
    await updateTimer({
      timer_state: "running", timer_mode: "focus",
      timer_ends_at: new Date(Date.now() + focusLeft * 1000).toISOString(),
      timer_paused_seconds_left: null,
    });
  }
  async function resetTimer() {
    if (!room) return;
    await updateTimer({ timer_state: "idle", timer_mode: "focus", timer_ends_at: null, timer_paused_seconds_left: null });
    creditedRef.current = null;
  }
  async function finishNow() {
    if (!room) return;
    await updateTimer({ timer_state: "finished", timer_ends_at: new Date().toISOString() });
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = msgDraft.trim();
    if (!content || !user) return;
    setMsgDraft("");
    const { error } = await supabase.from("room_messages").insert({ room_id: roomId, user_id: user.id, content });
    if (error) { toast.error("تعذر إرسال الرسالة"); setMsgDraft(content); }
  }

  async function leaveRoom() {
    if (!user) return;
    await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
    navigate({ to: "/rooms" });
  }

  function copyInvite() {
    if (!room) return;
    void navigator.clipboard.writeText(`${window.location.origin}/rooms/${room.id}`);
    toast.success("تم نسخ الرابط");
  }

  async function addTask() {
    if (!isOwner || !user || !newTask.trim()) return;
    const { error } = await supabase.from("room_tasks" as any).insert({
      room_id: roomId, title: newTask.trim(), created_by: user.id, position: tasks.length,
    });
    if (error) toast.error("تعذر إضافة المهمة");
    else setNewTask("");
  }
  async function deleteTask(id: string) {
    if (!isOwner) return;
    await supabase.from("room_tasks" as any).delete().eq("id", id);
  }
  async function toggleTask(taskId: string) {
    if (!user) return;
    const existing = completions.find((c) => c.task_id === taskId && c.user_id === user.id);
    if (existing) {
      await supabase.from("room_task_completions" as any).delete().eq("id", existing.id);
    } else {
      const { error } = await supabase.from("room_task_completions" as any).insert({ task_id: taskId, user_id: user.id });
      if (error) toast.error("تعذر الحفظ");
    }
  }

  async function savePin() {
    if (!isOwner) return;
    await supabase.from("study_rooms").update({ pinned_message: pinDraft.trim() || null } as any).eq("id", roomId);
    toast.success("تم حفظ التثبيت");
  }
  async function saveLock() {
    const { data, error } = await supabase.rpc("set_room_password" as any, { _room_id: roomId, _password: passDraft || null });
    if (error) return toast.error("تعذر الحفظ");
    const res = data as any;
    if (res?.ok) { toast.success(passDraft ? "تم قفل الغرفة" : "تم إلغاء القفل"); setPassDraft(""); }
  }
  async function extendRoom() {
    const { data, error } = await supabase.rpc("extend_room" as any, { _room_id: roomId, _add_minutes: extendMin });
    if (error) return toast.error("تعذر التمديد");
    const res = data as any;
    if (res?.ok) toast.success(`تم التمديد ${extendMin} دقيقة`);
    else if (res?.reason === "exceeds_6h") toast.error("لا يمكن تجاوز 6 ساعات كحد أقصى");
    else toast.error("تعذر التمديد");
  }
  async function endSession() {
    if (!isOwner || !confirm("إنهاء الغرفة نهائياً؟")) return;
    await supabase.from("study_rooms").update({ state: "ended", ended_at: new Date().toISOString() } as any).eq("id", roomId);
    toast.success("تم إنهاء الغرفة");
  }
  async function kickUser(uid: string) {
    if (!isOwner) return;
    if (!confirm("طرد هذا العضو؟")) return;
    const { data } = await supabase.rpc("kick_member" as any, { _room_id: roomId, _user_id: uid });
    const res = data as any;
    if (res?.ok) toast.success("تم الطرد"); else toast.error("تعذر الطرد");
  }

  if (loading || joining) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-muted-foreground">{error ?? "غرفة غير متوفرة"}</p>
        <button onClick={() => navigate({ to: "/rooms" })} className="bg-primary text-primary-foreground rounded-full px-6 py-2 text-sm font-bold">
          رجوع للغرف
        </button>
      </div>
    );
  }

  const myCompletionIds = new Set(completions.filter((c) => c.user_id === user?.id).map((c) => c.task_id));

  return (
    <div className="min-h-screen container mx-auto px-4 py-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <button onClick={() => navigate({ to: "/rooms" })} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" />
          الغرف
        </button>
        <div className="text-center flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate flex items-center gap-2 justify-center">
            {room.name}
            {room.password_hash && <Lock className="h-4 w-4 text-primary" />}
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs mt-1">
            <span className="text-primary">{room.subject}</span>
            <StateBadge state={room.state} />
            {room.end_time && (
              <span className="text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                حتى {new Date(room.end_time).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={copyInvite} className="p-2 rounded-full bg-secondary" title="نسخ الرابط">
            <Copy className="h-4 w-4" />
          </button>
          {isOwner && (
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full bg-secondary" title="إعدادات">
              <Settings className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setConfirmLeave(true)} className="px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold flex items-center gap-1">
            <LogOut className="h-3 w-3" /> مغادرة
          </button>
        </div>
      </div>

      {/* Pinned */}
      {room.pinned_message && (
        <div className="mb-4 surface-card rounded-2xl p-3 flex items-start gap-2 border-r-4 border-primary">
          <Pin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm flex-1">{room.pinned_message}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Timer */}
        <div className="lg:col-span-2 timer-bg rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="text-xs uppercase tracking-widest text-white/60 mb-3">
              {room.timer_mode === "break" ? "استراحة" : "تركيز"} ·{" "}
              {room.timer_state === "running" ? "شغّال" : room.timer_state === "paused" ? "متوقف" : room.timer_state === "break" ? "استراحة" : room.timer_state === "finished" ? "انتهى" : "جاهز"}
            </div>
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 mb-6">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                <circle cx="50" cy="50" r="45"
                  stroke={room.timer_mode === "break" ? "#22c55e" : "#8b5cf6"}
                  strokeWidth="4" fill="none"
                  strokeDasharray={`${progress * 283} 283`}
                  strokeLinecap="round" className="transition-all" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <div className="text-5xl sm:text-6xl font-bold tabular-nums">{fmt(secs)}</div>
                <div className="text-xs text-white/50 mt-2 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {presence.size} متصل · {members.length} عضو
                </div>
              </div>
            </div>
            {isOwner ? (
              <div className="flex flex-wrap gap-2 justify-center">
                {room.timer_state === "running" && room.timer_mode === "focus" && (
                  <>
                    <button onClick={pauseTimer} className="bg-white/10 rounded-full px-5 py-2 text-sm flex items-center gap-1"><Pause className="h-4 w-4" /> إيقاف</button>
                    <button onClick={startBreak} className="bg-accent rounded-full px-5 py-2 text-sm flex items-center gap-1"><Coffee className="h-4 w-4" /> استراحة</button>
                    <button onClick={finishNow} className="bg-white/10 rounded-full px-5 py-2 text-sm flex items-center gap-1"><Square className="h-4 w-4" /> إنهاء</button>
                  </>
                )}
                {(room.timer_state === "idle" || room.timer_state === "paused" || room.timer_state === "finished") && (
                  <button onClick={startFocus} className="bg-primary rounded-full px-6 py-2 text-sm font-bold flex items-center gap-1">
                    <Play className="h-4 w-4" /> {room.timer_state === "paused" ? "استكمال" : "ابدأ تركيز"}
                  </button>
                )}
                {room.timer_state === "break" && (
                  <button onClick={endBreakResumeFocus} className="bg-primary rounded-full px-6 py-2 text-sm font-bold flex items-center gap-1">
                    <Play className="h-4 w-4" /> رجوع للتركيز
                  </button>
                )}
                {(room.timer_state !== "idle" || room.timer_mode !== "focus") && (
                  <button onClick={resetTimer} className="bg-white/10 rounded-full px-4 py-2 text-sm flex items-center gap-1">
                    <RotateCcw className="h-4 w-4" /> تصفير
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/50">المالك فقط يقدر يتحكم بالتايمر</p>
            )}
            <div className="mt-4 text-[10px] text-white/40 flex gap-3">
              <span>الجلسات: {room.completed_sessions}</span>
              <span>الأخطاء: {room.error_count}</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="surface-card rounded-3xl flex flex-col overflow-hidden h-[540px]">
          <div className="flex border-b overflow-x-auto">
            {(["chat", "members", "tasks", "board"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-bold transition whitespace-nowrap px-2 ${tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                {t === "chat" ? "الشات" : t === "members" ? `الأعضاء (${members.length})` : t === "tasks" ? `المهام (${tasks.length})` : "الترتيب"}
              </button>
            ))}
          </div>

          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">ابدأ المحادثة</p>
                ) : messages.map((m) => {
                  const p = profiles[m.user_id];
                  const mine = m.user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                        {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p?.display_name ?? "?").slice(0, 1)}
                      </div>
                      <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                        <div className="text-[10px] text-muted-foreground mb-0.5">{p?.display_name ?? "مستخدم"}</div>
                        <div className={`inline-block px-3 py-1.5 rounded-2xl text-sm break-words ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendMessage} className="border-t p-2 flex gap-2">
                <input value={msgDraft} onChange={(e) => setMsgDraft(e.target.value)} placeholder="اكتب رسالة..." maxLength={500}
                  className="flex-1 bg-input rounded-full px-4 py-2 text-sm outline-none" />
                <button type="submit" disabled={!msgDraft.trim()} className="bg-primary text-primary-foreground rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

          {tab === "members" && (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
              {members.map((m) => {
                const p = profiles[m.user_id];
                const online = presence.has(m.user_id);
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold overflow-hidden">
                        {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p?.display_name ?? "?").slice(0, 1)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${online ? "bg-accent" : "bg-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {p?.display_name ?? "مستخدم"}
                        {m.user_id === room.owner_id && <Crown className="h-3 w-3 text-primary" />}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{m.focus_minutes} دقيقة</div>
                    </div>
                    {isOwner && m.user_id !== room.owner_id && (
                      <button onClick={() => kickUser(m.user_id)} className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive" title="طرد">
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "tasks" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
                {tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">لا توجد مهام</p>}
                {tasks.map((t) => {
                  const done = myCompletionIds.has(t.id);
                  const doneCount = completions.filter((c) => c.task_id === t.id).length;
                  return (
                    <div key={t.id} className={`flex items-center gap-2 p-2 rounded-xl ${done ? "bg-accent/10" : "bg-secondary/40"}`}>
                      <button onClick={() => toggleTask(t.id)} className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${done ? "bg-accent text-accent-foreground" : "border border-muted-foreground"}`}>
                        {done && <Check className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${done ? "line-through opacity-60" : ""}`}>{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">{doneCount}/{members.length} أنجزوها</p>
                      </div>
                      {isOwner && (
                        <button onClick={() => deleteTask(t.id)} className="p-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  );
                })}
              </div>
              {isOwner && (
                <form onSubmit={(e) => { e.preventDefault(); void addTask(); }} className="border-t p-2 flex gap-2">
                  <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="أضف مهمة..." maxLength={200}
                    className="flex-1 bg-input rounded-full px-4 py-2 text-sm outline-none" />
                  <button type="submit" disabled={!newTask.trim()} className="bg-primary text-primary-foreground rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === "board" && (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
              {rankedMembers.map((r, i) => {
                const p = profiles[r.m.user_id];
                return (
                  <div key={r.m.id} className={`flex items-center gap-3 p-2 rounded-xl ${r.allDone ? "bg-accent/20" : "bg-secondary/50"}`}>
                    <div className="w-7 text-center font-bold text-primary">
                      {i === 0 ? <Trophy className="h-5 w-5 mx-auto" /> : `#${i + 1}`}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold overflow-hidden">
                      {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p?.display_name ?? "?").slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{p?.display_name ?? "مستخدم"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.done}/{tasks.length} مهمة · {r.m.focus_minutes} د
                      </p>
                    </div>
                    {r.allDone && <Check className="h-4 w-4 text-accent" />}
                  </div>
                );
              })}
              {rankedMembers.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">لا يوجد أعضاء</p>}
            </div>
          )}
        </div>
      </div>

      {/* Leave confirmation */}
      {confirmLeave && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirmLeave(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">تأكيد المغادرة</h3>
            <p className="text-sm text-muted-foreground">هل أنت متأكد أنك تريد مغادرة الغرفة؟</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmLeave(false)} className="flex-1 bg-secondary rounded-full py-2 text-sm font-bold">إلغاء</button>
              <button onClick={leaveRoom} className="flex-1 bg-destructive text-destructive-foreground rounded-full py-2 text-sm font-bold">مغادرة</button>
            </div>
          </div>
        </div>
      )}

      {/* Owner settings */}
      {showSettings && isOwner && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold flex items-center gap-2"><Settings className="h-5 w-5" /> إعدادات الغرفة</h2>

            {/* Pinned message */}
            <div className="space-y-2">
              <label className="text-xs font-bold flex items-center gap-1"><Pin className="h-3 w-3" /> رسالة مثبتة</label>
              <textarea value={pinDraft} onChange={(e) => setPinDraft(e.target.value)} rows={2} maxLength={300}
                className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none resize-none" placeholder="إعلان للأعضاء..." />
              <button onClick={savePin} className="text-xs bg-primary text-primary-foreground rounded-full px-4 py-1.5 font-bold">حفظ التثبيت</button>
            </div>

            {/* Password lock */}
            <div className="space-y-2 border-t pt-4">
              <label className="text-xs font-bold flex items-center gap-1">
                {room.password_hash ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                {room.password_hash ? "الغرفة مقفلة الآن" : "قفل الغرفة بكلمة سر"}
              </label>
              <input type="password" value={passDraft} onChange={(e) => setPassDraft(e.target.value)}
                placeholder={room.password_hash ? "كلمة سر جديدة (اترك فارغاً للإلغاء)" : "كلمة السر"}
                className="w-full bg-input rounded-xl px-3 py-2 text-sm outline-none" />
              <div className="flex gap-2">
                <button onClick={saveLock} className="text-xs bg-primary text-primary-foreground rounded-full px-4 py-1.5 font-bold">
                  {passDraft ? "حفظ القفل" : "إلغاء القفل"}
                </button>
              </div>
            </div>

            {/* Extend */}
            <div className="space-y-2 border-t pt-4">
              <label className="text-xs font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> تمديد الغرفة</label>
              <div className="flex gap-2 items-center">
                <input type="number" min={5} max={120} value={extendMin} onChange={(e) => setExtendMin(Number(e.target.value) || 15)}
                  className="w-20 bg-input rounded-xl px-3 py-2 text-sm outline-none" />
                <span className="text-xs">دقيقة</span>
                <button onClick={extendRoom} className="text-xs bg-accent text-accent-foreground rounded-full px-4 py-1.5 font-bold">
                  تمديد
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">الحد الأقصى الإجمالي: 6 ساعات</p>
            </div>

            {/* End session */}
            <div className="border-t pt-4">
              <button onClick={endSession} className="w-full bg-destructive text-destructive-foreground rounded-full py-2 text-sm font-bold">
                إنهاء الغرفة نهائياً
              </button>
            </div>

            <button onClick={() => setShowSettings(false)} className="w-full bg-secondary rounded-full py-2 text-sm font-bold">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, { t: string; c: string }> = {
    active: { t: "نشطة", c: "bg-accent/20 text-accent" },
    empty: { t: "فارغة", c: "bg-muted text-muted-foreground" },
    full: { t: "ممتلئة", c: "bg-orange-500/20 text-orange-500" },
    locked: { t: "مقفلة", c: "bg-primary/20 text-primary" },
    ended: { t: "منتهية", c: "bg-destructive/20 text-destructive" },
    expired: { t: "انتهى الوقت", c: "bg-destructive/20 text-destructive" },
    created: { t: "جديدة", c: "bg-secondary text-secondary-foreground" },
  };
  const v = map[state] ?? map.created;
  return <span className={`text-[10px] rounded-full px-2 py-0.5 ${v.c}`}>{v.t}</span>;
}
