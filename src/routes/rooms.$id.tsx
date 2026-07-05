import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  ArrowRight, Users, Play, Pause, Square, Send, LogOut, Trophy, Radio,
  Trash2, Crown, Coffee, Copy, Check, MessageCircle, UserPlus, UserX, Loader2, Lock, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/AuthGate";
import { computeRemaining, formatClock, totalSecondsForPhase, type RoomTimer } from "@/lib/room-timer";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/$id")({
  component: () => <AuthGate><RoomPage /></AuthGate>,
  head: () => ({
    meta: [
      { title: "غرفة مذاكرة — توجيهي فوكس" },
      { name: "description", content: "غرفة مذاكرة جماعية مع تايمر مشترك وشات مباشر." },
    ],
  }),
});

interface Room extends RoomTimer {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  owner_id: string;
  max_members: number;
  is_public: boolean;
  invite_code: string;
}
interface Member {
  user_id: string;
  focus_minutes: number;
  joined_at: string;
  status: string;
  display_name?: string | null;
  avatar_url?: string | null;
}
interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [msg, setMsg] = useState("");
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"chat" | "members">("chat");
  const [copied, setCopied] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const creditedRef = useRef<Set<string>>(new Set());

  const isOwner = !!(user && room && room.owner_id === user.id);
  const myMembership = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user]);
  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members]);
  const pendingMembers = useMemo(() => members.filter((m) => m.status === "pending"), [members]);
  const isActiveMember = myMembership?.status === "active";
  const isPending = myMembership?.status === "pending";

  const enrich = useCallback(async (rows: { user_id: string }[]) => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (!ids.length) return new Map<string, { display_name: string | null; avatar_url: string | null }>();
    const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
    return new Map((data || []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]));
  }, []);

  const loadRoom = useCallback(async () => {
    const { data, error } = await supabase.from("study_rooms").select("*").eq("id", id).maybeSingle();
    if (error) { toast.error("تعذّر تحميل الغرفة"); return; }
    if (!data) { setNotFound(true); return; }
    setRoom(data as Room);
  }, [id]);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("room_members")
      .select("user_id, focus_minutes, joined_at, status")
      .eq("room_id", id)
      .order("focus_minutes", { ascending: false });
    if (!data) return;
    const map = await enrich(data);
    setMembers(data.map((m) => ({ ...m, ...map.get(m.user_id) })));
  }, [id, enrich]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase.from("room_messages")
      .select("*").eq("room_id", id)
      .order("created_at", { ascending: true }).limit(200);
    if (!data) { setMessages([]); return; }
    const map = await enrich(data);
    setMessages(data.map((m) => ({ ...m, ...map.get(m.user_id) })));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  }, [id, enrich]);

  useEffect(() => { loadRoom(); loadMembers(); loadMessages(); }, [loadRoom, loadMembers, loadMessages]);

  // Realtime: DB changes
  useEffect(() => {
    const ch = supabase
      .channel(`room-db-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_rooms", filter: `id=eq.${id}` }, loadRoom)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, loadMembers)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` }, loadMessages)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, loadRoom, loadMembers, loadMessages]);

  // Realtime: presence — only track when user is active member
  useEffect(() => {
    if (!user || !isActiveMember) { setOnline(new Set()); return; }
    const ch = supabase.channel(`room-presence-${id}`, { config: { presence: { key: user.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const s = new Set<string>();
      const state = ch.presenceState();
      Object.keys(state).forEach((k) => s.add(k));
      setOnline(s);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ online_at: new Date().toISOString() });
    });
    return () => { ch.untrack(); supabase.removeChannel(ch); };
  }, [id, user, isActiveMember]);

  // Timer tick + auto-transitions
  useEffect(() => {
    if (!room) return;
    const tick = () => {
      const left = computeRemaining(room);
      setRemaining(left);

      // When the running/break timer reaches zero:
      if (left === 0 && (room.timer_state === "running" || room.timer_state === "break") && room.timer_ends_at) {
        const sessionKey = `${room.timer_state}-${room.timer_ends_at}`;

        // Owner promotes DB state to "finished" (focus) or auto-resumes focus after break
        if (isOwner && !creditedRef.current.has(`owner-${sessionKey}`)) {
          creditedRef.current.add(`owner-${sessionKey}`);
          (async () => {
            if (room.timer_state === "break") {
              // Break ended → resume focus with the saved remaining focus seconds
              const focusLeft = room.timer_paused_seconds_left ?? room.focus_duration_minutes * 60;
              await supabase.from("study_rooms").update({
                timer_state: "running",
                timer_mode: "focus",
                timer_ends_at: new Date(Date.now() + focusLeft * 1000).toISOString(),
                timer_paused_seconds_left: null,
              }).eq("id", id);
            } else {
              // Focus completed → finished
              await supabase.from("study_rooms").update({
                timer_state: "finished",
                timer_ends_at: null,
                timer_paused_seconds_left: null,
              }).eq("id", id);
            }
          })();
        }

        // Every ACTIVE MEMBER credits themselves ONCE per focus session
        if (
          room.timer_state === "running" && room.timer_mode === "focus" &&
          isActiveMember && user && !creditedRef.current.has(`credit-${sessionKey}`)
        ) {
          creditedRef.current.add(`credit-${sessionKey}`);
          (async () => {
            const add = room.focus_duration_minutes;
            const mine = members.find((m) => m.user_id === user.id);
            await supabase.from("room_members")
              .update({ focus_minutes: (mine?.focus_minutes || 0) + add })
              .eq("room_id", id).eq("user_id", user.id);
            await supabase.from("focus_sessions").insert({
              user_id: user.id, duration_minutes: add, type: "focus",
              task_name: `غرفة: ${room.name}`, completed: true,
            });
            toast.success(`أحسنت! +${add} دقيقة تركيز 🎯`);
          })();
        }
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [room, isOwner, isActiveMember, user, id, members]);

  // Actions
  const join = async () => {
    if (!user || !room) return;
    setJoining(true);
    if (activeMembers.length >= room.max_members) { setJoining(false); return toast.error("الغرفة ممتلئة"); }
    const status = room.is_public ? "active" : "pending";
    const { error } = await supabase.from("room_members").upsert(
      { room_id: id, user_id: user.id, status },
      { onConflict: "room_id,user_id" }
    );
    setJoining(false);
    if (error) return toast.error(error.message);
    toast.success(status === "active" ? "انضممت للغرفة" : "تم إرسال طلب الانضمام");
  };
  const leave = async () => {
    if (!user) return;
    await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", user.id);
    navigate({ to: "/rooms" });
  };
  const approve = async (uid: string) => {
    await supabase.from("room_members").update({ status: "active" }).eq("room_id", id).eq("user_id", uid);
  };
  const kick = async (uid: string) => {
    if (!confirm("طرد هذا العضو؟")) return;
    await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", uid);
  };
  const startFocus = async () => {
    if (!isOwner || !room) return;
    await supabase.from("study_rooms").update({
      timer_state: "running", timer_mode: "focus",
      timer_ends_at: new Date(Date.now() + room.focus_duration_minutes * 60_000).toISOString(),
      timer_paused_seconds_left: null,
    }).eq("id", id);
  };
  const pauseTimer = async () => {
    if (!isOwner || !room || (room.timer_state !== "running" && room.timer_state !== "break")) return;
    const left = computeRemaining(room);
    await supabase.from("study_rooms").update({
      timer_state: "paused",
      timer_ends_at: null,
      timer_paused_seconds_left: left,
    }).eq("id", id);
  };
  const resumeTimer = async () => {
    if (!isOwner || !room || room.timer_state !== "paused") return;
    const left = room.timer_paused_seconds_left ?? room.focus_duration_minutes * 60;
    await supabase.from("study_rooms").update({
      timer_state: room.timer_mode === "break" ? "break" : "running",
      timer_ends_at: new Date(Date.now() + left * 1000).toISOString(),
      timer_paused_seconds_left: null,
    }).eq("id", id);
  };
  const startBreak = async () => {
    if (!isOwner || !room) return;
    if (room.timer_state === "break") return toast.error("الاستراحة شغّالة");
    // Snapshot how much focus is left so we can resume after break
    let focusLeft = room.focus_duration_minutes * 60;
    if (room.timer_state === "running" && room.timer_mode === "focus") {
      focusLeft = computeRemaining(room);
    } else if (room.timer_state === "paused" && room.timer_mode === "focus") {
      focusLeft = room.timer_paused_seconds_left ?? focusLeft;
    }
    await supabase.from("study_rooms").update({
      timer_state: "break", timer_mode: "break",
      timer_ends_at: new Date(Date.now() + room.break_duration_minutes * 60_000).toISOString(),
      timer_paused_seconds_left: focusLeft, // saved focus remaining, restored when break ends
    }).eq("id", id);
  };
  const stopTimer = async () => {
    if (!isOwner) return;
    if (!confirm("إنهاء الجلسة الحالية؟")) return;
    await supabase.from("study_rooms").update({
      timer_state: "idle", timer_mode: "focus",
      timer_ends_at: null, timer_paused_seconds_left: null,
    }).eq("id", id);
  };
  const deleteRoom = async () => {
    if (!isOwner) return;
    if (!confirm("حذف الغرفة نهائياً؟")) return;
    await supabase.from("study_rooms").delete().eq("id", id);
    navigate({ to: "/rooms" });
  };
  const send = async () => {
    if (!user) return;
    if (!isActiveMember) return toast.error("انضم للغرفة أولاً");
    const text = msg.trim();
    if (!text) return;
    setMsg("");
    const { error } = await supabase.from("room_messages").insert({ room_id: id, user_id: user.id, content: text });
    if (error) toast.error("فشل الإرسال");
  };
  const copyInvite = async () => {
    if (!room) return;
    const url = `${window.location.origin}/rooms/${room.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("نُسخ الرابط");
  };

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold mb-2">الغرفة غير موجودة</p>
        <p className="text-sm text-muted-foreground mb-6">قد تكون حُذفت أو الرابط خاطئ.</p>
        <Link to="/rooms" className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 font-bold text-sm">
          <ArrowRight className="h-4 w-4" /> رجوع للغرف
        </Link>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> جاري تحميل الغرفة…
      </div>
    );
  }

  const total = totalSecondsForPhase(room);
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const stateBadge =
    room.timer_state === "running" ? { bg: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500 animate-pulse", label: "جلسة تركيز" } :
    room.timer_state === "break"   ? { bg: "bg-amber-100 text-amber-700",   dot: "bg-amber-500 animate-pulse",   label: "استراحة" } :
    room.timer_state === "paused"  ? { bg: "bg-slate-200 text-slate-700",   dot: "bg-slate-500",                 label: "متوقفة" } :
    room.timer_state === "finished"? { bg: "bg-primary/10 text-primary",    dot: "bg-primary",                   label: "انتهت الجلسة" } :
                                     { bg: "bg-secondary text-muted-foreground", dot: "bg-slate-400",           label: "جاهزة" };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/rooms" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowRight className="h-4 w-4" /> كل الغرف
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gradient-primary truncate">{room.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {room.subject && <span className="text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold">{room.subject}</span>}
            <span className={`flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-bold ${stateBadge.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${stateBadge.dot}`} /> {stateBadge.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-bold ${room.is_public ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {room.is_public ? <><Globe className="h-3 w-3" /> عامة</> : <><Lock className="h-3 w-3" /> خاصة</>}
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> {activeMembers.length}/{room.max_members}
              <span className="text-emerald-600 font-bold mr-1">• {online.size} أونلاين</span>
            </span>
          </div>
          {room.description && <p className="text-sm text-muted-foreground mt-2">{room.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyInvite} className="rounded-xl bg-secondary hover:bg-secondary/70 text-xs font-bold px-3 py-2 flex items-center gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            رابط الدعوة
          </button>
          {isActiveMember ? (
            !isOwner && <button onClick={leave} className="rounded-xl bg-secondary hover:bg-destructive/10 hover:text-destructive text-xs font-bold px-3 py-2 flex items-center gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> خروج
            </button>
          ) : isPending ? (
            <span className="rounded-xl bg-amber-100 text-amber-700 text-xs font-bold px-3 py-2 flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> بانتظار الموافقة
            </span>
          ) : (
            <button onClick={join} disabled={joining} className="rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
              {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
              {room.is_public ? "انضم" : "طلب انضمام"}
            </button>
          )}
          {isOwner && (
            <button onClick={deleteRoom} className="p-2 rounded-xl bg-secondary hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      </div>

      {/* Pending approvals (owner only) */}
      {isOwner && pendingMembers.length > 0 && (
        <div className="surface-card rounded-2xl p-4 mb-4 border-2 border-amber-200/60">
          <div className="flex items-center gap-2 mb-3 text-sm font-extrabold text-amber-700">
            <UserPlus className="h-4 w-4" /> طلبات انضمام ({pendingMembers.length})
          </div>
          <div className="space-y-2">
            {pendingMembers.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2 rounded-xl bg-amber-50 p-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.display_name?.[0]?.toUpperCase() || "?")}
                </div>
                <div className="flex-1 text-xs font-bold truncate">{m.display_name || "مستخدم"}</div>
                <button onClick={() => approve(m.user_id)} className="rounded-lg bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 flex items-center gap-1">
                  <Check className="h-3 w-3" /> قبول
                </button>
                <button onClick={() => kick(m.user_id)} className="rounded-lg bg-secondary hover:bg-destructive/10 hover:text-destructive text-[11px] font-bold px-2 py-1.5">
                  <UserX className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Shared Timer */}
          <div className={`surface-card rounded-3xl p-6 text-center relative overflow-hidden transition-colors ${
            room.timer_state === "break" ? "bg-amber-50/50" : ""
          }`}>
            <div className={`absolute inset-0 ${room.timer_state === "break" ? "bg-gradient-to-br from-amber-100/40 to-orange-100/40" : "bg-gradient-to-br from-primary/5 to-accent/5"}`} />
            <div className="relative">
              <div className={`flex items-center justify-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider ${
                room.timer_state === "break" ? "text-amber-700" : "text-muted-foreground"
              }`}>
                {room.timer_state === "break" ? <Coffee className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />}
                {room.timer_state === "break" ? "وقت الاستراحة" : "تايمر مشترك"}
              </div>
              <div className="relative inline-block mb-4">
                <svg className="w-56 h-56 -rotate-90" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="92" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
                  <circle cx="100" cy="100" r="92" fill="none"
                    stroke={room.timer_state === "break" ? "hsl(35 92% 55%)" : "url(#roomG)"}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(progress / 100) * 578} 578`}
                    className="transition-all duration-500" />
                  <defs>
                    <linearGradient id="roomG">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--accent))" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-5xl font-bold tabular-nums text-foreground">{formatClock(remaining)}</div>
                  <p className={`mt-1 text-xs font-semibold ${
                    room.timer_state === "running" ? "text-emerald-600" :
                    room.timer_state === "break" ? "text-amber-600" :
                    room.timer_state === "paused" ? "text-slate-600" :
                    room.timer_state === "finished" ? "text-primary" : "text-muted-foreground"
                  }`}>{stateBadge.label}</p>
                </div>
              </div>

              {isOwner ? (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {room.timer_state === "idle" || room.timer_state === "finished" ? (
                    <button onClick={startFocus} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 font-bold text-sm flex items-center gap-2">
                      <Play className="h-4 w-4" /> ابدأ جلسة تركيز
                    </button>
                  ) : room.timer_state === "paused" ? (
                    <>
                      <button onClick={resumeTimer} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 font-bold text-sm flex items-center gap-2">
                        <Play className="h-4 w-4" /> استئناف
                      </button>
                      <button onClick={stopTimer} className="rounded-full bg-secondary hover:bg-destructive/10 hover:text-destructive px-4 py-2.5 font-bold text-sm flex items-center gap-2">
                        <Square className="h-4 w-4" /> إنهاء
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={pauseTimer} className="rounded-full bg-secondary hover:bg-secondary/70 px-4 py-2.5 font-bold text-sm flex items-center gap-2">
                        <Pause className="h-4 w-4" /> إيقاف مؤقت
                      </button>
                      {room.timer_state === "running" && (
                        <button onClick={startBreak} className="rounded-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 font-bold text-sm flex items-center gap-2">
                          <Coffee className="h-4 w-4" /> استراحة
                        </button>
                      )}
                      <button onClick={stopTimer} className="rounded-full bg-secondary hover:bg-destructive/10 hover:text-destructive px-4 py-2.5 font-bold text-sm flex items-center gap-2">
                        <Square className="h-4 w-4" /> إنهاء
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" /> صاحب الغرفة يتحكم بالجلسة
                </p>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                تركيز {room.focus_duration_minutes} د · استراحة {room.break_duration_minutes} د
              </p>
            </div>
          </div>

          {/* Tabs: Chat / Members */}
          <div className="surface-card rounded-3xl flex flex-col h-[520px]">
            <div className="flex border-b border-border">
              <button onClick={() => setTab("chat")}
                className={`flex-1 py-3 text-sm font-extrabold flex items-center justify-center gap-1.5 transition ${tab === "chat" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                <MessageCircle className="h-4 w-4" /> شات
              </button>
              <button onClick={() => setTab("members")}
                className={`flex-1 py-3 text-sm font-extrabold flex items-center justify-center gap-1.5 transition ${tab === "members" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                <Users className="h-4 w-4" /> أعضاء ({activeMembers.length})
              </button>
            </div>

            {tab === "chat" ? (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-10">لا رسائل بعد. كن أول من يكتب!</p>
                  ) : messages.map((m) => {
                    const isMe = user && m.user_id === user.id;
                    return (
                      <div key={m.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                          {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.display_name?.[0]?.toUpperCase() || "?")}
                        </div>
                        <div className={`max-w-[75%] ${isMe ? "text-right" : ""}`}>
                          <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                            <span>{m.display_name || "مستخدم"}</span>
                            <span>·</span>
                            <span>{new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div className={`rounded-2xl px-3 py-2 text-sm break-words ${isMe ? "bg-gradient-to-r from-primary to-accent text-primary-foreground" : "bg-secondary"}`}>
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <input value={msg} onChange={(e) => setMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={isActiveMember ? "اكتب رسالة…" : "انضم للغرفة للمشاركة"}
                    disabled={!isActiveMember} maxLength={500}
                    className="flex-1 rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50" />
                  <button onClick={send} disabled={!isActiveMember || !msg.trim()}
                    className="rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold px-4 disabled:opacity-40">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {activeMembers.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">ما في أعضاء بعد</p>}
                {activeMembers.map((m) => {
                  const isOwn = m.user_id === room.owner_id;
                  const isMe = user && m.user_id === user.id;
                  const isOnline = online.has(m.user_id);
                  return (
                    <div key={m.user_id} className={`flex items-center gap-2.5 rounded-xl p-2 ${isMe ? "bg-primary/5" : "hover:bg-secondary/40"}`}>
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold">
                          {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.display_name?.[0]?.toUpperCase() || "?")}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${isOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate flex items-center gap-1">
                          {m.display_name || "مستخدم"}
                          {isOwn && <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{isOnline ? "أونلاين الآن" : "غير متصل"}</div>
                      </div>
                      {isOwner && !isOwn && (
                        <button onClick={() => kick(m.user_id)} className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground" title="طرد">
                          <UserX className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="surface-card rounded-3xl p-5 h-fit sticky top-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-extrabold">لوحة الغرفة</h3>
          </div>
          <div className="space-y-2">
            {activeMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ما في أعضاء بعد</p>}
            {activeMembers.map((m, i) => {
              const isMe = user && m.user_id === user.id;
              const isOwn = m.user_id === room.owner_id;
              const rank = i === 0 ? "bg-amber-400 text-amber-900" : i === 1 ? "bg-slate-300 text-slate-700" : i === 2 ? "bg-orange-300 text-orange-900" : "bg-secondary text-muted-foreground";
              return (
                <div key={m.user_id} className={`flex items-center gap-2.5 rounded-xl p-2 ${isMe ? "bg-primary/5 border border-primary/20" : ""}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold ${rank}`}>{i + 1}</div>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.display_name?.[0]?.toUpperCase() || "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate flex items-center gap-1">
                      {m.display_name || "مستخدم"}
                      {isOwn && <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">{m.focus_minutes} د تركيز</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
