// Hour logging helpers shared by the attendance server actions and the attendance page. Plain module (no
// "use server", no server-only), so both sides apply exactly the same rules.
import { ESC_RULES, type PipelineStage, type VolunteerType } from "@/lib/domain";
import { parseTimeToMinutes, toDateKey } from "@/lib/dates";

export const MAX_HOURS = 24;
export const HOURS_STEP = 0.25;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Rounds to the nearest quarter hour. */
export function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

/** A valid hours entry: a number from 0 to 24 in quarter-hour (0.25) steps. */
export function isValidHours(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_HOURS &&
    Math.abs(value * 4 - Math.round(value * 4)) < 1e-9
  );
}

/**
 * The activity's duration (end − start) in hours, rounded to a quarter hour. Undefined when either time is missing
 * or invalid, or when the end is not after the start.
 */
export function activityDurationHours(
  startTime: string | undefined | null,
  endTime: string | undefined | null
): number | undefined {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return undefined;
  }
  return Math.min(MAX_HOURS, roundToQuarter((end - start) / 60));
}

/**
 * Hours to store after a save.
 * - Absent never logs hours.
 * - A number is an explicit entry.
 * - `null` resets to the activity's duration.
 * - `undefined` keeps the hours of a volunteer who was already checked in, otherwise uses the activity's duration.
 */
export function nextHours(
  previous: { status: string; hours?: number } | undefined,
  status: string,
  explicit: number | null | undefined,
  defaultHours: number | undefined
): number | undefined {
  if (status === "Absent") {
    return undefined;
  }
  if (typeof explicit === "number") {
    return explicit;
  }
  if (explicit === undefined && previous && previous.status !== "Absent" && isValidHours(previous.hours)) {
    return previous.hours;
  }
  return defaultHours;
}

/** Hours credited for a record: its stored hours, or the activity's duration for older check-ins without hours. */
export function effectiveHours(
  record: { status: string; hours?: number },
  activity: { startTime?: string; endTime?: string } | undefined
): number | undefined {
  if (record.status === "Absent") {
    return undefined;
  }
  if (isValidHours(record.hours)) {
    return record.hours;
  }
  return activity ? activityDurationHours(activity.startTime, activity.endTime) : undefined;
}

/** "4", "2.5", "1.75". */
export function formatHoursNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** "4h", "2.5h"; empty for no value. */
export function formatHours(value: number | undefined | null): string {
  return typeof value === "number" && Number.isFinite(value) ? `${formatHoursNumber(value)}h` : "";
}

/* ---------- Weeks (Monday start, calendar dates only, so time zones and DST never shift a day) ---------- */

function keyToUtc(key: string): number | null {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  // Rejects impossible dates such as 2026-02-31.
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? ms : null;
}

function utcToKey(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Whether the value is a real calendar date written as "YYYY-MM-DD". */
export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && keyToUtc(value) !== null;
}

/** Adds whole days to a "YYYY-MM-DD" key. */
export function addDays(key: string, days: number): string {
  const ms = keyToUtc(key);
  return ms === null ? key : utcToKey(ms + days * DAY_MS);
}

/** The Monday of the week containing the date. */
export function startOfWeek(key: string): string {
  const ms = keyToUtc(key);
  if (ms === null) {
    return key;
  }
  const offset = (new Date(ms).getUTCDay() + 6) % 7;
  return utcToKey(ms - offset * DAY_MS);
}

/** The seven "YYYY-MM-DD" keys of the week, Monday first. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Parts of a date key for labels. Built without Intl, so labels are identical on the server and in every browser
 * (no hydration mismatches).
 */
export function dayParts(key: string): { weekday: string; day: number; month: string; year: number } | null {
  const ms = keyToUtc(key);
  if (ms === null) {
    return null;
  }
  const date = new Date(ms);
  return {
    weekday: WEEKDAY_NAMES[date.getUTCDay()],
    day: date.getUTCDate(),
    month: MONTH_NAMES[date.getUTCMonth()],
    year: date.getUTCFullYear(),
  };
}

/** "Mon 5 Oct 2026". */
export function formatDayKey(key: string): string {
  const parts = dayParts(key);
  return parts ? `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}` : key;
}

/** "Mon 5 Oct" for a stored activity date ("YYYY-MM-DD" or a legacy ISO datetime). */
export function toDayLabel(date: string): string {
  const parts = dayParts(toDateKey(date));
  return parts ? `${parts.weekday} ${parts.day} ${parts.month}` : date || "No date";
}

/** "5 – 11 Oct 2026", "28 Sep – 4 Oct 2026", "29 Dec 2025 – 4 Jan 2026". */
export function formatWeekRange(weekStart: string): string {
  const start = dayParts(weekStart);
  const end = dayParts(addDays(weekStart, 6));
  if (!start || !end) {
    return weekStart;
  }
  const endLabel = `${end.day} ${end.month} ${end.year}`;
  if (start.year !== end.year) {
    return `${start.day} ${start.month} ${start.year} – ${endLabel}`;
  }
  return start.month === end.month ? `${start.day} – ${endLabel}` : `${start.day} ${start.month} – ${endLabel}`;
}

/* ---------- ESC weekly hours check ---------- */

export type EscHoursStatus = "under" | "ok" | "over";

export function escHoursStatus(total: number): EscHoursStatus {
  if (total < ESC_RULES.minWeeklyHours) {
    return "under";
  }
  return total > ESC_RULES.maxWeeklyHours ? "over" : "ok";
}

/** ESC volunteers who are not (or no longer) in Morocco are only listed in weeks where they logged hours. */
const ESC_EXPECTED_STAGES: (PipelineStage | undefined)[] = [undefined, "arrived"];

export interface WeeklyVolunteer {
  _id: string;
  active: boolean;
  volunteerType?: VolunteerType;
  pipelineStage?: PipelineStage;
}

export interface WeeklyActivity {
  _id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
}

export interface WeeklyRecord {
  volunteerId: string;
  activityId: string;
  status: string;
  hours?: number;
}

export interface WeeklyHoursEntry {
  activityId: string;
  title: string;
  hours: number;
}

export interface WeeklyHoursRow<V extends WeeklyVolunteer = WeeklyVolunteer> {
  volunteer: V;
  /** Hours per day, Monday first. */
  days: number[];
  /** Activities behind each day's hours, Monday first. */
  entries: WeeklyHoursEntry[][];
  total: number;
  isEsc: boolean;
  /** Null for volunteers the ESC rules do not apply to. */
  escStatus: EscHoursStatus | null;
}

export interface WeeklyHours<V extends WeeklyVolunteer = WeeklyVolunteer> {
  days: string[];
  rows: WeeklyHoursRow<V>[];
  dayTotals: number[];
  total: number;
  /** Activities dated in this week, in date order. */
  activities: WeeklyActivity[];
}

/**
 * Hours per volunteer and day for the week starting on `weekStart`, from check-ins (Present or Late) at activities
 * dated in that week. Lists everyone who checked in that week, plus current ESC volunteers with no hours at all.
 */
export function buildWeeklyHours<V extends WeeklyVolunteer>(
  weekStart: string,
  volunteers: V[],
  activities: WeeklyActivity[],
  records: Iterable<WeeklyRecord>
): WeeklyHours<V> {
  const days = weekDays(weekStart);
  const dayIndex = new Map(days.map((key, index) => [key, index]));
  const weekActivities = new Map<string, { activity: WeeklyActivity; day: number }>();
  activities.forEach((activity) => {
    const day = dayIndex.get(toDateKey(activity.date));
    if (day !== undefined) {
      weekActivities.set(activity._id, { activity, day });
    }
  });

  const byVolunteer = new Map<string, { days: number[]; entries: WeeklyHoursEntry[][] }>();
  for (const record of records) {
    const match = weekActivities.get(record.activityId);
    if (!match || record.status === "Absent") {
      continue;
    }
    const hours = effectiveHours(record, match.activity) ?? 0;
    let totals = byVolunteer.get(record.volunteerId);
    if (!totals) {
      totals = { days: Array(7).fill(0), entries: days.map(() => []) };
      byVolunteer.set(record.volunteerId, totals);
    }
    totals.days[match.day] += hours;
    totals.entries[match.day].push({ activityId: match.activity._id, title: match.activity.title, hours });
  }

  const rows: WeeklyHoursRow<V>[] = [];
  volunteers.forEach((volunteer) => {
    const logged = byVolunteer.get(volunteer._id);
    const isEsc = volunteer.volunteerType === "incoming_esc";
    const expected = isEsc && volunteer.active && ESC_EXPECTED_STAGES.includes(volunteer.pipelineStage);
    if (!logged && !expected) {
      return;
    }
    const dayHours = logged?.days ?? Array<number>(7).fill(0);
    const total = dayHours.reduce((sum, value) => sum + value, 0);
    rows.push({
      volunteer,
      days: dayHours,
      entries: logged?.entries ?? days.map(() => []),
      total,
      isEsc,
      escStatus: isEsc ? escHoursStatus(total) : null,
    });
  });

  const dayTotals = days.map((_, index) => rows.reduce((sum, row) => sum + row.days[index], 0));
  return {
    days,
    rows,
    dayTotals,
    total: dayTotals.reduce((sum, value) => sum + value, 0),
    activities: [...weekActivities.values()]
      .sort((a, b) => a.day - b.day || (a.activity.startTime ?? "").localeCompare(b.activity.startTime ?? ""))
      .map(({ activity }) => activity),
  };
}

export type WeeklyFilter = "all" | "esc" | "attention";

export function filterWeeklyRows<V extends WeeklyVolunteer>(rows: WeeklyHoursRow<V>[], filter: WeeklyFilter): WeeklyHoursRow<V>[] {
  if (filter === "esc") {
    return rows.filter((row) => row.isEsc);
  }
  if (filter === "attention") {
    return rows.filter((row) => row.escStatus === "under" || row.escStatus === "over");
  }
  return rows;
}

export const ESC_STATUS_LABELS: Record<EscHoursStatus, string> = {
  under: `Under ${ESC_RULES.minWeeklyHours}h`,
  ok: "On track",
  over: `Over ${ESC_RULES.maxWeeklyHours}h`,
};
