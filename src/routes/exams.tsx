import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { GraduationCap, BookOpen, Globe, Calendar, Wrench } from "lucide-react";

export const Route = createFileRoute("/exams")({ component: () => <AuthGate><Exams /></AuthGate> });

const SUBJECTS = [
  { id: "religion", name: "التربية الإسلامية", icon: BookOpen, color: "from-emerald-500/30 to-teal-500/20" },
  { id: "arabic", name: "اللغة العربية", icon: BookOpen, color: "from-amber-500/30 to-orange-500/20" },
  { id: "english", name: "اللغة الإنجليزية", icon: Globe, color: "from-blue-500/30 to-indigo-500/20" },
  { id: "history", name: "تاريخ الأردن", icon: Calendar, color: "from-rose-500/30 to-red-500/20" },
];

function Exams() {
  const [year, setYear] = useState<"2009" | "2010">("2009");
  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">الاختبارات</h1>
        </div>
        <p className="text-muted-foreground mb-6">اختر السنة ثم المادة لبدء الاختبار التجريبي</p>

        <div className="glass-strong rounded-2xl p-2 mb-6 inline-flex">
          <button onClick={() => setYear("2009")} className={`rounded-xl px-6 py-2 text-sm font-bold transition ${year === "2009" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>دفعة 2009</button>
          <button onClick={() => setYear("2010")} className={`rounded-xl px-6 py-2 text-sm font-bold transition ${year === "2010" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>دفعة 2010</button>
        </div>

        {year === "2010" ? (
          <div className="glass-strong rounded-2xl p-10 text-center">
            <Wrench className="mx-auto h-12 w-12 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">قسم دفعة 2010 تحت الصيانة</h2>
            <p className="text-muted-foreground">نعمل حالياً على إعداد اختبارات هذه الدفعة. ترقّبوا التحديثات قريباً 🔧</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            {SUBJECTS.map((s) => (
              <Link key={s.id} to="/exams/$subject" params={{ subject: s.id }} className={`glass-strong rounded-2xl p-6 hover:scale-[1.02] transition bg-gradient-to-br ${s.color}`}>
                <s.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="text-xl font-bold mb-1">{s.name}</h3>
                <p className="text-xs text-muted-foreground">الفصل الأول والثاني</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageBackground>
  );
}
