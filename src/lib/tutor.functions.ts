import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const SYSTEM_PROMPTS: Record<string, string> = {
  explain: `أنت "أستاذ فوكس"، معلم خبير بمناهج التوجيهي في الأردن. اشرح للطالب بلغة عربية سلسة وبسيطة، استخدم أمثلة ملموسة من الحياة، وقسّم الشرح إلى نقاط مرقّمة قصيرة. اختم دائماً بـ "خلاصة سريعة:" في سطر واحد.`,
  quiz: `أنت "أستاذ فوكس". ولّد 5 أسئلة اختيار من متعدد على الموضوع الذي يطلبه الطالب من منهاج التوجيهي الأردني. لكل سؤال: 4 خيارات (أ ب ج د)، ثم اذكر الإجابة الصحيحة، ثم شرح موجز (سطر أو سطران). استخدم Markdown منظم.`,
  summarize: `أنت "أستاذ فوكس". لخّص النص الذي أرسله الطالب في نقاط منظمة: (1) الفكرة الرئيسية بسطر، (2) نقاط رئيسية مرقّمة، (3) مصطلحات مهمة، (4) 3 أسئلة محتملة قد تأتي بالامتحان.`,
};

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      mode: z.enum(["explain", "quiz", "summarize"]),
      prompt: z.string().min(1).max(4000),
      subject: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const system = SYSTEM_PROMPTS[data.mode] + (data.subject ? `\nالمادة: ${data.subject}` : "");

    try {
      const { text } = await generateText({
        model,
        system,
        prompt: data.prompt,
      });
      return { text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
      if (msg.includes("429")) throw new Error("تم الوصول للحد الأقصى من الطلبات، جرّب بعد قليل");
      if (msg.includes("402")) throw new Error("انتهى رصيد AI، تواصل مع الأدمن");
      throw new Error(msg);
    }
  });

/** Generate an adaptive study plan (uses AI to create daily breakdown) */
export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      examDate: z.string(), // ISO date
      dailyHours: z.number().min(0.5).max(12),
      subjects: z.array(z.object({
        name: z.string(),
        weakness: z.number().min(1).max(5), // 1=قوي, 5=ضعيف جداً
      })).min(1),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const examDate = new Date(data.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));

    const totalWeakness = data.subjects.reduce((s, x) => s + x.weakness, 0);
    // Simple algorithmic split (no AI needed for math — faster + free)
    const plan = {
      generated_at: new Date().toISOString(),
      days_left: daysLeft,
      daily_hours: data.dailyHours,
      distribution: data.subjects.map((s) => ({
        name: s.name,
        weakness: s.weakness,
        daily_minutes: Math.round((s.weakness / totalWeakness) * data.dailyHours * 60),
      })),
      today_focus: data.subjects
        .slice()
        .sort((a, b) => b.weakness - a.weakness)[0].name,
    };

    // Save/upsert
    const { error } = await context.supabase.from("study_plans").upsert({
      user_id: context.userId,
      exam_date: data.examDate,
      daily_hours: data.dailyHours,
      subjects: data.subjects,
      plan,
    }, { onConflict: "user_id" });

    if (error) throw new Error(error.message);
    return plan;
  });

export const getStudyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });
