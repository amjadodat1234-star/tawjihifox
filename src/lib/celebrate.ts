import confetti from "canvas-confetti";

const colors = ["#14b8a6", "#f59e0b", "#8b5cf6", "#ec4899", "#22d3ee"];

export function celebrate(intensity: "sm" | "md" | "lg" = "md") {
  const counts = { sm: 40, md: 100, lg: 180 } as const;
  const count = counts[intensity];
  confetti({
    particleCount: count,
    spread: 80,
    origin: { y: 0.7 },
    colors,
    scalar: 0.9,
    disableForReducedMotion: true,
  });
}

export function fireworks(duration = 2000) {
  const end = Date.now() + duration;
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
