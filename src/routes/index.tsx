import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, BookOpen, GraduationCap, MessageSquare, FolderOpen, Trophy, Sparkles, Clock, FileText, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

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

function Welcome() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center mb-14 slide-up">
        <div className="relative mx-auto mb-6 inline-block">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-accent blur-2xl opacity-40" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent pulse-soft">
            <GraduationCap className="h-12 w-12 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold mb-3">
          <span className="shimmer-text">توجيهي فوكس</span>
        </h1>
        <p className="text-xl text-foreground/80 mb-3">رفيقك الذكي نحو النجاح في التوجيهي</p>
        <p className="max-w-2xl mx-auto text-base text-muted-foreground leading-relaxed">
          منصة تعليمية شاملة جامعة لكل ما يحتاجه طالب التوجيهي: تايمر إنجاز ذكي، اختبارات تجريبية، منتدى تفاعلي، ورد قرآن، أذكار، ملفات دراسية، وإحصائيات تتابعك خطوة بخطوة.
        </p>

        <div className="flex flex-wrap gap-3 justify-center mt-8">
          {user ? (
            <Link to="/focus" className="group rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-3 font-bold flex items-center gap-2 hover:scale-105 transition glow-primary">
              ابدأ الآن
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition" />
            </Link>
          ) : (
            <Link to="/login" className="group rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-3 font-bold flex items-center gap-2 hover:scale-105 transition glow-primary">
              ابدأ مجاناً
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition" />
            </Link>
          )}
          <Link to="/forum" className="rounded-full surface-card px-8 py-3 font-bold hover:bg-secondary transition">
            تصفّح المنتدى
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        {features.map((f, i) => (
          <div
            key={f.title}
            className="group surface-card rounded-2xl p-6 hover:scale-[1.03] hover:-translate-y-1 transition-all duration-300 slide-up cursor-default"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} text-white shadow-lg group-hover:scale-110 transition`}>
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
