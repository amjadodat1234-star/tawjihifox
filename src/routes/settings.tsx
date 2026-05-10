import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Settings as SettingsIcon, LogOut, Camera, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: () => <AuthGate><Settings /></AuthGate> });

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

function Settings() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [nameUpdatedAt, setNameUpdatedAt] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url, name_updated_at").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setName(data.display_name || "");
        setOriginalName(data.display_name || "");
        setAvatar(data.avatar_url || null);
        setNameUpdatedAt(data.name_updated_at ? new Date(data.name_updated_at).getTime() : 0);
      }
    });
  }, [user]);

  const nameLockedUntil = nameUpdatedAt + TWO_WEEKS;
  const nameLocked = name !== originalName && Date.now() < nameLockedUntil;
  const daysLeft = Math.max(0, Math.ceil((nameLockedUntil - Date.now()) / (24 * 60 * 60 * 1000)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (name === originalName) return toast("لم تقم بأي تغيير");
    if (Date.now() < nameLockedUntil) return toast.error(`يمكنك تغيير الاسم بعد ${daysLeft} يوم`);
    setLoading(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("profiles").update({ display_name: name, name_updated_at: now }).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error("تعذّر الحفظ");
    setOriginalName(name);
    setNameUpdatedAt(Date.now());
    toast.success("تم حفظ الاسم");
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (f.size > 3 * 1024 * 1024) return toast.error("الحد الأقصى 3 ميجا");
    setUploading(true);
    try {
      const ext = f.name.split(".").pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("forum-media").upload(path, f, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("forum-media").getPublicUrl(path);
      const url = data.publicUrl;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      setAvatar(url);
      toast.success("تم تحديث الصورة");
    } catch (err: unknown) {
      console.error(err);
      toast.error("تعذّر رفع الصورة");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">الإعدادات</h1>
        </div>

        <div className="surface-card rounded-2xl p-6 mb-4 flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-3xl font-bold overflow-hidden border-4 border-background shadow-lg">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (name?.[0] || user?.email?.[0] || "?").toUpperCase()}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -left-1 rounded-full bg-primary text-primary-foreground w-9 h-9 flex items-center justify-center shadow-lg hover:scale-110 disabled:opacity-50"
              aria-label="تغيير الصورة"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">يمكنك تغيير الصورة في أي وقت</p>
        </div>

        <form onSubmit={save} className="surface-card rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">البريد الإلكتروني</label>
            <p className="mt-1">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground flex items-center gap-1">
              الاسم الظاهر
              {Date.now() < nameLockedUntil && <Lock className="h-3 w-3 text-amber-500" />}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="mt-1 w-full rounded-lg bg-card border border-border px-3 py-2 outline-none focus:border-primary"
            />
            {Date.now() < nameLockedUntil && name !== originalName && (
              <p className="text-xs text-amber-600 mt-1">يمكن تغيير الاسم بعد {daysLeft} يوم</p>
            )}
            {Date.now() >= nameLockedUntil && (
              <p className="text-xs text-muted-foreground mt-1">يمكن تغيير الاسم مرة كل أسبوعين</p>
            )}
          </div>
          <button disabled={loading || nameLocked || name === originalName} className="w-full rounded-full bg-primary text-primary-foreground py-2 font-bold disabled:opacity-50">
            {loading ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>

        <button onClick={signOut} className="mt-4 w-full surface-card rounded-2xl p-4 flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10">
          <LogOut className="h-5 w-5" /> تسجيل الخروج
        </button>
      </div>
    </PageBackground>
  );
}
