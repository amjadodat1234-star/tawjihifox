import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Settings as SettingsIcon, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: () => <AuthGate><Settings /></AuthGate> });

function Settings() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setName(data.display_name || "");
    });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    setLoading(false);
    if (error) toast.error("تعذّر الحفظ"); else toast.success("تم الحفظ");
  };

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">الإعدادات</h1>
        </div>

        <form onSubmit={save} className="glass-strong rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">البريد الإلكتروني</label>
            <p className="mt-1">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">الاسم الظاهر</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg glass px-3 py-2 outline-none" />
          </div>
          <button disabled={loading} className="w-full rounded-full bg-primary text-primary-foreground py-2 disabled:opacity-50">حفظ</button>
        </form>

        <button onClick={signOut} className="mt-4 w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10">
          <LogOut className="h-5 w-5" /> تسجيل الخروج
        </button>
      </div>
    </PageBackground>
  );
}
