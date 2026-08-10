import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Target, MessageSquare, Brain, ArrowLeft, Sparkles, Users, TrendingUp, Check, GraduationCap, Radio, Flame, Trophy, Heart, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useCohort, FIELDS, fieldName, type FieldId } from "@/lib/cohort";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "توجيهي فوكس — منصة مجانية لطلاب التوجيهي" },
      { name: "description", content: "منصة مجانية من صنع طالب لمساعدة طلاب التوجيهي على الدراسة والاستمرار: مهام، جلسات دراسة، اختبارات، غرف دراسة، منتدى، وإنجازات." },
      { property: "og:title", content: "توجيهي فوكس — منصة مجانية لطلاب التوجيهي" },
      { property: "og:description", content: "مساحة مجانية تساعدك تدرس، تنجز، وتستمر — من طالب لطلاب التوجيهي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

const services = [
  { icon: Brain, title: "نظام الإنجاز والدراسة", desc: "حدّد مهمتك، ابدأ جلسة دراسة، وسجّل إنجازك.", to: "/focus" },
  { icon: GraduationCap, title: "الاختبارات", desc: "اختبارات مرتبطة بجيلك وحقلك فقط.", to: "/exams" },
  { icon: Radio, title: "غرف الدراسة", desc: "ادرس مع طلاب آخرين بجلسة مشتركة.", to: "/rooms" },
  { icon: MessageSquare, title: "المنتدى", desc: "نقاش عام + أقسام متخصصة حسب المسار.", to: "/forum" },
  { icon: TrendingUp, title: "الإحصائيات والتقدم", desc: "دقائق دراستك، مهامك، وهدفك اليومي.", to: "/progress" },
  { icon: Trophy, title: "المستويات والترتيب", desc: "مستوى، إنجازات، أيام متتالية، وترتيب.", to: "/leaderboard" },
];

function Welcome() {
  const { generation, field, setCohort } = useCohort();
  const [pendingGen, setPendingGen] = useState<"2009" | null>(null);
  const navigate = useNavigate();

  const choose2010 = () => { setCohort("2010", null); navigate({ to: "/focus" }); };
  const chooseField = (f: FieldId) => { setCohort("2009", f); navigate({ to: "/focus" }); };

  return (
    <div className="relative mx-auto max-w-5xl px-4 pt-14 pb-16">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-screen w-screen overflow-hidden -z-10">
        <div className="aurora" />
        <div className="grid-veil" />
      </div>

      {/* Identity badge */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold">
        <Heart className="h-3.5 w-3.5 text-rose-500" />
        <span>منصة مجانية بالكامل — من صنع طالب لطلاب التوجيهي</span>
      </motion.div>

      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-5 leading-[1.5] tracking-tight">
          <motion.span initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="block">
            الدراسة مش ساعات بتمرّ.
          </motion.span>
          <motion.span initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
            className="block text-gradient-hero pb-3">رحلة تقدّم واضحة.</motion.span>
        </h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed">
          مساحة مجانية تساعدك تدرس وتستمر: تنجز مهامك، تجمع وقت دراسة، تفتح إنجازات، يرتفع مستواك،
          وتحافظ على سلسلة أيامك — وكل هذا يظهر في تقدّمك وترتيبك.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {["مجانية 100%", "بدون إعلانات", "لطلاب التوجيهي في الأردن"].map((t) => (
            <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> {t}</span>
          ))}
        </motion.div>
      </div>

      {/* Services */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
        {services.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
            <Link to={s.to} className="block h-full surface-card rounded-2xl p-5 hover-lift group">
              <s.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-extrabold mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 p-7 md:p-9 mb-12">
        <h2 className="text-2xl font-extrabold mb-5 text-center">كيف تشتغل المنصة؟</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Target, t: "١. حدّد مهمتك", d: "اسم المهمة، المادة، والمدة." },
            { icon: Brain, t: "٢. ابدأ جلسة دراسة", d: "مؤقت مع استراحة منفصلة عن وقت دراستك." },
            { icon: Flame, t: "٣. راكم تقدّمك", d: "دقائق، إنجازات، مستوى، وسلسلة أيام." },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl bg-background border p-4">
              <x.icon className="h-5 w-5 text-primary mb-2" />
              <p className="font-bold mb-1">{x.t}</p>
              <p className="text-sm text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Cohort selection */}
      <motion.section id="cohort" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="surface-card rounded-3xl p-7 md:p-10 text-center">
        <Users className="mx-auto h-7 w-7 text-primary mb-3" />
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2">اختر جيلك</h2>
        <p className="text-sm text-muted-foreground mb-6">
          جيلك (وحقلك إن كنت 2009) يحدّد الاختبارات والمحتوى والأقسام التي تظهر لك.
        </p>

        {generation && !pendingGen && (
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs font-bold">
            <Check className="h-3.5 w-3.5" />
            اختيارك الحالي: جيل {generation}{field ? ` — ${fieldName(field)}` : ""}
          </div>
        )}

        {!pendingGen ? (
          <div className="grid gap-3 sm:grid-cols-2 max-w-xl mx-auto">
            <button onClick={() => setPendingGen("2009")}
              className="rounded-2xl border-2 border-border p-6 text-right hover:border-primary hover:bg-primary/5 transition">
              <p className="text-2xl font-extrabold mb-1">2009</p>
              <p className="text-xs text-muted-foreground">اختر حقلك بعد ذلك</p>
            </button>
            <button onClick={choose2010}
              className="rounded-2xl border-2 border-border p-6 text-right hover:border-primary hover:bg-primary/5 transition">
              <p className="text-2xl font-extrabold mb-1">2010</p>
              <p className="text-xs text-muted-foreground">مواد مشتركة — دخول مباشر</p>
            </button>
          </div>
        ) : (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setPendingGen(null)} className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" /> رجوع لاختيار الجيل
            </button>
            <p className="font-bold mb-3">اختر حقلك</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <button key={f.id} onClick={() => chooseField(f.id)}
                  className="rounded-2xl border-2 border-border p-5 text-right hover:border-primary hover:bg-primary/5 transition">
                  <p className="font-extrabold">{f.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {generation && !pendingGen && (
          <Link to="/focus" className="mt-7 inline-flex items-center gap-2 rounded-full gradient-anim text-white px-7 py-3 font-bold">
            ادخل إلى المنصة <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground flex items-center justify-center gap-1">
          <Sparkles className="h-3 w-3" /> تقدر ترجع لهذه الصفحة في أي وقت وتغيّر جيلك.
        </p>
      </motion.section>
    </div>
  );
}
