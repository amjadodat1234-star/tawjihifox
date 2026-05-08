import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/use-role";
import { useTrackVisits } from "@/lib/track-visit";
import { Toaster } from "@/components/ui/sonner";
import { Timer, MessageSquare, LogOut, ShieldCheck, Home } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center card-soft p-10">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-3 text-muted-foreground">الصفحة غير موجودة</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">العودة للرئيسية</Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Focus — منصة التركيز والنقاش" },
      { name: "description", content: "منصة بسيطة للتركيز والنقاش: مؤقت احترافي ومنتدى مفتوح." },
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

function TopBar() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { location } = useRouterState();
  if (!user) return null;

  const links = [
    { to: "/", label: "الرئيسية", icon: Home },
    { to: "/focus", label: "المؤقت", icon: Timer },
    { to: "/forum", label: "المنتدى", icon: MessageSquare },
  ];

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 h-14">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="inline-block h-7 w-7 rounded-lg bg-primary text-primary-foreground grid place-items-center text-xs">F</span>
          <span>Focus</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link key={to} to={to} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link to="/admin" className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${location.pathname === "/admin" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">الأدمن</span>
            </Link>
          )}
          <button onClick={signOut} className="rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-secondary" aria-label="تسجيل الخروج">
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  const { loading } = useAuth();
  useTrackVisits();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="page-fade">
        <Outlet />
      </main>
    </div>
  );
}
