import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({ component: () => <AuthGate><Chat /></AuthGate> });

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});
  const endRef = useRef<HTMLDivElement>(null);

  const loadProfile = async (userId: string) => {
    if (profiles[userId]) return;
    const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle();
    if (data) setProfiles((p) => ({ ...p, [userId]: data }));
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(200);
      if (data) {
        setMessages(data as Message[]);
        const ids = [...new Set(data.map((m) => m.user_id))];
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
        if (profs) {
          const map: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
          profs.forEach((p) => { map[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
          setProfiles(map);
        }
      }
    })();

    const channel = supabase.channel("public-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => [...prev, m]);
        loadProfile(m.user_id);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as { id: string }).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !user) return;
    setInput("");
    const { error } = await supabase.from("messages").insert({ user_id: user.id, content });
    if (error) toast.error("تعذّر إرسال الرسالة");
  };

  const remove = async (id: string) => {
    await supabase.from("messages").delete().eq("id", id);
  };

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6">
        <header className="glass-strong rounded-2xl px-6 py-4 mb-4">
          <h1 className="text-2xl font-bold text-gradient-warm">غرفة الدردشة العامة</h1>
          <p className="text-xs text-muted-foreground mt-1">تحدّث مع باقي الطلاب — كن لطيفاً ومحترماً</p>
        </header>

        <div className="flex-1 glass rounded-2xl p-4 overflow-y-auto space-y-3 min-h-[60vh]">
          {messages.length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد رسائل بعد. كن أول من يبدأ! 🌟</p>}
          {messages.map((m) => {
            const mine = m.user_id === user?.id;
            const prof = profiles[m.user_id];
            const name = prof?.display_name || "مستخدم";
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {name[0]?.toUpperCase()}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? "bg-primary text-primary-foreground" : "glass-strong"}`}>
                  <div className="flex items-center gap-2 text-[11px] opacity-70 mb-0.5">
                    <span className="font-semibold">{name}</span>
                    <span>{new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
                    {mine && <button onClick={() => remove(m.id)} className="hover:opacity-100"><Trash2 className="h-3 w-3" /></button>}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="mt-4 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder="اكتب رسالة..." className="flex-1 rounded-full glass-strong px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
          <button type="submit" disabled={!input.trim()} className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground disabled:opacity-50">
            <Send className="h-5 w-5 rotate-180" />
          </button>
        </form>
      </div>
    </PageBackground>
  );
}
