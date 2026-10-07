import {
  ESC_RULES,
  ageOn,
  type ApplicationSource,
  type DietOption,
  type Membership,
  type PipelineStage,
  type VolunteerType,
  type WhatsAppTemplate,
} from "@/lib/domain";
import { parseLocalDate } from "@/lib/dates";
import type { VolunteerData } from "@/app/actions/volunteers";
import type { ActionResult } from "@/lib/actionResult";

/** Settings presets the volunteers page needs (loaded once by page.tsx). */
export interface VolunteerPresets {
  organizationName: string;
  skills: string[];
  languages: string[];
  whatsappTemplates: WhatsAppTemplate[];
}

export type MembershipState = "none" | "active" | "expired" | "unpaid";

export const MEMBERSHIP_STATE_LABELS: Record<MembershipState, string> = {
  none: "Not a member",
  active: "Member",
  expired: "Membership expired",
  unpaid: "Member · unpaid",
};

export const VOLUNTEER_TYPE_SHORT_LABELS: Record<VolunteerType, string> = {
  local: "Local",
  incoming_esc: "ESC",
  outgoing: "Abroad",
  domestic: "Domestic",
};

export const VOLUNTEER_TYPE_STYLES: Record<VolunteerType, string> = {
  local: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  incoming_esc: "text-violet-300 bg-violet-500/10 border-violet-500/20",
  outgoing: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  domestic: "text-teal-300 bg-teal-500/10 border-teal-500/20",
};

export const PIPELINE_STAGE_STYLES: Record<PipelineStage, { badge: string; dot: string }> = {
  lead: { badge: "text-sky-300 bg-sky-500/10 border-sky-500/20", dot: "bg-sky-400" },
  meeting: { badge: "text-indigo-300 bg-indigo-500/10 border-indigo-500/20", dot: "bg-indigo-400" },
  accepted: { badge: "text-amber-300 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" },
  arrived: { badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  completed: { badge: "text-teal-200 bg-teal-500/10 border-teal-500/20", dot: "bg-teal-300" },
  withdrawn: { badge: "text-slate-400 bg-slate-800 border-slate-700/50", dot: "bg-slate-500" },
};

export const DIET_LABELS: Record<DietOption, string> = {
  none: "No restrictions",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  halal: "Halal",
  other: "Other (see notes)",
};

export const SHORT_SOURCE_LABELS: Record<ApplicationSource, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  esc_portal: "ESC portal",
  join_page: "Join page",
  partner: "Partner",
  referral: "Referral",
  other: "Other",
};

/** Forward path through the pipeline; "withdrawn" is a side exit reached only via the stage select. */
const FORWARD_STAGES: PipelineStage[] = ["lead", "meeting", "accepted", "arrived", "completed"];

export function getNextStage(stage: PipelineStage | undefined): PipelineStage | null {
  if (!stage) return "lead";
  const index = FORWARD_STAGES.indexOf(stage);
  return index >= 0 && index < FORWARD_STAGES.length - 1 ? FORWARD_STAGES[index + 1] : null;
}

/** Paid until today or later = active; earlier = expired; member without a paid-until date = unpaid. */
export function getMembershipState(membership: Membership | undefined, today: string): MembershipState {
  if (!membership?.isMember) return "none";
  if (!membership.paidUntil) return "unpaid";
  return membership.paidUntil >= today ? "active" : "expired";
}

export function getAge(dateOfBirth: string | undefined, today: string): number | null {
  return ageOn(dateOfBirth, parseLocalDate(today));
}

export function isOutsideEscAge(age: number | null): boolean {
  return age !== null && (age < ESC_RULES.minAge || age > ESC_RULES.maxAge);
}

/** True when an incoming ESC volunteer's age is known and outside the ESC age range. */
export function hasEscAgeIssue(vol: Pick<VolunteerData, "volunteerType" | "dateOfBirth">, today: string): boolean {
  return vol.volunteerType === "incoming_esc" && isOutsideEscAge(getAge(vol.dateOfBirth, today));
}

/** Adds whole years to a YYYY-MM-DD key (29 Feb falls back to 28 Feb). */
export function addYears(dateKey: string, years: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetYear = year + years;
  const lastDay = new Date(targetYear, month, 0).getDate();
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function fullName(vol: Pick<VolunteerData, "firstName" | "lastName">) {
  return `${vol.firstName} ${vol.lastName}`.trim();
}

export function initials(vol: Pick<VolunteerData, "firstName" | "lastName">) {
  return `${vol.firstName.charAt(0)}${vol.lastName.charAt(0)}`.toUpperCase() || "?";
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

/** Runs a server action and turns a network/transport failure into an ActionResult error. */
export async function callAction<R extends ActionResult<unknown>>(
  action: () => Promise<R>
): Promise<R | { ok: false; error: string }> {
  try {
    return await action();
  } catch (error) {
    console.error(error);
    return { ok: false, error: NETWORK_ERROR };
  }
}
