import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/use-role";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CohortBadge } from "@/components/CohortBadge";

import { Brain, Clock, BookOpen, Sparkles, BarChart3, Settings, MessageSquare, LogOut, Menu, X, FileText, FolderOpen, GraduationCap, Trophy, Lightbulb, ShieldCheck, Home, LogIn, User, Wand2, Target, Radio } from "lucide-react";

const navGroups = [
  { label: "الدراسة والإنجاز", items: [
    { to: "/", label: "الرئيسية", icon: Home },
    { to: "/focus", label: "المهام والجلسات", icon: Brain },
    { to: "/progress", label: "تقدّمي", icon: BarChart3 },
    { to: "/exams", label: "الاختبارات", icon: GraduationCap },
    { to: "/plan", label: "خطة مذاكرتي", icon: Target },
    { to: "/tutor", label: "أستاذ فوكس", icon: Wand2 },
  ] },
  { label: "المجتمع", items: [
    { to: "/rooms", label: "غرف الدراسة", icon: Radio },
    { to: "/forum", label: "المنتدى", icon: MessageSquare },
    { to: "/leaderboard", label: "الترتيب", icon: Trophy },
  ] },
  { label: "روحانيات", items: [
    { to: "/prayer", label: "أوقات الصلاة", icon: Clock },
    { to: "/quran", label: "ورد القرآن", icon: BookOpen },
    { to: "/azkar", label: "الأذكار", icon: Sparkles },
  ] },
  { label: "شخصي", items: [
    { to: "/notes", label: "المذكرات", icon: FileText },
    { to: "/files", label: "ملفات الدراسة", icon: FolderOpen },
    { to: "/stats", label: "الإحصائيات", icon: BarChart3 },
    { to: "/suggestions", label: "اقتراحات", icon: Lightbulb },
    { to: "/settings", label: "الإعدادات", icon: Settings },
  ] },
] as const;


export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { location } = useRouterState();
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div key="ov" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm" />
        )}
      </AnimatePresence>
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border elev-shadow transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/25">
              <Brain className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-gradient-primary leading-tight">توجيهي فوكس</h2>
              <p className="text-[10px] text-muted-foreground">منصة تعليمية ذكية</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
          {navGroups.map((group, gi) => (
            <motion.div key={group.label} initial={false}
              animate={open ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
              transition={{ duration: 0.35, delay: open ? gi * 0.06 : 0, ease: [0.2, 0.8, 0.2, 1] }}>
              <p className="px-4 mb-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to;
                  return (
                    <Link key={to} to={to} onClick={onClose}
                      className={`group flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-all hover:-translate-x-1 ${active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
                      <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${active ? "text-primary" : ""}`} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          ))}
          {isAdmin && (
            <div>
              <p className="px-4 mb-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">الإدارة</p>
              <Link to="/admin" onClick={onClose} className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-all hover:-translate-x-1 ${location.pathname === "/admin" ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
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
    <Link to="/focus" className="pulse-soft hidden sm:flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold border border-primary/20 hover:bg-primary/15">
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
    return (
      <Link to="/login" className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/30 hover:opacity-90">
        دخول
      </Link>
    );
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

const quickLinks = [
  { to: "/tutor", label: "أستاذ فوكس" },
  { to: "/plan", label: "خطة مذاكرتي" },
  { to: "/focus", label: "تايمر الإنجاز" },
  { to: "/forum", label: "المنتدى" },
  { to: "/exams", label: "الاختبارات" },
] as const;

export function TopBar({ onOpenSidebar, open }: { onOpenSidebar: () => void; open: boolean }) {
  const { location } = useRouterState();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className={`sticky top-0 z-30 glass-strong transition-all duration-300 ${scrolled ? "border-b border-border shadow-[0_6px_24px_-16px_rgba(15,23,42,.45)]" : "border-b border-transparent"}`}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] gradient-anim opacity-70" />

      <div className={`mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 transition-all duration-300 ${scrolled ? "py-2" : "py-3.5"}`}>
        <div className="flex items-center gap-2">
          <button onClick={onOpenSidebar} className="rounded-xl p-2 hover:bg-secondary transition-colors" aria-label="فتح القائمة">
            <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="block">
              <Menu className="h-5 w-5" />
            </motion.span>
          </button>

          <Link to="/" className="group flex items-center gap-2">
            <motion.span whileHover={{ rotate: -8, scale: 1.08 }} transition={{ type: "spring", stiffness: 320, damping: 14 }}
              className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/25">
              <Brain className="h-4 w-4" />
            </motion.span>
            <span className="flex flex-col leading-none">
              <span className="text-base font-extrabold text-gradient-primary">توجيهي فوكس</span>
              <span className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">منصة تعليمية ذكية</span>
            </span>
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {quickLinks.map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link key={l.to} to={l.to} className="relative rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors">
                {active && (
                  <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-primary/10 ring-1 ring-primary/20" />
                )}
                <span className={`relative ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <CohortBadge />
          <ActiveTaskBadge />
          <UserMenu />
        </div>

      </div>
    </motion.header>
  );
}

export function PageTransition({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={routeKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
