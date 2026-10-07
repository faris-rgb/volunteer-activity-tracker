// Pure, client-safe helpers for the Stays & Arrivals page.
import {
  ARRIVAL_AIRPORTS,
  ESC_RULES,
  ageOn,
  type AllowancePayment,
  type AllowanceType,
  type DietOption,
  type FundingType,
  type PickupStatus,
  type ProjectStatus,
  type Stay,
  type StayDocuments,
  type StayStatus,
  type VolunteerType,
  type YouthpassStatus,
} from "@/lib/domain";
import { formatDateLabel, parseLocalDate } from "@/lib/dates";

/** The slice of a volunteer the stays page needs (sensitive fields stay on the server). */
export interface StayVolunteerOption {
  _id: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  country?: string;
  nationality?: string;
  dateOfBirth?: string;
  diet?: DietOption;
  volunteerType?: VolunteerType;
  active: boolean;
}

export interface StayProjectOption {
  _id: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  location?: string;
  maxParticipants?: number;
  ageMin?: number;
  ageMax?: number;
  funding?: FundingType;
}

export const STAY_STATUS_LABELS: Record<StayStatus, string> = {
  planned: "Planned",
  confirmed: "Confirmed",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STAY_STATUS_BADGES: Record<StayStatus, string> = {
  planned: "text-slate-300 bg-slate-800 border-slate-700/50",
  confirmed: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  arrived: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  completed: "text-violet-300 bg-violet-500/10 border-violet-500/20",
  cancelled: "text-rose-300 bg-rose-500/10 border-rose-500/20",
};

export const PICKUP_STATUS_LABELS: Record<PickupStatus, string> = {
  not_needed: "Not needed",
  scheduled: "Scheduled",
  picked_up: "Picked up",
  no_show: "No-show",
  changed: "Changed",
};

export const PICKUP_STATUS_BADGES: Record<PickupStatus, string> = {
  not_needed: "text-slate-400 bg-slate-800 border-slate-700/50",
  scheduled: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  picked_up: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  no_show: "text-rose-300 bg-rose-500/10 border-rose-500/20",
  changed: "text-amber-300 bg-amber-500/10 border-amber-500/20",
};

export const YOUTHPASS_STATUS_LABELS: Record<YouthpassStatus, string> = {
  not_applicable: "Not applicable",
  requested: "Requested",
  issued: "Issued",
};

export const ALLOWANCE_TYPE_LABELS: Record<AllowanceType, string> = {
  pocket_money: "Pocket money",
  food: "Food",
  travel: "Travel",
};

export const DIET_LABELS: Record<DietOption, string> = {
  none: "No restrictions",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  halal: "Halal",
  other: "Other (see notes)",
};

export const CURRENCIES = ["MAD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/* ---------- Dates ---------- */

function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"); positive when `to` is later. */
export function diffDays(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function addMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, day)).toISOString().slice(0, 10);
}

export function shortDate(dateKey: string | undefined): string {
  return formatDateLabel(dateKey, { day: "numeric", month: "short", year: "numeric" }, "—");
}

export function dayLabel(dateKey: string | undefined): string {
  return formatDateLabel(dateKey, { weekday: "short", day: "numeric", month: "short" }, "—");
}

/* ---------- Names & labels ---------- */

export function volunteerName(volunteer: Pick<StayVolunteerOption, "firstName" | "lastName"> | undefined): string {
  if (!volunteer) return "Unknown volunteer";
  return `${volunteer.firstName} ${volunteer.lastName}`.trim() || "Unnamed volunteer";
}

export function initials(volunteer: Pick<StayVolunteerOption, "firstName" | "lastName"> | undefined): string {
  if (!volunteer) return "?";
  return `${volunteer.firstName.charAt(0)}${volunteer.lastName.charAt(0)}`.toUpperCase() || "?";
}

export function airportLabel(code: string | undefined): string {
  return ARRIVAL_AIRPORTS.find((airport) => airport.code === code)?.label ?? "";
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function formatMoney(amount: number, currency: string): string {
  const value = amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${value} ${currency}`;
}

/* ---------- 90-day visa counter ---------- */

const MOROCCO_NAMES = new Set(["morocco", "moroccan", "maroc", "marocain", "marocaine", "ma", "mar", "المغرب"]);

/** Moroccan citizens have no 90-day limit. Without a nationality, local/domestic/outgoing volunteers count as Moroccan. */
export function isMoroccan(volunteer: StayVolunteerOption | undefined): boolean {
  const nationality = volunteer?.nationality?.trim().toLowerCase();
  if (nationality) {
    return MOROCCO_NAMES.has(nationality);
  }
  const type = volunteer?.volunteerType;
  return type === "local" || type === "domestic" || type === "outgoing";
}

/** True while the volunteer is in the country: status arrived, or today inside [arrival, departure). */
export function isInCountry(stay: Stay, today: string): boolean {
  if (stay.status === "cancelled" || stay.status === "completed" || !stay.arrivalDate) return false;
  if (stay.status === "arrived") return stay.arrivalDate <= today;
  return stay.arrivalDate <= today && (!stay.departureDate || today < stay.departureDate);
}

export type VisaLevel = "ok" | "warning" | "over";

export interface VisaCounter {
  day: number;
  level: VisaLevel;
}

/** Days in Morocco for foreign volunteers currently in the country (null when not applicable). */
export function visaCounter(stay: Stay, volunteer: StayVolunteerOption | undefined, today: string): VisaCounter | null {
  if (!stay.arrivalDate || !isInCountry(stay, today) || isMoroccan(volunteer)) return null;
  const day = diffDays(stay.arrivalDate, today) + 1;
  const level: VisaLevel = day >= ESC_RULES.visaFreeDays ? "over" : day >= ESC_RULES.visaWarningDay ? "warning" : "ok";
  return { day, level };
}

export const VISA_BADGES: Record<VisaLevel, string> = {
  ok: "text-slate-300 bg-slate-800 border-slate-700/50",
  warning: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  over: "text-rose-300 bg-rose-500/15 border-rose-500/40",
};

/** Length of the stay in days (departure - arrival), or null without both dates. */
export function stayLength(stay: Pick<Stay, "arrivalDate" | "departureDate">): number | null {
  if (!stay.arrivalDate || !stay.departureDate) return null;
  return diffDays(stay.arrivalDate, stay.departureDate);
}

/* ---------- Documents ---------- */

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export function documentsChecklist(documents: StayDocuments | undefined): ChecklistItem[] {
  const docs = documents ?? {};
  return [
    { key: "passport", label: "Passport checked (with expiry)", done: !!docs.passportChecked && !!docs.passportExpiry },
    {
      key: "insurance",
      label: "Insurance (provider and policy)",
      done: !!docs.insuranceProvider?.trim() && !!docs.insurancePolicyNumber?.trim(),
    },
    { key: "criminal", label: "Criminal record certificate", done: !!docs.criminalRecordDate },
    { key: "agreement", label: "Volunteer agreement signed", done: !!docs.agreementSigned },
    { key: "photo", label: "Photo consent", done: !!docs.photoConsent },
  ];
}

export function documentsCompleteness(documents: StayDocuments | undefined): number {
  const items = documentsChecklist(documents);
  return Math.round((items.filter((item) => item.done).length / items.length) * 100);
}

/** Passport must stay valid for at least 90 days after departure (or arrival when no departure is set). */
export function passportWarning(
  documents: StayDocuments | undefined,
  stay: Pick<Stay, "arrivalDate" | "departureDate">
): string | null {
  const expiry = documents?.passportExpiry;
  if (!expiry) return null;
  if (stay.arrivalDate && expiry < stay.arrivalDate) {
    return `Passport expires on ${shortDate(expiry)}, before the arrival date.`;
  }
  const reference = stay.departureDate ?? stay.arrivalDate;
  if (!reference) return null;
  const minimum = addDays(reference, ESC_RULES.visaFreeDays);
  if (expiry < minimum) {
    return `Passport expires on ${shortDate(expiry)} — less than ${ESC_RULES.visaFreeDays} days after ${
      stay.departureDate ? "departure" : "arrival"
    } (needs ${shortDate(minimum)} or later).`;
  }
  return null;
}

/** Criminal record certificates older than 6 months at arrival are usually not accepted. */
export function criminalRecordWarning(documents: StayDocuments | undefined, arrivalDate: string | undefined): string | null {
  const date = documents?.criminalRecordDate;
  if (!date || !arrivalDate) return null;
  if (date > arrivalDate) return null;
  if (date < addMonths(arrivalDate, -6)) {
    return `Criminal record certificate is from ${shortDate(date)} — older than 6 months at arrival.`;
  }
  return null;
}

/* ---------- Eligibility & capacity ---------- */

/** Age check against the project's age range (ESC 18–30 when an ESC project sets none). */
export function ageWarning(volunteer: StayVolunteerOption | undefined, project: StayProjectOption | undefined): string | null {
  if (!volunteer || !project) return null;
  const min = project.ageMin ?? (project.funding === "esc" ? ESC_RULES.minAge : undefined);
  const max = project.ageMax ?? (project.funding === "esc" ? ESC_RULES.maxAge : undefined);
  if (min === undefined && max === undefined) return null;
  const range = min !== undefined && max !== undefined ? `${min}–${max}` : min !== undefined ? `${min}+` : `up to ${max}`;
  if (!volunteer.dateOfBirth) {
    return `No date of birth on file, so the age range (${range}) can't be checked.`;
  }
  const startDate = project.startDate ? parseLocalDate(project.startDate) : new Date();
  const age = ageOn(volunteer.dateOfBirth, Number.isNaN(startDate.getTime()) ? new Date() : startDate);
  if (age === null) return null;
  if ((min !== undefined && age < min) || (max !== undefined && age > max)) {
    return `${volunteerName(volunteer)} will be ${age} at the project start — outside the age range ${range}.`;
  }
  return null;
}

/** Non-cancelled stays on a project, optionally excluding one stay. */
export function projectParticipants(stays: Stay[], projectId: string, excludeStayId?: string | null): number {
  return stays.filter((stay) => stay.projectId === projectId && stay.status !== "cancelled" && stay._id !== excludeStayId)
    .length;
}

/* ---------- Rooms ---------- */

/** A stay occupies its room on nights from arrival (inclusive) to departure (exclusive). */
export function occupiesOn(stay: Stay, date: string): boolean {
  return (
    stay.status !== "cancelled" &&
    !!stay.arrivalDate &&
    !!stay.departureDate &&
    stay.arrivalDate <= date &&
    date < stay.departureDate
  );
}

export function roomOccupantsOn(roomId: string, stays: Stay[], date: string, excludeStayId?: string | null): Stay[] {
  return stays.filter((stay) => stay.roomId === roomId && stay._id !== excludeStayId && occupiesOn(stay, date));
}

/** Highest number of other stays in the room on any night of [from, to). */
export function peakOccupancy(roomId: string, stays: Stay[], from: string, to: string, excludeStayId?: string | null): number {
  if (!from || !to || to <= from) return 0;
  const others = stays.filter(
    (stay) =>
      stay.roomId === roomId &&
      stay._id !== excludeStayId &&
      stay.status !== "cancelled" &&
      !!stay.arrivalDate &&
      !!stay.departureDate &&
      stay.arrivalDate < to &&
      from < stay.departureDate
  );
  // Peak occupancy is reached on the first night or on some other stay's arrival night.
  const candidates = [from, ...others.map((stay) => stay.arrivalDate as string).filter((date) => date > from && date < to)];
  return Math.max(0, ...candidates.map((date) => others.filter((stay) => occupiesOn(stay, date)).length));
}

/* ---------- Allowances ---------- */

export interface AllowanceTotal {
  type: AllowanceType;
  currency: string;
  total: number;
  count: number;
}

export function allowanceTotals(allowances: AllowancePayment[] | undefined): AllowanceTotal[] {
  const totals = new Map<string, AllowanceTotal>();
  for (const payment of allowances ?? []) {
    const key = `${payment.type}|${payment.currency}`;
    const entry = totals.get(key) ?? { type: payment.type, currency: payment.currency, total: 0, count: 0 };
    entry.total = Math.round((entry.total + payment.amount) * 100) / 100;
    entry.count += 1;
    totals.set(key, entry);
  }
  return [...totals.values()].sort((a, b) => a.type.localeCompare(b.type) || a.currency.localeCompare(b.currency));
}

export function currencyTotals(allowances: AllowancePayment[] | undefined): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const payment of allowances ?? []) {
    totals.set(payment.currency, Math.round(((totals.get(payment.currency) ?? 0) + payment.amount) * 100) / 100);
  }
  return [...totals.entries()].map(([currency, total]) => ({ currency, total }));
}
