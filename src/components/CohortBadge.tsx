import { useState } from "react";
import { useCohort, FIELDS, fieldName, type FieldId, type Generation } from "@/lib/cohort";
import { GraduationCap, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Cohort (generation + field) switcher shown in the top bar — core to the whole platform. */
export function CohortBadge() {
  const { generation, field, ready, setCohort } = useCohort();
  const [pendingGen, setPendingGen] = useState<Generation | null>(null);
  if (!ready) return null;

  const label = generation ? `جيل ${generation}${field ? ` · ${FIELDS.find((f) => f.id === field)?.short}` : ""}` : "اختر جيلك";

  return (
    <DropdownMenu onOpenChange={(o) => !o && setPendingGen(null)}>
      <DropdownMenuTrigger
        className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors outline-none ${
          generation
            ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
            : "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 pulse-soft"
        }`}
      >
        <GraduationCap className="h-3.5 w-3.5" />
        <span>{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">
          {pendingGen === "2009" ? "اختر حقلك الدراسي" : "اختر جيلك"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pendingGen !== "2009" ? (
          <>
            <DropdownMenuItem className="cursor-pointer" onSelect={(e) => { e.preventDefault(); setPendingGen("2009"); }}>
              <span className="font-bold">جيل 2009</span>
              <span className="mr-auto text-[11px] text-muted-foreground">4 حقول</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onSelect={() => setCohort("2010", null)}>
              <span className="font-bold">جيل 2010</span>
              {generation === "2010" && <Check className="mr-auto h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            {generation && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                  الحالي: جيل {generation}{field ? ` — ${fieldName(field)}` : " — المواد المشتركة"}
                </DropdownMenuLabel>
              </>
            )}
          </>
        ) : (
          FIELDS.map((f) => (
            <DropdownMenuItem key={f.id} className="cursor-pointer" onSelect={() => setCohort("2009", f.id as FieldId)}>
              <span>{f.name}</span>
              {generation === "2009" && field === f.id && <Check className="mr-auto h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
