
## 1. تحسينات المنتدى (`src/routes/forum.tsx`)

**أ. تكبير الصورة عند الضغط (Lightbox)**
- إضافة state `lightbox: { url, kind } | null`
- جعل صور المنشورات تستخدم `cursor-zoom-in` + `onClick` لفتح overlay (`fixed inset-0`) فيه الصورة بالحجم الكامل مع زر إغلاق + إغلاق بالضغط على الخلفية أو زر Esc.
- الفيديوهات تبقى بـ controls كما هي.

**ب. الردود على التعليقات (Replies)**
- إضافة عمود `parent_id` (nullable) على جدول `comments` (migration).
- في الواجهة: زر "رد" تحت كل تعليق يفتح حقل إدخال صغير، وعند الإرسال يُحفظ مع `parent_id`.
- عرض الردود متداخلة (indent بسيط) تحت التعليق الأب — مستوى واحد فقط لتجنّب التعقيد.

**ج. "عرض المزيد من التعليقات"**
- عند فتح صندوق التعليقات نعرض أول 4 تعليقات (آباء فقط) + زر "عرض كل التعليقات (N)".
- الردود الخاصة بكل تعليق ظاهر تظهر دائماً تحته.

---

## 2. إعادة تصميم نظام الإنجاز (`src/routes/focus.tsx`)

استلهام من الصور المرفقة مع تطوير أكبر:

**الهيكل الجديد للصفحة:**
```
[Header: الإنجاز + احصائياتي السريعة (streak / إجمالي الدقائق)]
[Tabs: يومي | أسبوعي | شهري]  ← تصميم pill حديث مع underline animation
[Card: "أضف مهمة جديدة"]
  - حقل: ماذا ستنجز؟
  - Stepper مزدوج لـ (ساعة : دقيقة) بدل السلايدر — كما في الصورة
  - Helper: "الحد الأقصى 5 ساعات"
  - زر: "أنشئ المهمة"
[Card: تحليلاتي وإنجازاتي]
  - Tabs فرعية: قيد الإنجاز (N) | منجزاتي (N)
  - عرض المهام بكروت أنيقة: اسم، شريط تقدم، الوقت المتبقي/المُنجز، أزرار (ابدأ/أكمل/احذف)
[Card: قائمة المتصدرين] (من الـ leaderboard المباشر — top 10)
```

**التطويرات على الفكرة الأساسية:**
- **Stepper الوقت**: مربعا اختيار رقميان (ساعة/دقيقة) مع أزرار +/- وإمكانية الكتابة المباشرة، مع حد أقصى 5 ساعات.
- **حالات المهمة**: `pending` / `active` / `completed` / `failed` بدلاً من مجرد done_min.
- **عند الضغط على "ابدأ"** لمهمة قيد الإنجاز: تدخل في وضع التايمر مع شاشة التايمر الداكنة (تبقى كما هي بخلفية متحركة).
- **شريط تقدم في الكارت** بألوان متدرجة + نسبة مئوية + badge "اليوم/الأسبوع/الشهر".
- **animations**: framer-motion style بـ Tailwind (slide-up + scale-in) عند إضافة/إنجاز مهمة + confetti بسيط (CSS) عند الإنجاز.
- **تخزين**: نقل المهام من `localStorage` إلى جدول Supabase جديد `missions` (للمستخدمين المسجّلين) مع fallback لـ localStorage للزوار.
- **خلفية الصفحة بيضاء** (مثل الصورة) — فقط شاشة التايمر النشط (`phase !== 'setup'`) تستخدم الخلفية الداكنة المتحركة.

**Migration مقترحة:**
```sql
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  target_minutes int not null,
  done_minutes int not null default 0,
  period text not null check (period in ('daily','weekly','monthly')),
  status text not null default 'pending' check (status in ('pending','active','completed','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
-- RLS: المستخدم يدير مهامه فقط
```

---

## 3. صورة الملف الشخصي في الـ Header (`src/routes/__root.tsx`)

- استبدال الدائرة الحالية (الحرف الأول) في `TopBar` بـ `Avatar` يعرض `avatar_url` من جدول `profiles`، وعند غيابها يعرض الحرف الأول.
- جعلها زرّاً يفتح **dropdown menu** (استخدام `@/components/ui/dropdown-menu` المتوفر) يحتوي على:
  - الاسم + الإيميل (header)
  - رابط: الإعدادات
  - رابط: إحصائياتي
  - رابط: لوحة الأدمن (إذا كان admin)
  - فاصل
  - تسجيل الخروج
- جلب `avatar_url` عبر hook صغير `useProfile()` يستعلم من `profiles` ويُخزّن في حالة محلية.

---

## ملاحظات تقنية

- المنتدى: استخدام `Dialog` من shadcn للـ lightbox.
- التايمر: إعادة الهيكلة ستفصل الصفحة إلى مكوّنين (`MissionsBoard` و `TimerScreen`) داخل نفس الملف للحفاظ على البساطة.
- جميع التغييرات تحترم design tokens (`--primary`, `--accent`) — لا ألوان hardcoded.
- الـ migration ستحتاج موافقتك قبل التنفيذ.
