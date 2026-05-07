import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Lightbulb, Send, CheckCircle2, Clock as ClockIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/suggestions")({ component: () => <AuthGate><Suggestions /></AuthGate> });

interface Sugg { id: string; content: string; status: string; created_at: string }

function Suggestions() {
  const { user } = useAuth();
  const [items, setItems] = useState<Sugg[]>([]);
  const [text, setText] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("suggestions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setItems(data as Sugg[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("suggestions").insert({ user_id: user.id, content: text.trim() });
    if (error) return toast.error("فشل الإرسال");
    toast.success("شكراً على اقتراحك!");
    setText(""); load();
  };

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">اقتراحاتك</h1>
        </div>
        <p className="text-muted-foreground mb-6">شاركنا أفكارك لتطوير المنصة — كل اقتراح يصل مباشرة للإدارة</p>

        <form onSubmit={submit} className="glass-strong rounded-2xl p-5 mb-6">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="اقترح ميزة، حسّن شيئاً، أبلغ عن مشكلة..." rows={4} maxLength={2000} className="w-full rounded-lg bg-secondary/50 px-4 py-2 outline-none focus:ring-2 focus:ring-primary resize-none mb-3" />
          <button type="submit" disabled={!text.trim()} className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-2.5 font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Send className="h-4 w-4 rotate-180" />إرسال</button>
        </form>

        <h2 className="font-bold mb-3">اقتراحاتي السابقة</h2>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-muted-foreground text-center py-8">لم ترسل اقتراحات بعد</p>}
          {items.map((s) => (
            <div key={s.id} className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                {s.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <ClockIcon className="h-4 w-4 text-amber-400" />}
                <span className="text-xs text-muted-foreground">{s.status === "approved" ? "تمت الموافقة" : s.status === "rejected" ? "مرفوض" : "قيد المراجعة"}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
