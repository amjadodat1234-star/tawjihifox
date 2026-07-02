import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/use-role";
import { useTrackVisits } from "@/lib/track-visit";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Brain, Clock, BookOpen, Sparkles, BarChart3, Settings, MessageSquare, LogOut, Menu, X, FileText, FolderOpen, GraduationCap, Trophy, Lightbulb, ShieldCheck, Home, LogIn, User, Search, Command as CommandIcon, Ghost, ArrowRight } from "lucide-react";
import { ScrollProgress } from "@/components/ScrollProgress";
import { CursorGlow } from "@/components/CursorGlow";
import { CommandPalette } from "@/components/CommandPalette";
import { PageTransition } from "@/components/PageTransition";
import { StreakChip } from "@/components/StreakChip";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 aurora-bg">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 15 }}
        className="max-w-md text-center surface-card rounded-3xl p-10 spotlight"
      >
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="mx-auto mb-4 inline-block">
          <Ghost className="h-16 w-16 text-primary" />
        </motion.div>
        <h1 className="text-8xl font-extrabold text-gradient-primary tracking-tight">404</h1>
        <h2 className="mt-2 text-xl font-semibold">ضعنا في الطريق قليلاً</h2>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة يلي بتدور عليها مش موجودة، لكن في مليون طريق ثاني.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full gradient-anim px-6 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 shadow-lg">
          العودة للرئيسية <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
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

function ActiveTaskBadge() {
  const [remaining, setRemaining] = useState<{ name: string; secs: number } | null>(null);
  useEffect(() => {
    const tick = () => {
      try {
        const raw = localStorage.getItem("activeTask");
        if (!raw) return setRemaining(null);
        const t = JSON.parse(raw) as { name: string; endsAt: number };
        const secs = Math.max(0, Math.floor((t.endsAt - Date.now()) / 1000));
        if (secs <= 0) { localStorage.removeItem("activeTask"); return setRemaining(null); }
        setRemaining({ name: t.name, secs });
      } catch { setRemaining(null); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!remaining) return null;
  const m = String(Math.floor(remaining.secs / 60)).padStart(2, "0");
  const s = String(remaining.secs % 60).padStart(2, "0");
  return (
    <Link to="/focus" className="hidden sm:flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold border border-primary/20 hover:bg-primary/15">
      <Clock className="h-3.5 w-3.5" />
      <span className="tabular-nums">{m}:{s}</span>
      <span className="max-w-[100px] truncate">{remaining.name}</span>
    </Link>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
    const ch = supabase.channel(`profile-${user.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, (p) => {
      const r = p.new as { display_name: string | null; avatar_url: string | null };
      setProfile({ display_name: r.display_name, avatar_url: r.avatar_url });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);
  if (!user) {
    return <Link to="/login" className="text-xs font-bold text-primary hover:underline">دخول</Link>;
  }
  const initial = (profile?.display_name?.[0] || user.email?.[0] || "?").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full ring-2 ring-transparent hover:ring-primary/40 transition-all outline-none focus:ring-primary/60">
        <Avatar className="h-9 w-9">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-bold text-sm truncate">{profile?.display_name || "مستخدم"}</span>
          <span className="text-[11px] text-muted-foreground font-normal truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/settings" className="cursor-pointer"><User className="h-4 w-4 ml-2" />الإعدادات</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/stats" className="cursor-pointer"><BarChart3 className="h-4 w-4 ml-2" />إحصائياتي</Link></DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild><Link to="/admin" className="cursor-pointer text-primary"><ShieldCheck className="h-4 w-4 ml-2" />لوحة الأدمن</Link></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 ml-2" />تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CommandTrigger() {
  const fire = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  return (
    <button
      onClick={fire}
      className="hidden md:flex items-center gap-2 rounded-full bg-secondary/70 hover:bg-secondary text-muted-foreground px-3 py-1.5 text-xs border border-border transition"
      aria-label="بحث سريع"
    >
      <Search className="h-3.5 w-3.5" />
      <span>بحث سريع…</span>
      <kbd className="ml-1 rounded bg-background border border-border px-1.5 py-0.5 text-[10px] font-mono">Ctrl K</kbd>
    </button>
  );
}

function TopBar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 gap-2">
        <button onClick={onOpenSidebar} className="rounded-lg p-2 hover:bg-secondary transition-colors" aria-label="فتح القائمة">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="text-lg font-extrabold text-gradient-primary flex items-center gap-2">
          <motion.span animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 6, repeat: Infinity }}>
            <GraduationCap className="h-5 w-5" />
          </motion.span>
          توجيهي فوكس
        </Link>
        <div className="flex items-center gap-2">
          <CommandTrigger />
          <StreakChip />
          <ActiveTaskBadge />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function RootComponent() {
  const { loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { location } = useRouterState();
  useTrackVisits();
  useEffect(() => { setSidebarOpen(false); }, []);
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent"
        />
      </div>
    );
  }
  const hideTopBar = location.pathname === "/focus";
  return (
    <div className="min-h-screen">
      <ScrollProgress />
      <CursorGlow />
      <CommandPalette />
      {!hideTopBar && <TopBar onOpenSidebar={() => setSidebarOpen(true)} />}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main>
        <PageTransition><Outlet /></PageTransition>
      </main>
    </div>
  );
}

