import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthGate, PageBackground } from "@/components/AuthGate";
import { Sparkles, Sun, Moon, Heart } from "lucide-react";

export const Route = createFileRoute("/azkar")({ component: () => <AuthGate><Azkar /></AuthGate> });

const CATEGORIES = {
  morning: { label: "أذكار الصباح", icon: Sun, items: [
    "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ",
    "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ",
    "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ",
    "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ — (7 مرات)",
    "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ — (3 مرات)",
  ]},
  evening: { label: "أذكار المساء", icon: Moon, items: [
    "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ",
    "اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ",
    "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ — (3 مرات)",
    "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي",
  ]},
  general: { label: "أذكار عامة", icon: Heart, items: [
    "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
    "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ",
    "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّد",
    "أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ",
  ]},
} as const;

function Azkar() {
  const [tab, setTab] = useState<keyof typeof CATEGORIES>("morning");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const cat = CATEGORIES[tab];
  const Icon = cat.icon;

  return (
    <PageBackground dim={0.65}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gradient-warm">الأذكار</h1>
        </div>

        <div className="glass-strong rounded-full p-1 flex mb-6">
          {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full py-2 text-sm transition-all ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {CATEGORIES[k].label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {cat.items.map((text, i) => {
            const key = `${tab}-${i}`;
            const c = counts[key] || 0;
            return (
              <button key={i} onClick={() => setCounts((p) => ({ ...p, [key]: (p[key] || 0) + 1 }))}
                className="w-full glass rounded-2xl p-5 text-right hover:bg-secondary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <p className="leading-relaxed flex-1">{text}</p>
                  <div className="shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{c}</div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 flex items-center justify-center gap-1">
          <Icon className="h-3 w-3" /> اضغط على الذكر لزيادة العدّاد
        </p>
      </div>
    </PageBackground>
  );
}
