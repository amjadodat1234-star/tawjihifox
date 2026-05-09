import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/use-role";
import { useTrackVisits } from "@/lib/track-visit";
import { Toaster } from "@/components/ui/sonner";
import { Brain, Clock, BookOpen, Sparkles, BarChart3, Settings, MessageSquare, LogOut, Menu, X, FileText, FolderOpen, GraduationCap, Trophy, Lightbulb, ShieldCheck, Home, LogIn } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center surface-card rounded-2xl p-10">
        <h1 className="text-7xl font-extrabold text-gradient-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">العودة للرئيسية</Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "توجيهي فوكس — منصة تعليمية ذكية" },
      { name: "description", content: "منصة طلاب التوجيهي: تايمر إنجاز، اختبارات، منتدى تفاعلي، قرآن، أذكار، وأكثر." },
      { property: "og:title", content: "توجيهي فوكس" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

const navGroups = [
  { label: "الرئيسية", items: [
    { to: "/", label: "الترحيب", icon: Home },
    { to: "/focus", label: "تايمر الإنجاز", icon: Brain },
    { to: "/forum", label: "المنتدى", icon: MessageSquare },
    { to: "/leaderboard", label: "المتصدرون", icon: Trophy },
  ] },
  { label: "روحانيات", items: [
    { to: "/prayer", label: "أوقات الصلاة", icon: Clock },
    { to: "/quran", label: "ورد القرآن", icon: BookOpen },
    { to: "/azkar", label: "الأذكار", icon: Sparkles },
  ] },
  { label: "الدراسة", items: [
    { to: "/exams", label: "الاختبارات", icon: GraduationCap },
    { to: "/files", label: "ملفات الدراسة", icon: FolderOpen },
  ] },
  { label: "شخصي", items: [
    { to: "/notes", label: "المذكرات", icon: FileText },
    { to: "/stats", label: "الإحصائيات", icon: BarChart3 },
    { to: "/suggestions", label: "اقتراحات", icon: Lightbulb },
    { to: "/settings", label: "الإعدادات", icon: Settings },
  ] },
] as const;

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { location } = useRouterState();
  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm" />}
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border elev-shadow transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-sidebar-border">
          <div>
            <h1 className="text-xl font-extrabold text-gradient-primary">توجيهي فوكس</h1>
            <p className="mt-0.5 text-[10px] text-muted-foreground">منصة تعليمية ذكية</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-4 mb-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to;
                  return (
                    <Link key={to} to={to} onClick={onClose} className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-all ${active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {isAdmin && (
            <div>
              <p className="px-4 mb-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">الإدارة</p>
              <Link to="/admin" onClick={onClose} className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm ${location.pathname === "/admin" ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
                <ShieldCheck className="h-4 w-4" />
                <span>لوحة الأدمن</span>
              </Link>
            </div>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          {user ? (
            <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="h-4 w-4" /><span>تسجيل الخروج</span>
            </button>
          ) : (
            <Link to="/login" onClick={onClose} className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm bg-primary text-primary-foreground hover:opacity-90 transition justify-center font-bold">
              <LogIn className="h-4 w-4" /><span>تسجيل الدخول</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

function TopBar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onOpenSidebar} className="rounded-lg p-2 hover:bg-secondary transition-colors" aria-label="فتح القائمة">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="text-lg font-extrabold text-gradient-primary">توجيهي فوكس</Link>
        {user ? (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold">
            {(user.email?.[0] || "?").toUpperCase()}
          </div>
        ) : (
          <Link to="/login" className="text-xs font-bold text-primary hover:underline">دخول</Link>
        )}
      </div>
    </header>
  );
}

function RootComponent() {
  const { loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useTrackVisits();
  useEffect(() => { setSidebarOpen(false); }, []);
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  return (
    <div className="min-h-screen">
      <TopBar onOpenSidebar={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main><Outlet /></main>
    </div>
  );
}
