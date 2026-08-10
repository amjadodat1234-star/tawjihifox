export interface Level { name: string; minMinutes: number }

export const LEVELS: Level[] = [
  { name: "مبتدئ", minMinutes: 0 },
  { name: "مجتهد", minMinutes: 120 },
  { name: "متفوق", minMinutes: 400 },
  { name: "متقدم", minMinutes: 900 },
  { name: "خبير", minMinutes: 1800 },
  { name: "عبقري", minMinutes: 3600 },
];

export function levelFor(totalMinutes: number) {
  let idx = 0;
  LEVELS.forEach((l, i) => { if (totalMinutes >= l.minMinutes) idx = i; });
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const span = next ? next.minMinutes - current.minMinutes : 1;
  const progress = next ? Math.min(100, Math.round(((totalMinutes - current.minMinutes) / span) * 100)) : 100;
  return { index: idx, current, next, progress };
}

export interface AchievementDef {
  code: string;
  name: string;
  desc: string;
  icon: string;
  test: (s: { tasks: number; minutes: number; streak: number }) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "first_task", name: "الخطوة الأولى", desc: "أنجزت أول مهمة", icon: "🎯", test: (s) => s.tasks >= 1 },
  { code: "tasks_5", name: "5 مهام", desc: "أنجزت 5 مهام", icon: "✅", test: (s) => s.tasks >= 5 },
  { code: "tasks_10", name: "10 مهام", desc: "أنجزت 10 مهام", icon: "🏅", test: (s) => s.tasks >= 10 },
  { code: "tasks_20", name: "20 مهمة", desc: "أنجزت 20 مهمة", icon: "🏆", test: (s) => s.tasks >= 20 },
  { code: "first_hour", name: "ساعة دراسة", desc: "وصلت إلى 60 دقيقة دراسة", icon: "⏱️", test: (s) => s.minutes >= 60 },
  { code: "minutes_600", name: "10 ساعات", desc: "وصلت إلى 600 دقيقة دراسة", icon: "🔥", test: (s) => s.minutes >= 600 },
  { code: "minutes_1800", name: "30 ساعة", desc: "وصلت إلى 1800 دقيقة دراسة", icon: "💎", test: (s) => s.minutes >= 1800 },
  { code: "streak_3", name: "3 أيام متتالية", desc: "درست 3 أيام دون انقطاع", icon: "📅", test: (s) => s.streak >= 3 },
  { code: "streak_7", name: "أسبوع كامل", desc: "درست 7 أيام متتالية", icon: "🌟", test: (s) => s.streak >= 7 },
  { code: "streak_30", name: "شهر متواصل", desc: "درست 30 يوماً متتالياً", icon: "👑", test: (s) => s.streak >= 30 },
];
