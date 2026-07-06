import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/AuthGate";
import { secondsLeft, fmt, type RoomTimerRow } from "@/lib/room-timer";
import {
  ArrowRight,
  Play,
  Pause,
  Square,
  Coffee,
  RotateCcw,
  Send,
  Users,
  Trophy,
  Copy,
  Loader2,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/$id")({
  head: () => ({
    meta: [
      { title: "غرفة مذاكرة Live — توجيهي فوكس" },
      { name: "description", content: "غرفة مذاكرة مع تايمر مشترك وشات مباشر" },
    ],
  }),
  component: () => (
    <AuthGate>
      <RoomPage />
    </AuthGate>
  ),
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
}

interface MemberRow {
  id: string;
  user_id: string;
  focus_minutes: number;
  joined_at: string;
}

interface MessageRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

function RoomPage() {
  const { id: roomId } = useParams({ from: "/rooms/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [presence, setPresence] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "members" | "board">("chat");
  const [tick, setTick] = useState(0);
  const [msgDraft, setMsgDraft] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const creditedRef = useRef<string | null>(null); // key = timer_ends_at of last credited focus

  // 1) initial load + auto-join
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: r, error: e1 } = await supabase
        .from("study_rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();
      if (!alive) return;
      if (e1 || !r) {
        setError("الغرفة غير موجودة أو ما عندك صلاحية");
        setLoading(false);
        return;
      }
      setRoom(r as RoomRow);

      // auto-join (ignore duplicate)
      await supabase
        .from("room_members")
        .upsert(
          { room_id: roomId, user_id: user.id },
          { onConflict: "room_id,user_id", ignoreDuplicates: true },
        );

      await Promise.all([loadMembers(), loadMessages()]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  async function loadMembers() {
    const { data } = await supabase
      .from("room_members")
      .select("id,user_id,focus_minutes,joined_at")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    const rows = (data ?? []) as MemberRow[];
    setMembers(rows);
    await ensureProfiles(rows.map((m) => m.user_id));
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("room_messages")
      .select("id,user_id,content,created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(200);
    const rows = (data ?? []) as MessageRow[];
    setMessages(rows);
    await ensureProfiles(rows.map((m) => m.user_id));
  }

  async function ensureProfiles(userIds: string[]) {
    const missing = Array.from(new Set(userIds)).filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", missing);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        (data as Profile[]).forEach((p) => (next[p.id] = p));
        return next;
      });
    }
  }

  // 2) realtime subscriptions
  useEffect(() => {
    if (!user || !room) return;
    const ch = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "study_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom((r) => (r ? ({ ...r, ...(payload.new as Partial<RoomRow>) } as RoomRow) : r)),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "study_rooms", filter: `id=eq.${roomId}` },
        () => {
          toast.error("تم حذف الغرفة");
          navigate({ to: "/rooms" });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => void loadMembers(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          await ensureProfiles([m.user_id]);
        },
      )
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

    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id, !!room]);

  // 3) local 1s tick for countdown
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // 4) auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, tab]);

  // 5) focus credit — when focus timer transitions to finished, credit self once
  useEffect(() => {
    if (!room || !user) return;
    if (room.timer_state !== "finished" || room.timer_mode !== "focus") return;
    const key = `${room.id}:${room.timer_ends_at ?? ""}`;
    if (creditedRef.current === key) return;
    creditedRef.current = key;
    (async () => {
      const mins = room.focus_duration_minutes;
      // update member row
      const mine = members.find((m) => m.user_id === user.id);
      if (mine) {
        await supabase
          .from("room_members")
          .update({ focus_minutes: mine.focus_minutes + mins })
          .eq("id", mine.id);
      }
      // log focus session
      await supabase.from("focus_sessions").insert({
        user_id: user.id,
        duration_minutes: mins,
        type: "focus",
      });
      toast.success(`+${mins} دقيقة تركيز`);
    })();
  }, [room?.timer_state, room?.timer_mode, room?.timer_ends_at, user?.id]); // eslint-disable-line

  const isOwner = !!user && !!room && user.id === room.owner_id;
  const secs = room ? secondsLeft(room, Date.now() + tick * 0) : 0;
  const totalSecs = room
    ? (room.timer_mode === "break" ? room.break_duration_minutes : room.focus_duration_minutes) * 60
    : 1;
  const progress = room ? 1 - secs / totalSecs : 0;

  const board = useMemo(
    () => [...members].sort((a, b) => b.focus_minutes - a.focus_minutes),
    [members],
  );

  async function updateTimer(patch: Partial<RoomRow>) {
    if (!room || !isOwner) return;
    const { error } = await supabase.from("study_rooms").update(patch).eq("id", room.id);
    if (error) toast.error("تعذر التحديث");
  }

  async function startFocus() {
    if (!room) return;
    const secondsLeftNow =
      room.timer_state === "paused" && room.timer_mode === "focus"
        ? (room.timer_paused_seconds_left ?? room.focus_duration_minutes * 60)
        : room.focus_duration_minutes * 60;
    await updateTimer({
      timer_state: "running",
      timer_mode: "focus",
      timer_ends_at: new Date(Date.now() + secondsLeftNow * 1000).toISOString(),
      timer_paused_seconds_left: null,
    });
  }

  async function pauseTimer() {
    if (!room) return;
    const left = secondsLeft(room);
    await updateTimer({ timer_state: "paused", timer_paused_seconds_left: left, timer_ends_at: null });
  }

  async function startBreak() {
    if (!room) return;
    // snapshot focus seconds left if we're in the middle of focus
    const focusLeft =
      room.timer_mode === "focus" && (room.timer_state === "running" || room.timer_state === "paused")
        ? secondsLeft(room)
        : null;
    await updateTimer({
      timer_state: "break",
      timer_mode: "break",
      timer_ends_at: new Date(Date.now() + room.break_duration_minutes * 60 * 1000).toISOString(),
      timer_paused_seconds_left: focusLeft, // stash so we can resume focus after break
    });
  }

  async function endBreakResumeFocus() {
    if (!room) return;
    const focusLeft = room.timer_paused_seconds_left ?? room.focus_duration_minutes * 60;
    await updateTimer({
      timer_state: "running",
      timer_mode: "focus",
      timer_ends_at: new Date(Date.now() + focusLeft * 1000).toISOString(),
      timer_paused_seconds_left: null,
    });
  }

  async function resetTimer() {
    if (!room) return;
    await updateTimer({
      timer_state: "idle",
      timer_mode: "focus",
      timer_ends_at: null,
      timer_paused_seconds_left: null,
    });
    creditedRef.current = null;
  }

  async function finishNow() {
    if (!room) return;
    await updateTimer({
      timer_state: "finished",
      timer_ends_at: new Date().toISOString(),
    });
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = msgDraft.trim();
    if (!content || !user) return;
    setMsgDraft("");
    const { error } = await supabase
      .from("room_messages")
      .insert({ room_id: roomId, user_id: user.id, content });
    if (error) {
      toast.error("تعذر إرسال الرسالة");
      setMsgDraft(content);
    }
  }

  async function leaveRoom() {
    if (!user) return;
    await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
    navigate({ to: "/rooms" });
  }

  function copyInvite() {
    if (!room) return;
    const url = `${window.location.origin}/rooms/${room.id}`;
    void navigator.clipboard.writeText(url);
    toast.success("تم نسخ الرابط");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error ?? "غرفة غير متوفرة"}</p>
        <button
          onClick={() => navigate({ to: "/rooms" })}
          className="bg-primary text-primary-foreground rounded-full px-6 py-2 text-sm font-bold"
        >
          رجوع للغرف
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen container mx-auto px-4 py-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <button
          onClick={() => navigate({ to: "/rooms" })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          الغرف
        </button>
        <div className="text-center flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">{room.name}</h1>
          {room.subject && <p className="text-xs text-primary">{room.subject}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyInvite}
            className="p-2 rounded-full bg-secondary text-secondary-foreground"
            title="نسخ رابط الغرفة"
          >
            <Copy className="h-4 w-4" />
          </button>
          {!isOwner && (
            <button
              onClick={leaveRoom}
              className="px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold"
            >
              مغادرة
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Timer */}
        <div className="lg:col-span-2 timer-bg rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="text-xs uppercase tracking-widest text-white/60 mb-3">
              {room.timer_mode === "break" ? "استراحة" : "تركيز"}
              {" · "}
              {room.timer_state === "running"
                ? "شغّال"
                : room.timer_state === "paused"
                  ? "متوقف"
                  : room.timer_state === "break"
                    ? "استراحة"
                    : room.timer_state === "finished"
                      ? "انتهى"
                      : "جاهز"}
            </div>

            <div className="relative w-64 h-64 sm:w-72 sm:h-72 mb-6">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke={room.timer_mode === "break" ? "#22c55e" : "#8b5cf6"}
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${progress * 283} 283`}
                  strokeLinecap="round"
                  className="transition-all"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <div className="text-5xl sm:text-6xl font-bold tabular-nums">{fmt(secs)}</div>
                <div className="text-xs text-white/50 mt-2 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {presence.size} متصل
                </div>
              </div>
            </div>

            {isOwner ? (
              <div className="flex flex-wrap gap-2 justify-center">
                {room.timer_state === "running" && room.timer_mode === "focus" && (
                  <>
                    <button onClick={pauseTimer} className="bg-white/10 hover:bg-white/20 rounded-full px-5 py-2 text-sm flex items-center gap-1">
                      <Pause className="h-4 w-4" /> إيقاف
                    </button>
                    <button onClick={startBreak} className="bg-accent hover:opacity-90 rounded-full px-5 py-2 text-sm flex items-center gap-1">
                      <Coffee className="h-4 w-4" /> استراحة
                    </button>
                    <button onClick={finishNow} className="bg-white/10 hover:bg-white/20 rounded-full px-5 py-2 text-sm flex items-center gap-1">
                      <Square className="h-4 w-4" /> إنهاء
                    </button>
                  </>
                )}
                {(room.timer_state === "idle" || room.timer_state === "paused" || room.timer_state === "finished") && (
                  <button onClick={startFocus} className="bg-primary hover:opacity-90 rounded-full px-6 py-2 text-sm font-bold flex items-center gap-1">
                    <Play className="h-4 w-4" /> {room.timer_state === "paused" ? "استكمال" : "ابدأ تركيز"}
                  </button>
                )}
                {room.timer_state === "break" && (
                  <button onClick={endBreakResumeFocus} className="bg-primary hover:opacity-90 rounded-full px-6 py-2 text-sm font-bold flex items-center gap-1">
                    <Play className="h-4 w-4" /> رجوع للتركيز
                  </button>
                )}
                {(room.timer_state !== "idle" || room.timer_mode !== "focus") && (
                  <button onClick={resetTimer} className="bg-white/10 hover:bg-white/20 rounded-full px-4 py-2 text-sm flex items-center gap-1">
                    <RotateCcw className="h-4 w-4" /> تصفير
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/50">المالك فقط يقدر يتحكم بالتايمر</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="surface-card rounded-3xl flex flex-col overflow-hidden h-[540px]">
          <div className="flex border-b">
            {(["chat", "members", "board"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-bold transition ${
                  tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                {t === "chat" ? "الشات" : t === "members" ? `الأعضاء (${members.length})` : "الترتيب"}
              </button>
            ))}
          </div>

          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">ابدأ المحادثة</p>
                ) : (
                  messages.map((m) => {
                    const p = profiles[m.user_id];
                    const mine = m.user_id === user?.id;
                    return (
                      <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                          {p?.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (p?.display_name ?? "?").slice(0, 1)
                          )}
                        </div>
                        <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                          <div className="text-[10px] text-muted-foreground mb-0.5">
                            {p?.display_name ?? "مستخدم"}
                          </div>
                          <div
                            className={`inline-block px-3 py-1.5 rounded-2xl text-sm break-words ${
                              mine ? "bg-primary text-primary-foreground" : "bg-secondary"
                            }`}
                          >
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendMessage} className="border-t p-2 flex gap-2">
                <input
                  value={msgDraft}
                  onChange={(e) => setMsgDraft(e.target.value)}
                  placeholder="اكتب رسالة..."
                  maxLength={500}
                  className="flex-1 bg-input rounded-full px-4 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={!msgDraft.trim()}
                  className="bg-primary text-primary-foreground rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-50"
                >
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
                        {p?.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (p?.display_name ?? "?").slice(0, 1)
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                          online ? "bg-accent" : "bg-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {p?.display_name ?? "مستخدم"}
                        {m.user_id === room.owner_id && (
                          <Crown className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {m.focus_minutes} دقيقة تركيز
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "board" && (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
              {board.map((m, i) => {
                const p = profiles[m.user_id];
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl bg-secondary/50">
                    <div className="w-7 text-center font-bold text-primary">
                      {i === 0 ? <Trophy className="h-5 w-5 mx-auto" /> : `#${i + 1}`}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold overflow-hidden">
                      {p?.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (p?.display_name ?? "?").slice(0, 1)
                      )}
                    </div>
                    <div className="flex-1 text-sm truncate">{p?.display_name ?? "مستخدم"}</div>
                    <div className="text-sm font-bold text-primary tabular-nums">{m.focus_minutes} د</div>
                  </div>
                );
              })}
              {board.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">لا يوجد أعضاء بعد</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
