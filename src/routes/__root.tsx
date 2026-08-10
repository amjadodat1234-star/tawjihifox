import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { CohortProvider } from "@/lib/cohort";

import { useTrackVisits } from "@/lib/track-visit";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar, TopBar, PageTransition } from "@/components/AppChrome";

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
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" },
    ],
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
          <CohortProvider>
            {children}
            <Toaster />
          </CohortProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { location } = useRouterState();
  useTrackVisits();
  useEffect(() => { setSidebarOpen(false); }, []);
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  const hideTopBar = location.pathname === "/focus";
  return (
    <div className="min-h-screen">
      {!hideTopBar && <TopBar open={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} />}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main>
        <PageTransition routeKey={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
