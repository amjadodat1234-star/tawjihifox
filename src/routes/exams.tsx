import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Lock, ArrowLeft } from "lucide-react";
import { useCohort, subjectsFor, fieldName, READY_SUBJECTS } from "@/lib/cohort";

export const Route = createFileRoute("/exams")({
  head: () => ({
    meta: [
      { title: "الاختبارات — توجيهي فوكس" },
      { name: "description", content: "اختبارات مخصصة حسب جيلك وحقلك الدراسي في التوجيهي." },
      { property: "og:title", content: "الاختبارات — توجيهي فوكس" },
      { property: "og:description", content: "اختبارات مخصصة حسب جيلك وحقلك الدراسي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Exams,
});

function Exams() {
  const { generation, field } = useCohort();
  const [semester, setSemester] = useState<"s1" | "s2">("s1");
  const subjects = subjectsFor(generation, field);

  if (!generation) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-primary mb-4" />
        <h1 className="text-2xl font-extrabold mb-2">اختر جيلك أولاً</h1>
        <p className="text-muted-foreground mb-6">الاختبارات تعتمد على جيلك وحقلك الدراسي.</p>
        <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">
          اختيار الجيل <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold text-gradient-primary">الاختبارات</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        جيل {generation}{field ? ` — ${fieldName(field)}` : " — المواد المشتركة"}
      </p>

      <div className="surface-card rounded-2xl p-1.5 mb-6 inline-flex gap-1">
        {([["s1", "الفصل الأول"], ["s2", "الفصل الثاني"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSemester(id)}
            className={`rounded-xl px-6 py-2 text-sm font-bold transition ${semester === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {subjects.map((s) => {
          const ready = READY_SUBJECTS.has(s.id);
          if (!ready) {
            return (
              <div key={s.id} className="surface-card rounded-2xl p-6 opacity-60">
                <Lock className="h-6 w-6 text-muted-foreground mb-3" />
                <h3 className="text-xl font-bold mb-1">{s.name}</h3>
                <p className="text-xs text-muted-foreground">أسئلة هذه المادة قيد الإعداد</p>
              </div>
            );
          }
          return (
            <Link key={s.id} to="/exams/$subject" params={{ subject: s.id }} search={{ semester }}
              className="surface-card rounded-2xl p-6 hover-lift">
              <GraduationCap className="h-6 w-6 text-primary mb-3" />
              <h3 className="text-xl font-bold mb-1">{s.name}</h3>
              <p className="text-xs text-muted-foreground">{semester === "s1" ? "الفصل الأول" : "الفصل الثاني"}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
