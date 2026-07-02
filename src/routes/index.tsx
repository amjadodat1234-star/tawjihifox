import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Brain, BookOpen, GraduationCap, MessageSquare, FolderOpen, Trophy, Sparkles, Clock, FileText, ArrowLeft, Zap, Flame, Target } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({ component: Welcome });

const features = [
  { icon: Brain, title: "تايمر إنجاز ذكي", desc: "حدد مهمتك ومدتها، وتابع إنجازك", color: "from-cyan-500 to-teal-500" },
  { icon: GraduationCap, title: "اختبارات المواد", desc: "دين، عربي، إنجليزي، تاريخ الأردن", color: "from-amber-500 to-orange-500" },
  { icon: MessageSquare, title: "منتدى الطلاب", desc: "شارك أفكارك وتفاعل مع زملائك", color: "from-violet-500 to-purple-500" },
  { icon: BookOpen, title: "ورد القرآن", desc: "تتبع قراءتك اليومية", color: "from-emerald-500 to-green-500" },
  { icon: Clock, title: "أوقات الصلاة", desc: "حسب موقعك تماماً", color: "from-sky-500 to-blue-500" },
  { icon: Sparkles, title: "أذكار اليوم", desc: "أذكار الصباح والمساء", color: "from-fuchsia-500 to-pink-500" },
  { icon: FolderOpen, title: "ملفات الدراسة", desc: "شارك وحمّل الملفات", color: "from-rose-500 to-red-500" },
  { icon: FileText, title: "مذكرات شخصية", desc: "دوّن أفكارك وملاحظاتك", color: "from-indigo-500 to-blue-500" },
  { icon: Trophy, title: "متصدرون", desc: "تنافس مع زملائك", color: "from-yellow-500 to-amber-500" },
];

const stats = [
  { icon: Flame, label: "طالب نشِط", value: "+٢٤٠٠" },
  { icon: Target, label: "مهمة أُنجزت", value: "+١٨٬٥٠٠" },
  { icon: Zap, label: "ساعة تركيز", value: "+٩٬٢٠٠" },
];

function TiltCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-50, 50], [8, -8]), { stiffness: 200, damping: 15 });
  const ry = useSpring(useTransform(mx, [-50, 50], [-8, 8]), { stiffness: 200, damping: 15 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    mx.set(x - r.width / 2); my.set(y - r.height / 2);
    ref.current!.style.setProperty("--mx", `${x}px`);
    ref.current!.style.setProperty("--my", `${y}px`);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={`spotlight ${className}`}
    >
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
    <div className="relative overflow-hidden">
      {/* Animated aurora hero backdrop */}
      <div className="aurora-bg absolute inset-0 -z-10" />

      <div className="mx-auto max-w-6xl px-4 pt-16 pb-10">
        {/* Live badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium"
        >
          <span className="ping-dot h-2 w-2 rounded-full bg-emerald-500 text-emerald-500" />
          <span>الآن {count.toLocaleString("ar-EG")} طالب يستعدون للتوجيهي معك</span>
        </motion.div>

        {/* Hero */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 12 }}
            className="relative mx-auto mb-6 inline-block"
          >
            <div className="absolute inset-0 rounded-3xl gradient-anim blur-2xl opacity-60" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl gradient-anim floaty">
              <GraduationCap className="h-14 w-14 text-white drop-shadow" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="text-5xl md:text-7xl font-extrabold mb-4 leading-tight"
          >
            <span className="shimmer-text">توجيهي فوكس</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-foreground/80 mb-3 font-medium"
          >
            رفيقك <span className="text-gradient-warm font-bold">الذكي</span> نحو النجاح في التوجيهي
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="max-w-2xl mx-auto text-base text-muted-foreground leading-relaxed"
          >
            منصة تعليمية شاملة جامعة لكل ما يحتاجه طالب التوجيهي: تايمر إنجاز ذكي، اختبارات تجريبية،
            منتدى تفاعلي، ورد قرآن، أذكار، ملفات دراسية، وإحصائيات تتابعك خطوة بخطوة.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="flex flex-wrap gap-3 justify-center mt-8"
          >
            {user ? (
              <Link to="/focus" className="group relative overflow-hidden rounded-full gradient-anim text-white px-8 py-3.5 font-bold flex items-center gap-2 shadow-lg">
                <span className="relative z-10">ابدأ الآن</span>
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition relative z-10" />
              </Link>
            ) : (
              <Link to="/login" className="group relative overflow-hidden rounded-full gradient-anim text-white px-8 py-3.5 font-bold flex items-center gap-2 shadow-lg">
                <span className="relative z-10">ابدأ مجاناً</span>
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition relative z-10" />
              </Link>
            )}
            <Link to="/forum" className="rounded-full glass-strong px-8 py-3.5 font-bold hover:bg-secondary/80 transition">
              تصفّح المنتدى
            </Link>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mt-12 grid grid-cols-3 gap-3 max-w-2xl mx-auto"
          >
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                whileHover={{ y: -4, scale: 1.03 }}
                className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-1"
              >
                <s.icon className="h-5 w-5 text-primary" />
                <div className="text-lg md:text-xl font-extrabold text-gradient-primary">{s.value}</div>
                <div className="text-[11px] md:text-xs text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Features grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-14">
          {features.map((f, i) => (
            <TiltCard key={f.title} delay={i * 0.05}>
              <div className="group surface-card rounded-2xl p-6 h-full hover-lift">
                <motion.div
                  whileHover={{ rotate: [0, -8, 8, 0], scale: 1.15 }}
                  transition={{ duration: 0.5 }}
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} text-white shadow-lg`}
                >
                  <f.icon className="h-6 w-6" />
                </motion.div>
                <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </TiltCard>
          ))}
        </div>

        {/* Marquee bar */}
        <div className="glass-strong rounded-2xl py-4 overflow-hidden mb-10">
          <div className="ticker-track text-sm font-semibold text-muted-foreground">
            {Array.from({ length: 2 }).flatMap((_, k) => [
              "🔥 استمرارية يومية",
              "📚 اختبارات محاكية",
              "🕌 أوقات الصلاة",
              "💬 منتدى الطلاب",
              "🏆 لوحة المتصدرين",
              "🎯 مهام يومية وأسبوعية",
              "📊 إحصائيات ذكية",
              "✨ أذكار اليوم",
            ].map((t, i) => <span key={`${k}-${i}`}>{t}</span>))}
          </div>
        </div>
      </div>
    </div>
  );
}
