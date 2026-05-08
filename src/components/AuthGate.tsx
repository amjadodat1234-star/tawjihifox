import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);
  if (loading || !user) return null;
  return <>{children}</>;
}

export function PageBackground({ children }: { children: ReactNode; dim?: number }) {
  return <div className="min-h-[calc(100vh-3.5rem)] bg-background">{children}</div>;
}
