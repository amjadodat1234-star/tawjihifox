// Server-authoritative timer helpers for study rooms.
// The DB is the single source of truth (timer_state, timer_ends_at, timer_paused_seconds_left).

export type TimerState = "idle" | "running" | "paused" | "break" | "finished";
export type TimerMode = "focus" | "break";

export interface RoomTimer {
  timer_state: TimerState;
  timer_mode: TimerMode;
  timer_ends_at: string | null;
  timer_paused_seconds_left: number | null;
  focus_duration_minutes: number;
  break_duration_minutes: number;
}

/** Computes remaining seconds right now for the room's timer. */
export function computeRemaining(r: RoomTimer, now: number = Date.now()): number {
  if (r.timer_state === "running" || r.timer_state === "break") {
    if (!r.timer_ends_at) return 0;
    return Math.max(0, Math.floor((new Date(r.timer_ends_at).getTime() - now) / 1000));
  }
  if (r.timer_state === "paused") return Math.max(0, r.timer_paused_seconds_left ?? 0);
  if (r.timer_state === "finished") return 0;
  return r.focus_duration_minutes * 60;
}

export function totalSecondsForPhase(r: RoomTimer): number {
  if (r.timer_state === "break" || (r.timer_state === "paused" && r.timer_mode === "break"))
    return r.break_duration_minutes * 60;
  return r.focus_duration_minutes * 60;
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
