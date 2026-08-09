import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, HelpCircle, FileText, Send, Loader2, GraduationCap, Wand2, LogIn } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askTutor } from "@/lib/tutor.functions";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/tutor")({
  component: TutorPage,
  head: () => ({
    meta: [
      { title: "أستاذ فوكس — مساعد ذكي لطلاب التوجيهي" },
      { name: "description", content: "معلم متخصص بمنهاج التوجيهي الأردني: اشرحلي، اختبرني، لخّصلي." },
    ],
  }),
});

type Mode = "explain" | "quiz" | "summarize";
type Msg = { role: "user" | "assistant"; content: string; mode?: Mode };

const modes: { id: Mode; label: string; icon: typeof BookOpen; hint: string; color: string }[] = [
  { id: "explain", label: "اشرحلي", icon: BookOpen, hint: "مثال: اشرحلي الاستعارة المكنية مع أمثلة", color: "from-violet-500 to-purple-600" },
  { id: "quiz", label: "اختبرني", icon: HelpCircle, hint: "مثال: اختبرني في معركة اليرموك", color: "from-emerald-500 to-green-600" },
  { id: "summarize", label: "لخّصلي", icon: FileText, hint: "الصق النص هنا وسألخصه لك", color: "from-amber-500 to-orange-600" },
];

function TutorPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("explain");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askTutor);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    if (!user) { toast.error("سجّل دخولك أولاً لتستخدم أستاذ فوكس"); return; }
    const prompt = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: prompt, mode }]);
    setLoading(true);
    try {
      const res = await ask({ data: { mode, prompt } });
      setMessages((m) => [...m, { role: "assistant", content: res.text, mode }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
      setMessages((m) => [...m, { role: "assistant", content: "❌ لم أتمكن من الرد. جرّب مرة أخرى.", mode }]);
    } finally { setLoading(false); }
  };

  const activeMode = modes.find((m) => m.id === mode)!;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-500 shadow-lg shadow-violet-500/25">
          <GraduationCap className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">أستاذ فوكس</h1>
        <p className="mt-1 text-sm text-muted-foreground">معلمك الذكي المتخصص بمنهاج التوجيهي الأردني</p>
      </motion.div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {modes.map((m) => {
          const active = m.id === mode;
          return (
            <motion.button
              key={m.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode(m.id)}
              className={`relative overflow-hidden rounded-2xl p-4 text-center transition-all ${active ? "text-white shadow-lg" : "surface-card hover:border-primary/40"}`}
            >
              {active && (
                <motion.div layoutId="modebg" className={`absolute inset-0 bg-gradient-to-br ${m.color}`} />
              )}
              <div className="relative">
                <m.icon className={`mx-auto h-5 w-5 mb-1 ${active ? "text-white" : "text-primary"}`} />
                <div className="text-sm font-bold">{m.label}</div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Chat area */}
      <div className="surface-card rounded-3xl min-h-[400px] max-h-[60vh] overflow-y-auto p-4 md:p-6 mb-4 scrollbar-thin">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-[350px] text-center">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>
              <Sparkles className="h-10 w-10 text-primary/60 mb-3" />
            </motion.div>
            <p className="text-sm text-muted-foreground max-w-sm">{activeMode.hint}</p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
              {mode === "explain" && ["اشرحلي مقدمة ابن خلدون", "ما هي معركة الكرامة؟", "شرح Present Perfect بمثال"].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="rounded-full glass px-3 py-1.5 text-xs hover:bg-primary/10">{s}</button>
              ))}
              {mode === "quiz" && ["اختبرني بالبلاغة", "اختبرني بتاريخ الأردن الحديث", "اختبرني في التوحيد"].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="rounded-full glass px-3 py-1.5 text-xs hover:bg-primary/10">{s}</button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-4 flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"}`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end mb-4">
            <div className="rounded-2xl bg-secondary px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              أستاذ فوكس يفكر...
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      {!user ? (
        <Link to="/login" className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-3.5 font-bold hover:opacity-90">
          <LogIn className="h-4 w-4" /> سجّل دخول لتستخدم أستاذ فوكس مجاناً
        </Link>
      ) : (
        <div className="surface-card rounded-2xl p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-primary/50 transition">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder={activeMode.hint}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={send}
            disabled={!input.trim() || loading}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 -scale-x-100" />}
          </motion.button>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
        <Wand2 className="h-3 w-3" /> مدعوم بذكاء اصطناعي — راجع الإجابات دائماً
      </p>
    </div>
  );
}
