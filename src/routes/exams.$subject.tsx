import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, XCircle, ChevronRight, ArrowRight, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/exams/$subject")({ component: () => <AuthGate><ExamPage /></AuthGate> });

interface Q { q: string; choices: string[]; answer: number; }

const QUESTIONS: Record<string, { name: string; s1: Q[]; s2: Q[] }> = {
  religion: {
    name: "التربية الإسلامية",
    s1: [
      { q: "ما هو أول ما نزل من القرآن الكريم؟", choices: ["﴿يَا أَيُّهَا الْمُدَّثِّرُ﴾", "﴿اقْرَأْ بِاسْمِ رَبِّكَ﴾", "سورة الفاتحة", "آية الكرسي"], answer: 1 },
      { q: "كم عدد أركان الإسلام؟", choices: ["أربعة", "خمسة", "ستة", "ثلاثة"], answer: 1 },
      { q: "في أي غزوة كان النصر الفاصل للمسلمين أول مرة؟", choices: ["أحد", "الخندق", "بدر", "حنين"], answer: 2 },
      { q: "من هو الصحابي الملقب بـ ذي النورين؟", choices: ["أبو بكر", "عمر", "عثمان", "علي"], answer: 2 },
      { q: "ما حكم صلاة الجماعة للرجال؟", choices: ["مستحبة", "واجبة", "مكروهة", "مباحة"], answer: 1 },
    ],
    s2: [
      { q: "ما الفرق بين الفرض والواجب عند الجمهور؟", choices: ["لا فرق", "الفرض ما ثبت بقطعي والواجب بظني", "الواجب أعلى", "الفرض اختياري"], answer: 1 },
      { q: "متى فُرض الصيام؟", choices: ["السنة الأولى", "السنة الثانية للهجرة", "السنة الخامسة", "قبل الهجرة"], answer: 1 },
      { q: "كم نصاب الذهب في الزكاة؟", choices: ["20 ديناراً (85 جراماً)", "100 جرام", "50 جراماً", "200 درهم"], answer: 0 },
    ],
  },
  arabic: {
    name: "اللغة العربية",
    s1: [
      { q: "ما إعراب كلمة 'محمد' في 'جاء محمد'؟", choices: ["مفعول به", "فاعل مرفوع", "مبتدأ", "خبر"], answer: 1 },
      { q: "ما نوع 'كان' في 'كان الجوّ جميلاً'؟", choices: ["تامة", "ناقصة", "زائدة", "ماضية فقط"], answer: 1 },
      { q: "أيٌّ من هذه أداة شرط جازمة؟", choices: ["إذا", "لو", "إنْ", "كلما"], answer: 2 },
      { q: "ما جمع 'كتاب'؟", choices: ["كاتبون", "كتب", "كتّاب", "ب و ج"], answer: 3 },
    ],
    s2: [
      { q: "البلاغة: 'الرجل أسد' — ما نوع التشبيه؟", choices: ["مرسل", "بليغ", "تمثيلي", "ضمني"], answer: 1 },
      { q: "ما العَروض في 'بحر الكامل'؟", choices: ["متفاعلن", "فاعلاتن", "مستفعلن", "فعولن"], answer: 0 },
    ],
  },
  english: {
    name: "اللغة الإنجليزية",
    s1: [
      { q: "Choose the correct: She ___ to school every day.", choices: ["go", "goes", "going", "gone"], answer: 1 },
      { q: "Past tense of 'write':", choices: ["writed", "wrote", "writen", "writting"], answer: 1 },
      { q: "Synonym of 'happy':", choices: ["sad", "joyful", "angry", "tired"], answer: 1 },
      { q: "Choose: I have ___ apple.", choices: ["a", "an", "the", "no"], answer: 1 },
    ],
    s2: [
      { q: "Passive of: 'They built the house.'", choices: ["The house was built.", "The house is built.", "House built was.", "Built the house."], answer: 0 },
      { q: "Conditional: 'If I ___ rich, I would travel.'", choices: ["am", "was", "were", "be"], answer: 2 },
    ],
  },
  history: {
    name: "تاريخ الأردن",
    s1: [
      { q: "متى تأسست إمارة شرق الأردن؟", choices: ["1916", "1921", "1946", "1950"], answer: 1 },
      { q: "من هو مؤسس المملكة الأردنية الهاشمية؟", choices: ["الملك عبدالله الأول", "الملك طلال", "الملك حسين", "الملك عبدالله الثاني"], answer: 0 },
      { q: "متى استقلّت المملكة الأردنية الهاشمية؟", choices: ["1946", "1948", "1952", "1923"], answer: 0 },
      { q: "أين وُلِد الشريف الحسين بن علي؟", choices: ["إسطنبول", "مكة المكرمة", "بغداد", "عمّان"], answer: 0 },
    ],
    s2: [
      { q: "في أي عام تنازل الملك طلال عن العرش؟", choices: ["1951", "1952", "1953", "1955"], answer: 1 },
      { q: "متى تولى الملك حسين سلطاته الدستورية؟", choices: ["1953", "1954", "1955", "1952"], answer: 0 },
    ],
  },
};

function ExamPage() {
  const { subject } = useParams({ from: "/exams/$subject" });
  const data = QUESTIONS[subject];
  const [semester, setSemester] = useState<"s1" | "s2" | null>(null);

  if (!data) {
    return <PageBackground><div className="p-8 text-center">المادة غير موجودة <Link to="/exams" className="text-primary">العودة</Link></div></PageBackground>;
  }

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/exams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"><ChevronRight className="h-4 w-4" />الرجوع للمواد</Link>
        <h1 className="text-3xl font-bold text-gradient-warm mb-2">{data.name}</h1>

        {!semester ? (
          <div className="grid gap-4 sm:grid-cols-2 mt-6">
            <button onClick={() => setSemester("s1")} className="glass-strong rounded-2xl p-8 hover:scale-[1.02] transition text-right">
              <h3 className="text-xl font-bold mb-1">الفصل الأول</h3>
              <p className="text-sm text-muted-foreground">{data.s1.length} سؤال</p>
            </button>
            <button onClick={() => setSemester("s2")} className="glass-strong rounded-2xl p-8 hover:scale-[1.02] transition text-right">
              <h3 className="text-xl font-bold mb-1">الفصل الثاني</h3>
              <p className="text-sm text-muted-foreground">{data.s2.length} سؤال</p>
            </button>
          </div>
        ) : (
          <Quiz key={semester} subject={subject} year="2009" semester={semester} questions={data[semester]} onBack={() => setSemester(null)} />
        )}
      </div>
    </PageBackground>
  );
}

function Quiz({ subject, year, semester, questions, onBack }: { subject: string; year: string; semester: string; questions: Q[]; onBack: () => void }) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [startTime] = useState(Date.now());

  const select = (qi: number, ci: number) => {
    if (submitted) return;
    const next = [...answers]; next[qi] = ci; setAnswers(next);
  };

  const submit = async () => {
    const score: number = answers.reduce<number>((s, a, i) => s + (a === questions[i].answer ? 1 : 0), 0);
    setSubmitted(true);
    const duration = Math.round((Date.now() - startTime) / 1000);
    if (user) {
      await supabase.from("exam_attempts").insert({ user_id: user.id, subject, year, score, total: questions.length, duration_seconds: duration });
    }
    toast.success(`نتيجتك: ${score}/${questions.length}`);
  };

  const score: number = submitted ? answers.reduce<number>((s, a, i) => s + (a === questions[i].answer ? 1 : 0), 0) : 0;
  const allAnswered = answers.every((a) => a !== null);

  return (
    <div className="space-y-4">
      {submitted && (
        <div className="glass-strong rounded-2xl p-6 text-center float-in">
          <Trophy className="mx-auto h-10 w-10 text-primary mb-2" />
          <p className="text-3xl font-bold text-gradient-warm">{score} / {questions.length}</p>
          <p className="text-muted-foreground mt-1">{score === questions.length ? "ممتاز! 🌟" : score >= questions.length / 2 ? "أحسنت، استمر!" : "تحتاج لمزيد من المراجعة 💪"}</p>
        </div>
      )}
      {questions.map((q, qi) => (
        <div key={qi} className="glass-strong rounded-2xl p-5">
          <p className="font-bold mb-3">{qi + 1}. {q.q}</p>
          <div className="space-y-2">
            {q.choices.map((c, ci) => {
              const isSelected = answers[qi] === ci;
              const isCorrect = q.answer === ci;
              const showResult = submitted;
              return (
                <button key={ci} onClick={() => select(qi, ci)} disabled={submitted} className={`w-full text-right rounded-xl px-4 py-3 text-sm transition border ${
                  showResult && isCorrect ? "bg-emerald-500/20 border-emerald-500/50" :
                  showResult && isSelected && !isCorrect ? "bg-destructive/20 border-destructive/50" :
                  isSelected ? "bg-primary/15 border-primary/50" : "bg-secondary/40 border-transparent hover:bg-secondary"
                }`}>
                  <div className="flex items-center gap-2">
                    {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <span>{c}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        {!submitted ? (
          <button onClick={submit} disabled={!allAnswered} className="flex-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-bold disabled:opacity-50">إنهاء الاختبار</button>
        ) : (
          <button onClick={onBack} className="flex-1 rounded-full glass-strong py-3 font-bold flex items-center justify-center gap-2">العودة <ArrowRight className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}
