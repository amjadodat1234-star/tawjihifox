import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { Timer, MessageSquare, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/")({ component: () => <AuthGate><Home /></AuthGate> });

function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <div className="text-center mb-14">
        <span className="inline-block text-xs tracking-widest text-muted-foreground uppercase mb-4">Focus Platform</span>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">ركّز. ناقش. أنجز.</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          منصة بسيطة بدون تشتيت. مؤقّت احترافي يساعدك على التركيز، ومنتدى مفتوح لمشاركة الأفكار.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/focus" className="card-soft hover-lift p-7 group">
          <Timer className="h-7 w-7 mb-4 text-primary" strokeWidth={1.5} />
          <h2 className="text-xl font-bold mb-1.5">المؤقت</h2>
          <p className="text-sm text-muted-foreground mb-5">جلسات تركيز هادئة مع خلفية متحركة ناعمة.</p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">ابدأ جلسة <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition" /></span>
        </Link>
        <Link to="/forum" className="card-soft hover-lift p-7 group">
          <MessageSquare className="h-7 w-7 mb-4 text-primary" strokeWidth={1.5} />
          <h2 className="text-xl font-bold mb-1.5">المنتدى</h2>
          <p className="text-sm text-muted-foreground mb-5">فِيد مفتوح للنقاش والمشاركة بدون أقسام.</p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">افتح المنتدى <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition" /></span>
        </Link>
      </div>
    </div>
  );
}
