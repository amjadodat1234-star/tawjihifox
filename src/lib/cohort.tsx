import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Generation = "2009" | "2010";
export type FieldId = "health" | "stem" | "humanities" | "business";

export const FIELDS: { id: FieldId; name: string; short: string }[] = [
  { id: "health", name: "الحقل الصحي", short: "صحي" },
  { id: "stem", name: "حقل العلوم والتكنولوجيا والهندسة", short: "علوم وتكنولوجيا" },
  { id: "humanities", name: "حقل العلوم الإنسانية والاجتماعية", short: "إنساني" },
  { id: "business", name: "حقل الأعمال", short: "أعمال" },
];

export interface Subject { id: string; name: string }

/** Subject banks that already have questions ready. */
export const READY_SUBJECTS = new Set(["religion", "arabic", "english", "history"]);

const COMMON: Subject[] = [
  { id: "religion", name: "التربية الإسلامية" },
  { id: "arabic", name: "اللغة العربية" },
  { id: "english", name: "اللغة الإنجليزية" },
  { id: "history", name: "تاريخ الأردن" },
];

const FIELD_SUBJECTS: Record<FieldId, Subject[]> = {
  health: [
    { id: "biology", name: "الأحياء" },
    { id: "chemistry", name: "الكيمياء" },
    { id: "physics", name: "الفيزياء" },
  ],
  stem: [
    { id: "math", name: "الرياضيات" },
    { id: "physics", name: "الفيزياء" },
    { id: "chemistry", name: "الكيمياء" },
    { id: "cs", name: "علوم الحاسوب" },
  ],
  humanities: [
    { id: "geography", name: "الجغرافيا" },
    { id: "philosophy", name: "الفلسفة وعلم النفس" },
    { id: "islamic", name: "العلوم الإسلامية" },
  ],
  business: [
    { id: "economy", name: "الاقتصاد" },
    { id: "accounting", name: "المحاسبة" },
    { id: "management", name: "إدارة الأعمال" },
  ],
};

export function subjectsFor(generation: Generation | null, field: FieldId | null): Subject[] {
  if (!generation) return [];
  if (generation === "2010") return COMMON;
  return [...COMMON, ...(field ? FIELD_SUBJECTS[field] : [])];
}

export function fieldName(field: FieldId | null) {
  return FIELDS.find((f) => f.id === field)?.name ?? null;
}

/** Is this subject part of the student's own track? */
export function isSubjectAllowed(generation: Generation | null, field: FieldId | null, subjectId: string) {
  return subjectsFor(generation, field).some((s) => s.id === subjectId);
}

export function subjectName(subjectId: string) {
  const all = [...COMMON, ...Object.values(FIELD_SUBJECTS).flat()];
  return all.find((s) => s.id === subjectId)?.name ?? subjectId;
}


/** Forum sections: one shared community + specialised sections. */
export function forumSections(generation: Generation | null, field: FieldId | null) {
  const base = [{ id: "general", name: "النقاش العام" }];
  if (generation === "2010") return [...base, { id: "gen2010", name: "قسم جيل 2010" }];
  if (generation === "2009" && field) {
    return [...base, { id: `f_${field}`, name: FIELDS.find((f) => f.id === field)!.short }];
  }
  return base;
}

interface CohortValue {
  generation: Generation | null;
  field: FieldId | null;
  ready: boolean;
  setCohort: (g: Generation, f: FieldId | null) => void;
  reset: () => void;
}

const Ctx = createContext<CohortValue | undefined>(undefined);
const KEY = "cohort";

export function CohortProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [field, setField] = useState<FieldId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw) as { generation: Generation; field: FieldId | null };
        setGeneration(v.generation ?? null);
        setField(v.field ?? null);
      }
    } catch { /* noop */ }
    setReady(true);
  }, []);

  // Pull from profile when signed in and nothing chosen locally
  useEffect(() => {
    if (!user || !ready || generation) return;
    supabase.from("profiles").select("generation, field").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.generation) {
        setGeneration(data.generation as Generation);
        setField((data.field as FieldId) ?? null);
        localStorage.setItem(KEY, JSON.stringify({ generation: data.generation, field: data.field ?? null }));
      }
    });
  }, [user, ready, generation]);

  const setCohort = (g: Generation, f: FieldId | null) => {
    setGeneration(g);
    setField(f);
    localStorage.setItem(KEY, JSON.stringify({ generation: g, field: f }));
    if (user) supabase.from("profiles").update({ generation: g, field: f }).eq("id", user.id).then(() => {});
  };

  const reset = () => {
    setGeneration(null);
    setField(null);
    localStorage.removeItem(KEY);
  };

  return <Ctx.Provider value={{ generation, field, ready, setCohort, reset }}>{children}</Ctx.Provider>;
}

export function useCohort() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCohort must be used within CohortProvider");
  return ctx;
}
