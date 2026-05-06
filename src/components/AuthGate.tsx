import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import bg from "@/assets/cabin-bg.jpg";

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

export function PageBackground({ children, dim = 0.55 }: { children: ReactNode; dim?: number }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <img src={bg} alt="" aria-hidden width={1920} height={1080} className="fixed inset-0 -z-10 h-full w-full object-cover" />
      <div className="fixed inset-0 -z-10" style={{ background: `linear-gradient(180deg, oklch(0.15 0.03 50 / ${dim}), oklch(0.12 0.02 40 / ${Math.min(dim + 0.2, 0.95)}))` }} />
      {children}
    </div>
  );
}
