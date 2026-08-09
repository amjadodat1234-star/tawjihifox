import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Wand2, Target, MessageSquare, Brain, BookOpen, ArrowLeft, Sparkles, Zap, Users, TrendingUp, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRef, useState, useEffect } from "react";

export const Route = createFileRoute("/")({ component: Welcome });

const pillars = [
  {
    icon: Wand2,
    title: "أستاذ فوكس AI",
    tag: "الميزة النجمة",
    desc: "معلم ذكي متاح 24/7. يشرحلك أي درس، يختبرك ويصحح إجاباتك، أو يلخصلك أي نص بضغطة زر.",
    color: "from-violet-500 to-purple-600",
    to: "/tutor",
    bullets: ["اشرحلي أي مفهوم بلغة سهلة", "اختبرني — 5 أسئلة + تصحيح", "لخّصلي أي نص بثواني"],
  },
  {
    icon: Target,
    title: "خطة مذاكرة تكيّفية",
    tag: "شخصية لك",
    desc: "تدخل تاريخ التوجيهي ونقاط ضعفك، فتحصل على جدول يومي مبني رياضياً على وقتك المتبقي.",
    color: "from-emerald-500 to-cyan-500",
    to: "/plan",
    bullets: ["حساب أيامك المتبقية تلقائياً", "توزيع المواد حسب ضعفك", "تركيز اليوم بضغطة"],
  },
  {
    icon: Brain,
    title: "تايمر الإنجاز",
    tag: "بدل الـ Pomodoro العادي",
    desc: "تحدد شو بدك تنجز والوقت، ونحن نتابعك حتى لو غادرت الصفحة. جلساتك تُبنى ستريك ومتصدرين.",
    color: "from-orange-500 to-amber-500",
    to: "/focus",
    bullets: ["تايمر يستمر حتى لو خرجت", "ستريك يومي متواصل", "متصدرون بين الطلاب"],
  },
];

const secondary = [
  { icon: MessageSquare, label: "منتدى تفاعلي", to: "/forum" },
  { icon: BookOpen, label: "ورد قرآن يومي", to: "/quran" },
  { icon: Sparkles, label: "أذكار الصباح والمساء", to: "/azkar" },
  { icon: TrendingUp, label: "إحصائيات ذكية", to: "/stats" },
];

function TiltCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0); const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-50, 50], [6, -6]), { stiffness: 200, damping: 15 });
  const ry = useSpring(useTransform(mx, [-50, 50], [-6, 6]), { stiffness: 200, damping: 15 });
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    mx.set(x - r.width / 2); my.set(y - r.height / 2);
    ref.current!.style.setProperty("--mx", `${x}px`);
    ref.current!.style.setProperty("--my", `${y}px`);
  };
  const onLeave = () => { mx.set(0); my.set(0); };
  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={`spotlight ${className}`}>
      {children}
    </motion.div>
  );
}

function Welcome() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let i = 0; const target = 2400;
    const t = setInterval(() => {
      i += Math.ceil(target / 60);
      if (i >= target) { setCount(target); clearInterval(t); } else setCount(i);
    }, 20);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-16">
      {/* Ambient hero background — full bleed across the viewport */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-screen w-screen overflow-hidden -z-10">
        <div className="aurora" />
        <div className="grid-veil" />
      </div>

      {/* Live badge */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold">
        <span className="ping-dot h-2 w-2 rounded-full bg-emerald-500 text-emerald-500" />
        <span>الآن {count.toLocaleString("ar-EG")} طالب يستعدون للتوجيهي معك</span>
      </motion.div>

      {/* Hero */}
      <div className="relative text-center mb-14">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <div className="orbit-ring" style={{ width: 460, height: 460, left: -230, top: -230 }} />
          <div className="orbit-ring rev" style={{ width: 640, height: 640, left: -320, top: -320 }} />
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold mb-5 leading-[1.5] tracking-tight">
          <motion.span initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} className="block">
            مو مجرد موقع.
          </motion.span>
          <motion.span initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="block text-gradient-hero pb-3">
            رفيقك الذكي للتوجيهي.
          </motion.span>
        </h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          className="max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed mb-8">
          منصة تعرف نقاط ضعفك، تشرحلك لما تحتار، تختبرك لما تجهز، وتبنيلك جدول يومي يوصلك ليوم الامتحان.
          <br /> <span className="text-foreground font-semibold">مو موقع روابط. رفيق مذاكرة حقيقي.</span>
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="flex flex-wrap gap-3 justify-center">
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link to={user ? "/tutor" : "/login"} className="sheen group relative rounded-full gradient-anim text-white px-8 py-3.5 font-bold flex items-center gap-2 shadow-lg shadow-primary/25">
              <Wand2 className="h-4 w-4" />
              <span>جرّب أستاذ فوكس مجاناً</span>
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link to="/plan" className="glass-border rounded-full surface-card px-8 py-3.5 font-bold hover:border-primary/50 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> ابنِ خطتك
            </Link>
          </motion.div>
        </motion.div>

        {/* Micro-proof */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {["مجاني 100%", "بدون إعلانات", "منهاج التوجيهي الأردني"].map((t, i) => (
            <motion.span key={t} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.1 }} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> {t}
            </motion.span>
          ))}
        </motion.div>
      </div>


      {/* Pillars — the 3 value propositions */}
      <div className="grid gap-5 md:grid-cols-3 mb-14">
        {pillars.map((p, i) => (
          <TiltCard key={p.title} delay={i * 0.1}>
            <Link to={p.to} className="block h-full">
              <div className="surface-card rounded-3xl p-6 h-full hover-lift group">
                <div className="flex items-center justify-between mb-4">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${p.color} text-white shadow-lg`}>
                    <p.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2 py-1">{p.tag}</span>
                </div>
                <h3 className="font-extrabold text-xl mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{p.desc}</p>
                <ul className="space-y-1.5 mb-4">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:gap-2 transition-all">
                  جرّبها الآن <ArrowLeft className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          </TiltCard>
        ))}
      </div>

      {/* "Why we're different" section */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="rounded-3xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 border border-primary/10 p-8 md:p-10 mb-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary bg-primary/10 rounded-full px-3 py-1 mb-3">
              <Zap className="h-3 w-3" /> شو الفرق؟
            </div>
            <h2 className="text-3xl font-extrabold mb-3">مواقع تانية بتعطيك روابط. نحنا بنعطيك <span className="text-gradient-primary">نتائج.</span></h2>
            <p className="text-muted-foreground">الفرق مو بعدد الأزرار، الفرق إنك بعد أول أسبوع مع توجيهي فوكس بتحس إنك فعلاً تقدمت. لأن كل ميزة عندنا مصممة تعطيك قيمة قابلة للقياس.</p>
          </div>
          <div className="space-y-3">
            {[
              { a: "روابط PDFs متفرقة", b: "معلم AI يشرحلك ويختبرك" },
              { a: "جدول جامد نفسه للكل", b: "خطة تتكيف مع ضعفك ووقتك" },
              { a: "تايمر Pomodoro عادي", b: "تايمر إنجاز + ستريك + متصدرين" },
            ].map((r, i) => (
              <motion.div key={i} initial={{ x: 30, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 rounded-2xl bg-background p-3 border">
                <span className="flex-1 text-sm text-muted-foreground line-through">{r.a}</span>
                <ArrowLeft className="h-4 w-4 text-primary" />
                <span className="flex-1 text-sm font-bold">{r.b}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Secondary features */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
        {secondary.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
            <Link to={s.to} className="flex flex-col items-center gap-2 rounded-2xl surface-card p-4 hover-lift text-center">
              <s.icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold">{s.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Final CTA */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="rounded-3xl gradient-anim text-white p-8 md:p-12 text-center relative overflow-hidden">
        <Users className="mx-auto h-8 w-8 mb-3 opacity-90" />
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2">جاهز تبدأ رحلتك للتوجيهي؟</h2>
        <p className="opacity-90 mb-6 text-sm md:text-base">انضم لآلاف الطلاب اللي بيبنوا مستقبلهم يومياً.</p>
        <Link to={user ? "/tutor" : "/login"} className="inline-flex items-center gap-2 rounded-full bg-white text-primary px-8 py-3.5 font-bold hover:scale-105 transition">
          {user ? "ادخل على أستاذ فوكس" : "ابدأ مجاناً الآن"} <ArrowLeft className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  );
}
