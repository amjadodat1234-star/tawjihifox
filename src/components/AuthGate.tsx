import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Lock } from "lucide-react";

/** Strict gate — redirects to /login if not authenticated. Use only for sensitive pages. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else setReady(true);
  }, [user, loading, navigate]);
  if (!ready) return null;
  return <>{children}</>;
}

/** Public wrapper — anyone can view. */
export function PublicView({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Soft prompt to log in for an action. */
export function LoginRequired({ message = "سجّل دخولك للمتابعة" }: { message?: string }) {
  const navigate = useNavigate();
  return (
    <div className="surface-card rounded-2xl p-6 text-center">
      <Lock className="mx-auto mb-3 h-8 w-8 text-primary" />
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      <button onClick={() => navigate({ to: "/login" })} className="rounded-full bg-primary text-primary-foreground px-6 py-2 text-sm font-bold hover:opacity-90">
        تسجيل الدخول
      </button>
    </div>
  );
}

/** Page wrapper with clean white background. */
export function PageBackground({ children }: { children: ReactNode; dim?: number }) {
  return <div className="relative min-h-screen">{children}</div>;
}
