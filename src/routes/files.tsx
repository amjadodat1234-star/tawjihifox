import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FolderOpen, Upload, Trash2, Download, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/files")({ component: () => <AuthGate><Files /></AuthGate> });

interface FileRow { id: string; user_id: string; title: string; description: string | null; subject: string; file_path: string; file_size: number | null; created_at: string }

const SUBJECTS = ["religion", "arabic", "english", "history", "other"];
const SUB_LABEL: Record<string, string> = { religion: "دين", arabic: "عربي", english: "إنجليزي", history: "تاريخ", other: "أخرى" };

function Files() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("religion");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("study_files").select("*").order("created_at", { ascending: false });
    if (data) {
      setFiles(data as FileRow[]);
      const ids = [...new Set(data.map((f) => f.user_id))];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
        const map: Record<string, string> = {};
        profs?.forEach((p) => { map[p.id] = p.display_name || "مستخدم"; });
        setProfiles(map);
      }
    }
  };
  useEffect(() => { load(); }, []);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!title) return toast.error("أدخل عنواناً للملف أولاً");
    if (file.size > 20 * 1024 * 1024) return toast.error("الحد الأقصى 20MB");
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("study-files").upload(path, file);
    if (upErr) { setUploading(false); return toast.error("فشل الرفع"); }
    const { error } = await supabase.from("study_files").insert({ user_id: user.id, title, subject, file_path: path, file_size: file.size });
    setUploading(false);
    if (error) return toast.error("فشل الحفظ");
    toast.success("تم الرفع!");
    setTitle(""); if (inputRef.current) inputRef.current.value = "";
    load();
  };

  const del = async (f: FileRow) => {
    if (!confirm("حذف الملف؟")) return;
    await supabase.storage.from("study-files").remove([f.file_path]);
    await supabase.from("study_files").delete().eq("id", f.id);
    load();
  };

  const getUrl = (path: string) => supabase.storage.from("study-files").getPublicUrl(path).data.publicUrl;
  const filtered = filter === "all" ? files : files.filter((f) => f.subject === filter);

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">ملفات الدراسة</h1>
        </div>
        <p className="text-muted-foreground mb-6">شارك ملخصاتك وحمّل ملفات زملائك</p>

        <div className="glass-strong rounded-2xl p-5 mb-6">
          <h2 className="font-bold mb-3">رفع ملف جديد</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الملف (مثل: ملخص الفصل 3)" className="w-full rounded-lg bg-secondary/50 px-4 py-2 mb-2 outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex gap-2 flex-wrap mb-3">
            {SUBJECTS.map((s) => (
              <button key={s} onClick={() => setSubject(s)} className={`rounded-full px-4 py-1.5 text-xs ${subject === s ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{SUB_LABEL[s]}</button>
            ))}
          </div>
          <input ref={inputRef} type="file" onChange={upload} disabled={uploading || !title} className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gradient-to-r file:from-primary file:to-accent file:text-primary-foreground file:font-bold file:cursor-pointer" />
          {uploading && <p className="text-xs text-muted-foreground mt-2">جارٍ الرفع...</p>}
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setFilter("all")} className={`rounded-full px-4 py-1.5 text-xs ${filter === "all" ? "bg-primary text-primary-foreground" : "glass-strong"}`}>الكل</button>
          {SUBJECTS.map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-4 py-1.5 text-xs ${filter === s ? "bg-primary text-primary-foreground" : "glass-strong"}`}>{SUB_LABEL[s]}</button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد ملفات بعد</p>}
          {filtered.map((f) => (
            <div key={f.id} className="glass-strong rounded-xl p-4 flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{f.title}</p>
                <p className="text-xs text-muted-foreground">{SUB_LABEL[f.subject]} · {profiles[f.user_id] || "مستخدم"} · {f.file_size ? `${(f.file_size / 1024).toFixed(0)} KB` : ""}</p>
              </div>
              <a href={getUrl(f.file_path)} target="_blank" rel="noreferrer" download className="rounded-full bg-primary/15 text-primary p-2 hover:bg-primary/25"><Download className="h-4 w-4" /></a>
              {f.user_id === user?.id && <button onClick={() => del(f)} className="text-muted-foreground hover:text-destructive p-2"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
