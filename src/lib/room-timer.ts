export type TimerState = "idle" | "running" | "paused" | "break" | "finished";
export type TimerMode = "focus" | "break";

export interface RoomTimerRow {
  timer_state: TimerState | string;
  timer_mode: TimerMode | string;
  timer_ends_at: string | null;
  timer_paused_seconds_left: number | null;
  focus_duration_minutes: number;
  break_duration_minutes: number;
}

/** Seconds remaining for the given row, computed against `now` (server-authoritative via timer_ends_at). */
export function secondsLeft(row: RoomTimerRow, now: number = Date.now()): number {
  if (row.timer_state === "paused") return Math.max(0, row.timer_paused_seconds_left ?? 0);
  if (row.timer_state === "running" || row.timer_state === "break") {
    if (!row.timer_ends_at) return 0;
    return Math.max(0, Math.round((new Date(row.timer_ends_at).getTime() - now) / 1000));
  }
  if (row.timer_state === "idle") {
    return (row.timer_mode === "break" ? row.break_duration_minutes : row.focus_duration_minutes) * 60;
  }
  return 0;
}

export function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
