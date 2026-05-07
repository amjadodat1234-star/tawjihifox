import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { Clock, MapPin } from "lucide-react";

export const Route = createFileRoute("/prayer")({ component: () => <AuthGate><Prayer /></AuthGate> });

interface Times { Fajr: string; Sunrise: string; Dhuhr: string; Asr: string; Maghrib: string; Isha: string; }
const NAMES_AR: Record<string, string> = { Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };

function Prayer() {
  const [times, setTimes] = useState<Times | null>(null);
  const [city, setCity] = useState("Amman");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Jordan&method=2`);
        const j = await r.json();
        setTimes(j.data.timings);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [city]);

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">أوقات الصلاة</h1>
        </div>

        <div className="glass-strong rounded-2xl p-4 mb-6 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <select value={city} onChange={(e) => setCity(e.target.value)} className="bg-transparent outline-none flex-1">
            {["Amman", "Irbid", "Zarqa", "Aqaba", "Mafraq", "Karak", "Jerash"].map((c) => <option key={c} value={c} className="bg-card">{c}</option>)}
          </select>
        </div>

        {loading && <p className="text-center text-muted-foreground">جارِ التحميل...</p>}
        {times && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(NAMES_AR) as (keyof Times)[]).map((k) => (
              <div key={k} className="glass rounded-2xl p-5 flex items-center justify-between">
                <span className="font-semibold">{NAMES_AR[k]}</span>
                <span className="text-xl font-mono text-primary">{times[k]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageBackground>
  );
}
