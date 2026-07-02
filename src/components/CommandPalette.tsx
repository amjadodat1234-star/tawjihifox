import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { Brain, Clock, BookOpen, Sparkles, BarChart3, Settings, MessageSquare, FileText, FolderOpen, GraduationCap, Trophy, Lightbulb, ShieldCheck, Home, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/use-role";

type Cmd = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; group: string; keywords?: string };

const cmds: Cmd[] = [
  { to: "/", label: "الصفحة الرئيسية", icon: Home, group: "التنقل", keywords: "home welcome" },
  { to: "/focus", label: "تايمر الإنجاز", icon: Brain, group: "الدراسة", keywords: "timer pomodoro focus" },
  { to: "/exams", label: "الاختبارات", icon: GraduationCap, group: "الدراسة", keywords: "quiz exam" },
  { to: "/files", label: "ملفات الدراسة", icon: FolderOpen, group: "الدراسة", keywords: "files pdf" },
  { to: "/notes", label: "المذكرات", icon: FileText, group: "شخصي", keywords: "notes memo" },
  { to: "/forum", label: "المنتدى", icon: MessageSquare, group: "المجتمع", keywords: "forum posts" },
  { to: "/leaderboard", label: "المتصدرون", icon: Trophy, group: "المجتمع", keywords: "leaderboard rank" },
  { to: "/prayer", label: "أوقات الصلاة", icon: Clock, group: "روحانيات", keywords: "prayer salah" },
  { to: "/quran", label: "ورد القرآن", icon: BookOpen, group: "روحانيات", keywords: "quran" },
  { to: "/azkar", label: "الأذكار", icon: Sparkles, group: "روحانيات", keywords: "athkar" },
  { to: "/stats", label: "إحصائياتي", icon: BarChart3, group: "شخصي", keywords: "stats analytics" },
  { to: "/suggestions", label: "اقتراحات", icon: Lightbulb, group: "شخصي", keywords: "suggestions" },
  { to: "/settings", label: "الإعدادات", icon: Settings, group: "شخصي", keywords: "settings profile" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => { setOpen(false); navigate({ to }); };
  const groups = Array.from(new Set(cmds.map((c) => c.group)));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="اكتب للبحث عن صفحة أو أمر…" />
      <CommandList>
        <CommandEmpty>لا توجد نتائج.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {cmds.filter((c) => c.group === g).map((c) => (
              <CommandItem key={c.to} value={`${c.label} ${c.keywords || ""}`} onSelect={() => go(c.to)}>
                <c.icon className="ml-2 h-4 w-4" />
                <span>{c.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="الإدارة">
              <CommandItem value="admin dashboard إدارة" onSelect={() => go("/admin")}>
                <ShieldCheck className="ml-2 h-4 w-4" /><span>لوحة الأدمن</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="الحساب">
          {user ? (
            <>
              <CommandItem value="profile ملف شخصي" onSelect={() => go("/settings")}>
                <User className="ml-2 h-4 w-4" /><span>الملف الشخصي</span>
              </CommandItem>
              <CommandItem value="logout signout" onSelect={() => { setOpen(false); signOut(); }} className="text-destructive">
                <LogOut className="ml-2 h-4 w-4" /><span>تسجيل الخروج</span>
              </CommandItem>
            </>
          ) : (
            <CommandItem value="login signin" onSelect={() => go("/login")}>
              <User className="ml-2 h-4 w-4" /><span>تسجيل الدخول</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>تنقّل سريع في كل المنصة</span>
        <span className="flex items-center gap-1">
          <CommandShortcut>Ctrl</CommandShortcut>+<CommandShortcut>K</CommandShortcut>
        </span>
      </div>
    </CommandDialog>
  );
}
