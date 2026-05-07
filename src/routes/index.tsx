import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { Brain, BookOpen, GraduationCap, MessageSquare, FolderOpen, Trophy, Sparkles, Clock, FileText } from "lucide-react";

export const Route = createFileRoute("/")({ component: () => <AuthGate><Welcome /></AuthGate> });

const features = [
  { icon: Brain, title: "مؤقت تركيز ذكي", desc: "بومودورو مع نظام سترك ومتصدرين" },
  { icon: GraduationCap, title: "اختبارات المواد", desc: "دين، عربي، إنجليزي، تاريخ الأردن" },
  { icon: BookOpen, title: "ورد القرآن", desc: "تتبع قراءتك اليومية" },
  { icon: Clock, title: "أوقات الصلاة", desc: "حسب موقعك تماماً" },
  { icon: Sparkles, title: "أذكار", desc: "أذكار الصباح والمساء" },
  { icon: MessageSquare, title: "منتدى تعليمي", desc: "منشورات وتعليقات بين الطلاب" },
  { icon: FolderOpen, title: "ملفات الدراسة", desc: "شارك وحمّل الملفات" },
  { icon: FileText, title: "مذكرات شخصية", desc: "دوّن أفكارك وملاحظاتك" },
  { icon: Trophy, title: "متصدرون", desc: "تنافس مع زملائك" },
];

function Welcome() {
  return (
    <PageBackground dim={0.55}>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center mb-12 float-in">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent glow-warm pulse-warm">
            <GraduationCap className="h-12 w-12 text-primary-foreground" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gradient-warm mb-4">توجيهي فوكس</h1>
          <p className="text-xl text-muted-foreground mb-2">رفيقك نحو النجاح في التوجيهي</p>
          <p className="max-w-2xl mx-auto text-base text-muted-foreground/80 leading-relaxed">
            منصة شاملة جامعة لكل ما يحتاجه طالب التوجيهي: تركيز ذكي، اختبارات تجريبية، ورد قرآن، أذكار، منتدى للنقاش، ملفات دراسية، وإحصائيات تتبعك خطوة بخطوة.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {features.map((f, i) => (
            <div key={f.title} className="glass-strong rounded-2xl p-5 hover:scale-[1.02] transition-transform float-in" style={{ animationDelay: `${i * 60}ms` }}>
              <f.icon className="h-7 w-7 text-primary mb-3" />
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/focus" className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-3 font-semibold hover:opacity-90 transition glow-warm">ابدأ التركيز</Link>
          <Link to="/exams" className="rounded-full glass-strong px-8 py-3 font-semibold hover:bg-secondary transition">جرّب اختباراً</Link>
        </div>
      </div>
    </PageBackground>
  );
}
