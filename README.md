# توجيهي فوكس (Tawjihi Focus)

منصة شاملة لطلاب التوجيهي: مؤقت تركيز ذكي، اختبارات، ورد قرآن، أوقات صلاة، أذكار، منتدى تعليمي، ملفات دراسية، مذكرات، اقتراحات، إحصائيات، نظام سترك ومتصدرين، ولوحة أدمن.

## التقنيات المستخدمة

- **Frontend**: React 19 + TypeScript + TanStack Router/Start + Vite 7
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Auth**: Email/Password + Google OAuth

## التشغيل محلياً

### المتطلبات
- Node.js 20+ أو Bun
- حساب Supabase (مجاني)

### الخطوات

1. **استنساخ المشروع وتثبيت التبعيات**
```bash
bun install
# أو: npm install
```

2. **إعداد متغيرات البيئة**
أنشئ ملف `.env` في الجذر:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_ID
```

3. **تطبيق الترحيلات على Supabase**
شغّل ملفات SQL من مجلد `supabase/migrations/` بالترتيب الزمني عبر:
- لوحة Supabase → SQL Editor، أو
- `supabase db push` (إذا كنت تستخدم Supabase CLI)

4. **تفعيل Google OAuth (اختياري)**
في لوحة Supabase → Authentication → Providers → Google.

5. **تعيين الأدمن**
الإيميل `amjadodat1234@gmail.com` يُعيَّن أدمن تلقائياً عند التسجيل (عبر trigger). لتغييره عدّل `handle_new_user()` في الترحيلة.

6. **التشغيل**
```bash
bun run dev
# الموقع متاح على http://localhost:5173
```

7. **البناء للإنتاج**
```bash
bun run build
```

## الميزات

| الميزة | الصفحة |
|---|---|
| ترحيب وشرح المنصة | `/` |
| مؤقت تركيز + سترك | `/focus` |
| متصدرون | `/leaderboard` |
| أوقات الصلاة | `/prayer` |
| ورد القرآن | `/quran` |
| أذكار | `/azkar` |
| اختبارات (4 مواد، فصلان) | `/exams` |
| منتدى تعليمي | `/forum` |
| ملفات دراسية | `/files` |
| مذكرات شخصية | `/notes` |
| اقتراحات | `/suggestions` |
| إحصائيات تفصيلية | `/stats` |
| لوحة أدمن (محمية) | `/admin` |

## بنية قاعدة البيانات

كل الجداول محمية بسياسات RLS:
- `profiles` - بيانات المستخدمين
- `user_roles` - الأدوار (admin/user) — منفصلة لمنع تصعيد الصلاحيات
- `posts`, `comments` - المنتدى
- `notes`, `suggestions` - شخصية
- `study_files` - ملفات (+ bucket تخزين)
- `exam_attempts` - محاولات الاختبارات
- `focus_sessions`, `user_streaks` - التركيز والسترك
- `quran_logs` - ورد القرآن
- `page_visits` - تتبّع الزيارات (للأدمن)

## الترخيص

استخدام شخصي — تم إنشاؤه عبر [Lovable](https://lovable.dev).
