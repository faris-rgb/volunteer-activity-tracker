// Pure helpers that turn the dashboard's data sources into cards, alerts and counts.
// Plain module (no "use client", no server-only), so it can be unit-tested and shared.
import {
  ESC_RULES,
  PIPELINE_STAGES,
  type PickupStatus,
  type PipelineStage,
  type ProjectStatus,
  type Room,
  type Stay,
  type StayStatus,
} from "@/lib/domain";
import { formatDateKey } from "@/lib/dates";
import type { VolunteerData } from "@/app/actions/volunteers";
import type { ProjectWithStats } from "@/app/actions/projects";
import {
  addDays,
  diffDays,
  documentsChecklist,
  documentsCompleteness,
  roomOccupantsOn,
  shortDate,
  visaCounter,
  volunteerName,
  type StayVolunteerOption,
} from "@/app/(app)/stays/components/stayUtils";
import { getMembershipState } from "@/app/(app)/volunteers/volunteerUtils";
import { ESC_LABEL_WARNING_DAYS, daysBetween } from "@/sanity/schemas/settings";

/** Look-ahead windows for the alerts panel. */
export const DOCUMENTS_WINDOW_DAYS = 14;
export const DEADLINE_WINDOW_DAYS = 14;
const ORGANIZATION_TIME_ZONE = "Africa/Casablanca";
const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = ["planned", "open", "running"];
const INACTIVE_STAY_STATUSES: readonly StayStatus[] = ["cancelled", "completed"];

/* ---------- Dates ---------- */

/** Today in Morocco (the organisation's time zone) as "YYYY-MM-DD"; falls back to the server's local date. */
export function organizationToday(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: ORGANIZATION_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return formatDateKey(now);
  }
}

/** "today", "tomorrow" or "in 5 days (12 Oct 2026)". */
export function relativeDay(today: string, date: string): string {
  const days = diffDays(today, date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days (${shortDate(date)})`;
}

function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

/* ---------- Lookups ---------- */

/** The slice of a volunteer the stay helpers need (same mapping as the stays page). */
export function toStayVolunteer(volunteer: VolunteerData): StayVolunteerOption {
  return {
    _id: volunteer._id,
    firstName: volunteer.firstName ?? "",
    lastName: volunteer.lastName ?? "",
    phoneNumber: volunteer.phoneNumber || undefined,
    country: volunteer.country || undefined,
    nationality: volunteer.nationality || undefined,
    dateOfBirth: volunteer.dateOfBirth || undefined,
    diet: volunteer.diet,
    volunteerType: volunteer.volunteerType,
    active: volunteer.active !== false,
  };
}

export function volunteerLookup(volunteers: VolunteerData[]): Map<string, StayVolunteerOption> {
  return new Map(volunteers.map((volunteer) => [volunteer._id, toStayVolunteer(volunteer)]));
}

/* ---------- Arrivals & departures ---------- */

export interface TravelRow {
  key: string;
  stayId: string;
  kind: "arrival" | "departure";
  date: string;
  time?: string;
  volunteerName: string;
  airport?: string;
  flightNumber?: string;
  pickupStatus?: PickupStatus;
  roomName?: string;
  projectName?: string;
  documentsPercent?: number;
}

export interface TravelDay {
  key: "today" | "tomorrow";
  label: string;
  date: string;
  rows: TravelRow[];
}

export interface TravelSummary {
  days: TravelDay[];
  /** The first arrival after tomorrow, shown when today and tomorrow are quiet. */
  nextArrival: { volunteerName: string; date: string } | null;
}

function byTime(a: TravelRow, b: TravelRow): number {
  return (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.volunteerName.localeCompare(b.volunteerName);
}

/** Arrivals and departures today and tomorrow, with the same rules as the Arrivals tab of the stays page. */
export function buildTravelSummary(
  stays: Stay[],
  volunteers: Map<string, StayVolunteerOption>,
  rooms: Map<string, Room>,
  projects: Map<string, ProjectWithStats>,
  today: string
): TravelSummary {
  const tomorrow = addDays(today, 1);
  const live = stays.filter((stay) => stay.status !== "cancelled");
  const nameOf = (stay: Stay) => volunteerName(volunteers.get(stay.volunteerId));

  const rowsFor = (date: string): TravelRow[] => {
    const arrivals = live
      .filter((stay) => stay.arrivalDate === date && stay.status !== "completed")
      .map(
        (stay): TravelRow => ({
          key: `arrival-${stay._id}`,
          stayId: stay._id,
          kind: "arrival",
          date,
          time: stay.arrivalTime || undefined,
          volunteerName: nameOf(stay),
          airport: stay.arrivalAirport,
          flightNumber: stay.flightNumber || undefined,
          pickupStatus: stay.pickupStatus,
          roomName: stay.roomId ? rooms.get(stay.roomId)?.name : undefined,
          projectName: stay.projectId ? projects.get(stay.projectId)?.name : undefined,
          documentsPercent: documentsCompleteness(stay.documents),
        })
      )
      .sort(byTime);
    const departures = live
      .filter((stay) => stay.departureDate === date)
      .map(
        (stay): TravelRow => ({
          key: `departure-${stay._id}`,
          stayId: stay._id,
          kind: "departure",
          date,
          volunteerName: nameOf(stay),
          roomName: stay.roomId ? rooms.get(stay.roomId)?.name : undefined,
          projectName: stay.projectId ? projects.get(stay.projectId)?.name : undefined,
        })
      )
      .sort(byTime);
    return [...arrivals, ...departures];
  };

  const next = live
    .filter((stay) => stay.status !== "completed" && !!stay.arrivalDate && stay.arrivalDate > tomorrow)
    .sort((a, b) => (a.arrivalDate ?? "").localeCompare(b.arrivalDate ?? ""))[0];

  return {
    days: [
      { key: "today", label: "Today", date: today, rows: rowsFor(today) },
      { key: "tomorrow", label: "Tomorrow", date: tomorrow, rows: rowsFor(tomorrow) },
    ],
    nextArrival: next?.arrivalDate ? { volunteerName: nameOf(next), date: next.arrivalDate } : null,
  };
}

/* ---------- Alerts ---------- */

export type AlertSeverity = "danger" | "warning" | "info";

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  href?: string;
  linkLabel?: string;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };

export interface AlertSources {
  today: string;
  /** null = that source failed to load (its checks are reported as unavailable). */
  stays: Stay[] | null;
  rooms: Room[] | null;
  volunteers: VolunteerData[] | null;
  projects: ProjectWithStats[] | null;
  /** undefined = not set in settings; null = settings failed to load. */
  escLabelExpiry: string | undefined | null;
  canOpenSettings: boolean;
}

export interface AlertsResult {
  alerts: DashboardAlert[];
  /** Checks that could not run because a data source failed. */
  unavailable: string[];
}

function visaAlerts(stays: Stay[], volunteers: Map<string, StayVolunteerOption>, today: string): DashboardAlert[] {
  return stays.flatMap((stay): DashboardAlert[] => {
    const counter = visaCounter(stay, volunteers.get(stay.volunteerId), today);
    if (!counter || counter.level === "ok") return [];
    const name = volunteerName(volunteers.get(stay.volunteerId));
    const limit = ESC_RULES.visaFreeDays;
    const departureDay =
      stay.arrivalDate && stay.departureDate ? diffDays(stay.arrivalDate, stay.departureDate) + 1 : null;
    const departure = stay.departureDate
      ? `Departure planned ${relativeDay(today, stay.departureDate)}${departureDay ? ` (day ${departureDay})` : ""}.`
      : "No departure date set.";

    if (counter.level === "over") {
      return [
        {
          id: `visa-${stay._id}`,
          severity: "danger",
          title: `${name}: day ${counter.day} in Morocco — the ${limit}-day visa-free limit is reached`,
          detail: `${departure} Arrange departure or a residence permit now.`,
          href: "/stays",
          linkLabel: "Open stays",
        },
      ];
    }
    const daysLeft = limit - counter.day;
    const leavesInTime = departureDay !== null && departureDay < limit;
    return [
      {
        id: `visa-${stay._id}`,
        severity: leavesInTime ? "info" : "warning",
        title: `${name}: day ${counter.day} in Morocco — ${plural(daysLeft, "day")} left visa-free`,
        detail: leavesInTime ? `${departure} That is within the ${limit}-day limit.` : `${departure} Plan the departure or a visa extension.`,
        href: "/stays",
        linkLabel: "Open stays",
      },
    ];
  });
}

function documentAlerts(stays: Stay[], volunteers: Map<string, StayVolunteerOption>, today: string): DashboardAlert[] {
  const windowEnd = addDays(today, DOCUMENTS_WINDOW_DAYS);
  return stays
    .filter(
      (stay) =>
        !INACTIVE_STAY_STATUSES.includes(stay.status) &&
        !!stay.arrivalDate &&
        stay.arrivalDate >= today &&
        stay.arrivalDate <= windowEnd &&
        documentsCompleteness(stay.documents) < 100
    )
    .sort((a, b) => (a.arrivalDate ?? "").localeCompare(b.arrivalDate ?? ""))
    .map((stay): DashboardAlert => {
      const arrival = stay.arrivalDate as string;
      const days = diffDays(today, arrival);
      const missing = documentsChecklist(stay.documents)
        .filter((item) => !item.done)
        .map((item) => item.label);
      return {
        id: `documents-${stay._id}`,
        severity: days <= 3 ? "danger" : "warning",
        title: `${volunteerName(volunteers.get(stay.volunteerId))} arrives ${relativeDay(today, arrival)} — documents ${documentsCompleteness(stay.documents)}% complete`,
        detail: `Missing: ${missing.join(", ")}.`,
        href: "/stays",
        linkLabel: "Complete documents",
      };
    });
}

function roomAlerts(rooms: Room[], stays: Stay[], today: string): DashboardAlert[] {
  return rooms.flatMap((room): DashboardAlert[] => {
    const occupants = roomOccupantsOn(room._id, stays, today).length;
    if (occupants <= room.beds) return [];
    return [
      {
        id: `room-${room._id}`,
        severity: "danger",
        title: `${room.name} is over capacity tonight: ${plural(occupants, "guest")} for ${plural(room.beds, "bed")}`,
        detail: "Move a stay to another room or change the dates.",
        href: "/stays?tab=rooms",
        linkLabel: "Open rooms",
      },
    ];
  });
}

function escLabelAlert(expiry: string | undefined, today: string, canOpenSettings: boolean): DashboardAlert[] {
  if (!expiry) return [];
  const days = daysBetween(today, expiry);
  if (days === null || days > ESC_LABEL_WARNING_DAYS) return [];
  const link = canOpenSettings ? { href: "/settings", linkLabel: "Open settings" } : {};
  if (days < 0) {
    return [
      {
        id: "esc-label",
        severity: "danger",
        title: `The ESC Quality Label expired on ${shortDate(expiry)}`,
        detail: "Renew the accreditation before hosting new ESC volunteers, then update the date in settings.",
        ...link,
      },
    ];
  }
  return [
    {
      id: "esc-label",
      severity: days <= 30 ? "danger" : "warning",
      title: `The ESC Quality Label expires ${relativeDay(today, expiry)}`,
      detail: "Start the renewal early so incoming ESC placements are not affected.",
      ...link,
    },
  ];
}

function membershipAlert(volunteers: VolunteerData[], today: string): DashboardAlert[] {
  let expired = 0;
  let unpaid = 0;
  for (const volunteer of volunteers) {
    if (volunteer.active === false) continue;
    const state = getMembershipState(volunteer.membership, today);
    if (state === "expired") expired += 1;
    if (state === "unpaid") unpaid += 1;
  }
  const total = expired + unpaid;
  if (total === 0) return [];
  const parts = [expired > 0 && `${expired} expired`, unpaid > 0 && `${unpaid} without a paid-until date`].filter(Boolean);
  return [
    {
      id: "memberships",
      severity: "warning",
      title: `${plural(total, "membership")} to follow up`,
      detail: `${parts.join(" · ")} among active volunteers. Collect the yearly fee and update their profiles.`,
      href: "/volunteers",
      linkLabel: "Open volunteers",
    },
  ];
}

function deadlineAlerts(projects: ProjectWithStats[], today: string): DashboardAlert[] {
  const windowEnd = addDays(today, DEADLINE_WINDOW_DAYS);
  return projects
    .filter(
      (project) =>
        ACTIVE_PROJECT_STATUSES.includes(project.status) &&
        !!project.applicationDeadline &&
        project.applicationDeadline >= today &&
        project.applicationDeadline <= windowEnd
    )
    .sort((a, b) => (a.applicationDeadline ?? "").localeCompare(b.applicationDeadline ?? ""))
    .map((project): DashboardAlert => {
      const deadline = project.applicationDeadline as string;
      const places = project.maxParticipants
        ? `${project.participantCount} of ${project.maxParticipants} places filled.`
        : `${plural(project.participantCount, "participant")} so far.`;
      return {
        id: `deadline-${project._id}`,
        severity: diffDays(today, deadline) <= 3 ? "warning" : "info",
        title: `${project.name}: applications close ${relativeDay(today, deadline)}`,
        detail: `${places}${project.isPublic ? " Share the join page to reach more applicants." : ""}`,
        href: "/projects",
        linkLabel: "Open projects",
      };
    });
}

/** Every operational alert for managers, most urgent first. */
export function buildAlerts(sources: AlertSources): AlertsResult {
  const { today, stays, rooms, volunteers, projects } = sources;
  const alerts: DashboardAlert[] = [];
  const unavailable: string[] = [];
  const lookup = volunteerLookup(volunteers ?? []);

  if (stays && volunteers) {
    alerts.push(...visaAlerts(stays, lookup, today));
  } else {
    unavailable.push("90-day visa counter");
  }
  if (stays) {
    alerts.push(...documentAlerts(stays, lookup, today));
  } else {
    unavailable.push("arrival documents");
  }
  if (stays && rooms) {
    alerts.push(...roomAlerts(rooms, stays, today));
  } else {
    unavailable.push("room capacity");
  }
  if (sources.escLabelExpiry !== null) {
    alerts.push(...escLabelAlert(sources.escLabelExpiry, today, sources.canOpenSettings));
  } else {
    unavailable.push("ESC Quality Label");
  }
  if (volunteers) {
    alerts.push(...membershipAlert(volunteers, today));
  } else {
    unavailable.push("memberships");
  }
  if (projects) {
    alerts.push(...deadlineAlerts(projects, today));
  } else {
    unavailable.push("application deadlines");
  }

  // Stable sort keeps the category order within one severity.
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { alerts, unavailable };
}

/* ---------- Pipeline ---------- */

export interface PipelineSummary {
  counts: { stage: PipelineStage; count: number }[];
  /** Volunteers saved before the pipeline existed (no stage yet). */
  unstaged: number;
  inPipeline: number;
}

export function buildPipelineSummary(volunteers: VolunteerData[]): PipelineSummary {
  const counts = new Map<PipelineStage, number>(PIPELINE_STAGES.map((stage) => [stage, 0]));
  let unstaged = 0;
  for (const volunteer of volunteers) {
    const stage = volunteer.pipelineStage;
    if (stage && counts.has(stage)) {
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    } else {
      unstaged += 1;
    }
  }
  return {
    counts: PIPELINE_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 })),
    unstaged,
    inPipeline: volunteers.length - unstaged,
  };
}

/* ---------- Projects ---------- */

const STRIP_ORDER: Partial<Record<ProjectStatus, number>> = { running: 0, open: 1 };

/** Running and open projects: running first, then by start date. */
export function stripProjects(projects: ProjectWithStats[]): ProjectWithStats[] {
  return projects
    .filter((project) => project.status === "running" || project.status === "open")
    .sort(
      (a, b) =>
        (STRIP_ORDER[a.status] ?? 9) - (STRIP_ORDER[b.status] ?? 9) ||
        a.startDate.localeCompare(b.startDate) ||
        a.name.localeCompare(b.name)
    );
}

/** Projects listed on the public /join page (same statuses as src/lib/publicJoin.ts). */
export function countPublicProjects(projects: ProjectWithStats[]): number {
  return projects.filter((project) => project.isPublic && ACTIVE_PROJECT_STATUSES.includes(project.status)).length;
}

/* ---------- Join page URL ---------- */

const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\[[0-9a-f:.]+\])(?::\d{1,5})?$/;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1|\[::1\]|[a-z0-9.-]+\.localhost)(?::\d{1,5})?$/;
export const FALLBACK_JOIN_URL = "http://localhost:3000/join";

function firstHeaderValue(value: string | null | undefined): string {
  return (value ?? "").split(",")[0].trim().toLowerCase();
}

/**
 * Absolute URL of the public /join page for the current request. Uses the (forwarded) host and
 * x-forwarded-proto; anything that doesn't look like a plain host name falls back to localhost:3000.
 */
export function buildJoinUrl(headers: { get(name: string): string | null }): string {
  const host = firstHeaderValue(headers.get("x-forwarded-host")) || firstHeaderValue(headers.get("host"));
  if (!host || host.length > 255 || !HOST_PATTERN.test(host)) {
    return FALLBACK_JOIN_URL;
  }
  const forwardedProto = firstHeaderValue(headers.get("x-forwarded-proto"));
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : LOCAL_HOST_PATTERN.test(host)
        ? "http"
        : "https";
  return `${protocol}://${host}/join`;
}
