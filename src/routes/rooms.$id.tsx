import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowRight, Users, Play, Pause, RotateCcw, Send, LogOut, Trophy, Radio, Trash2, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/$id")({
  component: RoomPage,
  head: () => ({
    meta: [
      { title: "غرفة مذاكرة — توجيهي فوكس" },
      { name: "description", content: "غرفة مذاكرة جماعية مع تايمر مشترك وشات مباشر." },
    ],
  }),
});

interface Room {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  owner_id: string;
  timer_started_at: string | null;
  timer_duration_minutes: number | null;
  timer_running: boolean;
}
interface Member {
  user_id: string;
  focus_minutes: number;
  joined_at: string;
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
  const [minutes, setMinutes] = useState(25);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contributedRef = useRef(false);

  const isOwner = user && room && room.owner_id === user.id;
  const isMember = user && members.some((m) => m.user_id === user.id);

  const enrich = async (rows: { user_id: string }[]) => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (!ids.length) return new Map<string, { display_name: string | null; avatar_url: string | null }>();
    const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
    return new Map((data || []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]));
  };

  const loadRoom = useCallback(async () => {
    const { data, error } = await supabase.from("study_rooms").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("الغرفة غير موجودة"); navigate({ to: "/rooms" }); return; }
    setRoom(data as Room);
  }, [id, navigate]);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("room_members").select("user_id, focus_minutes, joined_at").eq("room_id", id).order("focus_minutes", { ascending: false });
    if (!data) return;
    const map = await enrich(data);
    setMembers(data.map((m) => ({ ...m, ...map.get(m.user_id) })));
  }, [id]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase.from("room_messages").select("*").eq("room_id", id).order("created_at", { ascending: true }).limit(200);
    if (!data) return;
    const map = await enrich(data);
    setMessages(data.map((m) => ({ ...m, ...map.get(m.user_id) })));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  }, [id]);

  useEffect(() => { loadRoom(); loadMembers(); loadMessages(); }, [loadRoom, loadMembers, loadMessages]);

  // Realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel(`room-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_rooms", filter: `id=eq.${id}` }, loadRoom)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, loadMembers)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` }, loadMessages)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, loadRoom, loadMembers, loadMessages]);

  // Timer tick
  useEffect(() => {
    if (!room?.timer_running || !room.timer_started_at || !room.timer_duration_minutes) {
      setRemaining(0); contributedRef.current = false; return;
    }
    const endsAt = new Date(room.timer_started_at).getTime() + room.timer_duration_minutes * 60_000;
    const tick = () => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !contributedRef.current && isMember && user) {
        contributedRef.current = true;
        (async () => {
          const mine = members.find((m) => m.user_id === user.id);
          const add = room.timer_duration_minutes || 25;
          await supabase.from("room_members").update({ focus_minutes: (mine?.focus_minutes || 0) + add }).eq("room_id", id).eq("user_id", user.id);
          await supabase.from("focus_sessions").insert({ user_id: user.id, duration_minutes: add, type: "focus", task_name: `غرفة: ${room.name}`, completed: true });
          toast.success(`أحسنت! +${add} دقيقة تركيز 🎯`);
        })();
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [room, isMember, user, id, members]);

  const join = async () => {
    if (!user) return toast.error("سجّل دخولك للانضمام");
    const { error } = await supabase.from("room_members").insert({ room_id: id, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    toast.success("انضممت للغرفة");
  };
  const leave = async () => {
    if (!user) return;
    await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", user.id);
    navigate({ to: "/rooms" });
  };
  const startTimer = async () => {
    if (!isOwner) return;
    await supabase.from("study_rooms").update({
      timer_running: true, timer_started_at: new Date().toISOString(), timer_duration_minutes: minutes,
    }).eq("id", id);
  };
  const stopTimer = async () => {
    if (!isOwner) return;
    await supabase.from("study_rooms").update({ timer_running: false, timer_started_at: null }).eq("id", id);
  };
  const deleteRoom = async () => {
    if (!isOwner) return;
    if (!confirm("حذف الغرفة نهائياً؟")) return;
    await supabase.from("study_rooms").delete().eq("id", id);
    navigate({ to: "/rooms" });
  };
  const send = async () => {
    if (!user) return toast.error("سجّل دخولك");
    if (!isMember) return toast.error("انضم للغرفة أولاً");
    if (!msg.trim()) return;
    await supabase.from("room_messages").insert({ room_id: id, user_id: user.id, content: msg.trim() });
    setMsg("");
  };

  if (!room) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-center text-muted-foreground">جاري التحميل…</div>;
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = room.timer_running && room.timer_duration_minutes
    ? ((room.timer_duration_minutes * 60 - remaining) / (room.timer_duration_minutes * 60)) * 100
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/rooms" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowRight className="h-4 w-4" /> كل الغرف
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gradient-primary truncate">{room.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {room.subject && <span className="text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold">{room.subject}</span>}
            <span className="flex items-center gap-1 text-[11px] rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> {members.length}</span>
          </div>
          {room.description && <p className="text-sm text-muted-foreground mt-2">{room.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {isMember ? (
            <button onClick={leave} className="rounded-xl bg-secondary hover:bg-destructive/10 hover:text-destructive text-sm font-bold px-3 py-2 flex items-center gap-1.5">
              <LogOut className="h-4 w-4" /> خروج
            </button>
          ) : (
            <button onClick={join} className="rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold px-4 py-2 text-sm flex items-center gap-1.5">
              <Radio className="h-4 w-4" /> انضم
            </button>
          )}
          {isOwner && (
            <button onClick={deleteRoom} className="p-2 rounded-xl bg-secondary hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Shared Timer */}
          <div className="surface-card rounded-3xl p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Radio className="h-3.5 w-3.5 text-primary animate-pulse" /> تايمر مشترك
              </div>
              <div className="relative inline-block mb-4">
                <svg className="w-56 h-56 -rotate-90" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="92" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
                  <circle cx="100" cy="100" r="92" fill="none" stroke="url(#roomG)" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(progress / 100) * 578} 578`} className="transition-all duration-1000" />
                  <defs><linearGradient id="roomG"><stop offset="0%" stopColor="hsl(var(--primary))" /><stop offset="100%" stopColor="hsl(var(--accent))" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-5xl font-bold tabular-nums text-foreground">{mm}<span className="text-primary mx-1">:</span>{ss}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{room.timer_running ? "المتبقي" : "جاهز للبدء"}</p>
                </div>
              </div>
              {isOwner ? (
                <div className="flex items-center justify-center gap-3">
                  {!room.timer_running && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">مدة</label>
                      <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
                        className="rounded-lg bg-secondary/50 border border-border px-2 py-1 text-sm font-bold">
                        {[15, 25, 45, 50, 60, 90].map((n) => <option key={n} value={n}>{n} د</option>)}
                      </select>
                    </div>
                  )}
                  {room.timer_running ? (
                    <button onClick={stopTimer} className="rounded-full bg-destructive text-destructive-foreground px-5 py-2.5 font-bold flex items-center gap-2">
                      <Pause className="h-4 w-4" /> إيقاف
                    </button>
                  ) : (
                    <button onClick={startTimer} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 font-bold flex items-center gap-2">
                      <Play className="h-4 w-4" /> ابدأ الجلسة
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" /> صاحب الغرفة هو من يبدأ الجلسة
                </p>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="surface-card rounded-3xl flex flex-col h-[500px]">
            <div className="p-4 border-b border-border font-extrabold text-sm">شات الغرفة</div>
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
                      <div className="text-[10px] text-muted-foreground mb-0.5">{m.display_name || "مستخدم"}</div>
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
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder={isMember ? "اكتب رسالة…" : "انضم للغرفة للمشاركة"}
                disabled={!isMember}
                className="flex-1 rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50" />
              <button onClick={send} disabled={!isMember || !msg.trim()}
                className="rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold px-4 disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="surface-card rounded-3xl p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-extrabold">لوحة الغرفة</h3>
          </div>
          <div className="space-y-2">
            {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ما في أعضاء بعد</p>}
            {members.map((m, i) => {
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
