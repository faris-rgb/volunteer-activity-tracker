const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const TIME_12H_PATTERN = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i;
const MINUTES_PER_DAY = 24 * 60;

export const DEFAULT_ACTIVITY_DURATION_MINUTES = 120;

export function parseLocalDate(date: string): Date {
  if (!DATE_ONLY_PATTERN.test(date)) {
    return new Date(date);
  }

  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getLocalDateTime(date: string): number {
  return parseLocalDate(date).getTime();
}

/** Formats a stored date, or returns "No date" when it cannot be parsed. */
export function formatLocalDate(
  date: string,
  options?: Intl.DateTimeFormatOptions,
  locales = "en-US"
): string {
  return formatDateLabel(date, options, "No date", locales);
}

/** Like formatLocalDate, but also accepts a missing date and returns `fallback` for a missing or unparseable one. */
export function formatDateLabel(
  date: string | undefined | null,
  options?: Intl.DateTimeFormatOptions,
  fallback = "No date",
  locales = "en-US"
): string {
  const parsed = parseLocalDate(date ?? "");
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString(locales, options);
}

/** Formats a Date as a local "YYYY-MM-DD" key. */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Normalizes a stored date ("YYYY-MM-DD" or legacy ISO datetime) to a "YYYY-MM-DD" key, or "" when invalid. */
export function toDateKey(date: string | undefined | null): string {
  if (!date) {
    return "";
  }
  if (DATE_ONLY_PATTERN.test(date)) {
    return date;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "" : formatDateKey(parsed);
}

/** Parses "HH:mm" (24h) or legacy "hh:mm AM/PM" into minutes since midnight. */
export function parseTimeToMinutes(time: string | undefined | null): number | null {
  if (!time) {
    return null;
  }
  const value = time.trim();

  const match24 = value.match(TIME_24H_PATTERN);
  if (match24) {
    return Number(match24[1]) * 60 + Number(match24[2]);
  }

  const match12 = value.match(TIME_12H_PATTERN);
  if (match12) {
    const hours = Number(match12[1]);
    if (hours < 1 || hours > 12) {
      return null;
    }
    const isPm = match12[3].toUpperCase() === "PM";
    return ((hours % 12) + (isPm ? 12 : 0)) * 60 + Number(match12[2]);
  }

  return null;
}

/** Formats a stored time as "9:00 AM". Deterministic (no Intl), so it is safe to render on server and client. */
export function formatTime(time: string | undefined | null): string {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) {
    return time ?? "";
  }
  const hours24 = Math.floor(minutes / 60);
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const suffix = hours24 < 12 ? "AM" : "PM";
  return `${hours12}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}

/** Combines a stored date and time into a local Date, or null when the date is invalid. */
export function getActivityDateTime(date: string, time?: string): Date | null {
  const parsed = parseLocalDate(date ?? "");
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const minutes = parseTimeToMinutes(time);
  if (minutes !== null) {
    parsed.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  }
  return parsed;
}

/** A wall-clock reading: a "YYYY-MM-DD" key plus minutes since midnight (fractional, so seconds count). */
export interface WallClock {
  dateKey: string;
  minutes: number;
}

/** Reads the wall clock of `date` in the time zone of the machine running this code. */
export function getWallClock(date: Date = new Date()): WallClock {
  return {
    dateKey: formatDateKey(date),
    minutes: date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60,
  };
}

function toDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Minutes from `now` until `minutes` past midnight of `dateKey` (negative once passed). Time-zone free. */
export function minutesUntil(dateKey: string, minutes: number, now: WallClock): number {
  return (toDayNumber(dateKey) - toDayNumber(now.dateKey)) * MINUTES_PER_DAY + minutes - now.minutes;
}

/**
 * Start and end of an activity in minutes after midnight of its date. Without a start time the activity
 * lasts all day (or until its end time); without a valid end time it lasts the default duration.
 */
export function getActivityMinutes(
  startTime: string | undefined | null,
  endTime: string | undefined | null
): { start: number; end: number } {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null) {
    return { start: 0, end: end !== null && end > 0 ? end : MINUTES_PER_DAY };
  }
  return { start, end: end !== null && end > start ? end : start + DEFAULT_ACTIVITY_DURATION_MINUTES };
}

export type ActivityPhase = "upcoming" | "live" | "ended";

/** Whether an activity has not started, is in progress or has finished at `now`; null when its date is invalid. */
export function getActivityPhase(
  activity: { date: string; startTime?: string | null; endTime?: string | null },
  now: WallClock
): ActivityPhase | null {
  const dateKey = toDateKey(activity.date);
  if (!dateKey) {
    return null;
  }
  const { start, end } = getActivityMinutes(activity.startTime, activity.endTime);
  if (minutesUntil(dateKey, start, now) > 0) {
    return "upcoming";
  }
  return minutesUntil(dateKey, end, now) > 0 ? "live" : "ended";
}
