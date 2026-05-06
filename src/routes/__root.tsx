import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { Brain, Clock, BookOpen, Sparkles, Activity, ListTodo, BarChart3, Settings, MessageCircle, LogOut } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass-strong rounded-2xl p-10">
        <h1 className="text-7xl font-bold text-gradient-warm">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">العودة للرئيسية</Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "توجيهي فوكس — رفيقك نحو النجاح" },
      { name: "description", content: "تطبيق التركيز والإنتاجية لطلاب التوجيهي: مؤقت، أوقات الصلاة، ورد القرآن، أذكار، عادات، مهام، إحصائيات ودردشة." },
      { property: "og:title", content: "توجيهي فوكس — رفيقك نحو النجاح" },
      { name: "twitter:title", content: "توجيهي فوكس — رفيقك نحو النجاح" },
      { property: "og:description", content: "تطبيق التركيز والإنتاجية لطلاب التوجيهي: مؤقت، أوقات الصلاة، ورد القرآن، أذكار، عادات، مهام، إحصائيات ودردشة." },
      { name: "twitter:description", content: "تطبيق التركيز والإنتاجية لطلاب التوجيهي: مؤقت، أوقات الصلاة، ورد القرآن، أذكار، عادات، مهام، إحصائيات ودردشة." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/afd6a6b6-7b26-4928-ae5f-3f14c6df9d4e/id-preview-b7e6ee90--e1ddbad9-adcd-480d-bb26-6d352cb9043f.lovable.app-1778058865220.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/afd6a6b6-7b26-4928-ae5f-3f14c6df9d4e/id-preview-b7e6ee90--e1ddbad9-adcd-480d-bb26-6d352cb9043f.lovable.app-1778058865220.png" },
      { name: "twitter:card", content: "summary_large_image" },
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

const navItems = [
  { to: "/", label: "التركيز", icon: Brain },
  { to: "/prayer", label: "أوقات الصلاة", icon: Clock },
  { to: "/quran", label: "ورد القرآن", icon: BookOpen },
  { to: "/azkar", label: "الأذكار", icon: Sparkles },
  { to: "/habits", label: "العادات", icon: Activity },
  { to: "/tasks", label: "المهام", icon: ListTodo },
  { to: "/stats", label: "الإحصائيات", icon: BarChart3 },
  { to: "/chat", label: "الدردشة", icon: MessageCircle },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

function Sidebar() {
  const { user, signOut } = useAuth();
  const { location } = useRouterState();
  if (!user) return null;
  return (
    <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col glass-strong md:flex">
      <div className="px-6 py-7 border-b border-border">
        <h1 className="text-2xl font-bold text-gradient-warm">توجيهي فوكس</h1>
        <p className="mt-1 text-xs text-muted-foreground">رفيقك نحو النجاح</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to} className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="h-4 w-4" />
          <span>تسجيل الخروج</span>
        </button>
        <p className="mt-3 text-center text-[10px] text-muted-foreground">نسخة 1.0.0</p>
      </div>
    </aside>
  );
}

function MobileNav() {
  const { user } = useAuth();
  const { location } = useRouterState();
  if (!user) return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-border md:hidden">
      <div className="flex justify-around py-2 overflow-x-auto">
        {navItems.slice(0, 6).map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to} className={`flex flex-col items-center gap-1 px-2 py-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function RootComponent() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className={user ? "md:mr-64 pb-20 md:pb-0" : ""}>
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
