import { slaHours } from "./shape";

export type BusinessHourRow = {
  dayOfWeek: number;
  isWorkingDay: boolean;
  openTime: string;
  closeTime: string;
  timezone: string;
};

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseClock(value: string): number {
  const [h, m] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

export function zonedClock(ms: number, timeZone: string): { dayOfWeek: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(ms)).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  const dayOfWeek = WEEKDAY[parts.weekday ?? "Sun"] ?? 0;
  const minutes = Number(parts.hour ?? "0") * 60 + Number(parts.minute ?? "0");
  return { dayOfWeek, minutes };
}

function hoursForDay(hours: BusinessHourRow[], dayOfWeek: number): BusinessHourRow | null {
  return hours.find((h) => h.dayOfWeek === dayOfWeek) ?? null;
}

/**
 * Count SLA minutes only during configured working hours.
 * Falls back to wall-clock hours when no working days are set.
 */
export function slaDeadlineMs(
  nowMs: number,
  priority: string,
  hours: BusinessHourRow[],
): number {
  const needed = slaHours(priority) * 60;
  const working = hours.filter((h) => h.isWorkingDay);
  if (working.length === 0) {
    return nowMs + needed * 60_000;
  }
  const timeZone = working[0]?.timezone || "UTC";
  let remaining = needed;
  let cursor = nowMs;
  const max = nowMs + 21 * 24 * 60 * 60_000;
  while (remaining > 0 && cursor < max) {
    const clock = zonedClock(cursor, timeZone);
    const day = hoursForDay(hours, clock.dayOfWeek);
    if (!day || !day.isWorkingDay) {
      cursor += 60_000;
      continue;
    }
    const open = parseClock(day.openTime);
    const close = parseClock(day.closeTime);
    if (clock.minutes < open || clock.minutes >= close) {
      cursor += 60_000;
      continue;
    }
    remaining -= 1;
    cursor += 60_000;
  }
  return cursor;
}

export function slaBreached(args: {
  nowMs: number;
  slaDeadline?: number;
  status: string;
  resolvedAt?: number;
}): boolean {
  if (args.slaDeadline === undefined) return false;
  if (args.status === "resolved" || args.status === "closed") {
    return (args.resolvedAt ?? args.nowMs) > args.slaDeadline;
  }
  return args.nowMs > args.slaDeadline;
}
