"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { PatchOperations } from "@sanity/client";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import { APP_ROLES, MANAGER_ROLES, type AppRole } from "@/lib/roles";
import { assertActionRole } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { toDateKey } from "@/lib/dates";
import { IMPACT_METRICS, type ImpactEntry, type ImpactMetricKey } from "@/lib/domain";
import { listMockAttendance, removeMockAttendance } from "@/lib/mockAttendanceStore";
import {
  ACTIVITY_MAX_WEEKLY_REPEATS,
  DECIMAL_IMPACT_METRICS,
  MAX_IMPACT_VALUE,
} from "@/sanity/schemas/activity";
import { getProjectsAction } from "@/app/actions/projects";

export type ActivityStatus = "Upcoming" | "Active" | "Completed";

export interface ActivityData {
  _id?: string;
  title: string;
  description?: string;
  date: string;
  /** 24-hour "HH:mm". */
  startTime: string;
  /** 24-hour "HH:mm". */
  endTime: string;
  location: string;
  maxVolunteers: number;
  category: string;
  status: ActivityStatus;
  createdAt?: string;
  /** Distinct volunteers checked in (status Present or Late). */
  spotsFilled?: number;
  /** All attendance records (any status) that reference this activity. */
  attendanceCount?: number;
  /** Id of the project this activity belongs to (Sanity reference `project`). */
  projectId?: string;
  /** Name of the referenced project, resolved when loading (read-only). */
  projectName?: string;
  /** Impact counters logged for this activity; each metric appears at most once. Always an array when loaded. */
  impact?: ImpactEntry[];
}

export type ActivityInput = Pick<
  ActivityData,
  | "title"
  | "description"
  | "date"
  | "startTime"
  | "endTime"
  | "location"
  | "maxVolunteers"
  | "category"
  | "status"
  | "projectId"
  | "impact"
>;

/** Activity input after server-side validation: `projectId` is always present (possibly undefined), `impact` always an array. */
type ValidActivityInput = Required<Omit<ActivityInput, "projectId">> & { projectId: string | undefined };

/**
 * notFound: the activity no longer exists (the client should drop it).
 * attendanceCount: the delete was refused because more attendance records exist than the user was warned about.
 */
export type ActivityFailure = { ok: false; error: string; notFound?: true; attendanceCount?: number };
export type ActivityActionResult<T> = { ok: true; data: T } | ActivityFailure;

/** Errors whose message is safe and useful to show to the user. */
class ActivityError extends Error {}

class ActivityNotFoundError extends ActivityError {}

class AttendanceCountChangedError extends ActivityError {
  constructor(readonly attendanceCount: number) {
    super(
      `${pluralize(attendanceCount, "attendance record")} ${attendanceCount === 1 ? "is" : "are"} now linked to this activity and will be deleted with it. Review the warning and confirm again.`
    );
  }
}

const ACTIVITY_STATUSES: ActivityStatus[] = ["Upcoming", "Active", "Completed"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const IMPACT_METRIC_KEYS: readonly string[] = IMPACT_METRICS.map((metric) => metric.key);

const ACTIVITY_PROJECTION = `{
  _id,
  title,
  description,
  date,
  startTime,
  endTime,
  location,
  "maxVolunteers": coalesce(maxVolunteers, capacity),
  category,
  status,
  createdAt,
  "projectId": project._ref,
  "projectName": project->name,
  "impact": impact[]{metric, value},
  "spotsFilled": count(array::unique(*[
    _type == "attendance" && activity._ref == ^._id && defined(volunteer._ref) && lower(status) in ["present", "late"]
  ].volunteer._ref)),
  "attendanceCount": count(*[_type == "attendance" && activity._ref == ^._id])
}`;

/** Raw activity as returned by the projection (impact may hold anything Studio allowed). */
type StoredActivity = Partial<Omit<ActivityData, "impact" | "projectId" | "projectName">> & {
  _id: string;
  projectId?: string | null;
  projectName?: string | null;
  impact?: unknown;
};

/** In-memory activities used when Sanity is not configured (local development without credentials). */
let mockActivities: ActivityData[] = [
  {
    _id: "act-1",
    title: "Martil beach clean-up",
    description: "Collect plastic and litter along the Martil seafront with local youth and ESC volunteers.",
    category: "Environment & clean-up",
    location: "Martil",
    date: "2026-09-27",
    startTime: "09:00",
    endTime: "12:00",
    maxVolunteers: 30,
    status: "Completed",
    createdAt: "2026-09-15T10:00:00.000Z",
    impact: [
      { metric: "waste_kg", value: 120 },
      { metric: "participants", value: 18 },
    ],
  },
  {
    _id: "act-2",
    title: "Malabis Share clothing distribution",
    description: "Sort donated clothes and distribute them to families in need.",
    category: "Clothing bank & upcycling",
    location: "Tetouan",
    date: "2026-10-03",
    startTime: "10:00",
    endTime: "14:00",
    maxVolunteers: 12,
    status: "Completed",
    createdAt: "2026-09-20T11:00:00.000Z",
    impact: [
      { metric: "clothes", value: 340 },
      { metric: "families", value: 35 },
    ],
  },
  {
    _id: "act-3",
    title: "Soccer4All training",
    description: "Inclusive football training for children from the neighbourhood.",
    category: "Sports & inclusion",
    location: "Martil",
    date: "2026-10-07",
    startTime: "16:00",
    endTime: "18:00",
    maxVolunteers: 8,
    status: "Upcoming",
    createdAt: "2026-09-25T12:00:00.000Z",
    impact: [],
  },
  {
    _id: "act-4",
    title: "English conversation class",
    description: "Informal English practice for young people from Tetouan.",
    category: "English lessons",
    location: "Tetouan",
    date: "2026-10-08",
    startTime: "17:00",
    endTime: "19:00",
    maxVolunteers: 6,
    status: "Upcoming",
    createdAt: "2026-09-25T13:00:00.000Z",
    impact: [],
  },
  {
    _id: "act-5",
    title: "Care home visit",
    description: "Spend the afternoon with residents: conversation, music and board games.",
    category: "Community care visits",
    location: "Tetouan",
    date: "2026-10-10",
    startTime: "15:00",
    endTime: "17:30",
    maxVolunteers: 10,
    status: "Upcoming",
    createdAt: "2026-09-26T09:00:00.000Z",
    impact: [],
  },
];

/** Accepts "HH:mm" (24h) or legacy "hh:mm AM/PM" values and returns "HH:mm", or null when invalid. */
function toTime24(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!match) {
    return null;
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minutes > 59) {
    return null;
  }
  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null;
    }
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function isPublishedId(id: string): boolean {
  return !id.startsWith("drafts.") && !id.startsWith("versions.");
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

/** Adds whole days to a valid "YYYY-MM-DD" date (calendar arithmetic, time-zone free). */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new ActivityError(`${label} is required.`);
  }
  if (text.length > maxLength) {
    throw new ActivityError(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

function isActivityStatus(value: unknown): value is ActivityStatus {
  return typeof value === "string" && (ACTIVITY_STATUSES as string[]).includes(value);
}

function isImpactMetric(value: unknown): value is ImpactMetricKey {
  return typeof value === "string" && IMPACT_METRIC_KEYS.includes(value);
}

function impactLabel(metric: ImpactMetricKey): string {
  return IMPACT_METRICS.find((entry) => entry.key === metric)?.label ?? metric;
}

/** Studio-edited documents may hold lowercase statuses ("upcoming"). */
function normalizeActivityStatus(value: unknown): ActivityStatus {
  const lower = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ACTIVITY_STATUSES.find((status) => status.toLowerCase() === lower) ?? "Upcoming";
}

/** Optional project reference: empty means "no project"; otherwise a published document id. */
function validateProjectId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !DOCUMENT_ID_PATTERN.test(value) || !isPublishedId(value)) {
    throw new ActivityError("Invalid project. Choose a project from the list.");
  }
  return value;
}

/** Impact rows: known metric, each at most once, value a finite number >= 0 (whole number unless the metric allows decimals). */
function validateImpact(value: unknown): ImpactEntry[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > IMPACT_METRICS.length) {
    throw new ActivityError("Invalid impact data.");
  }
  const seen = new Set<ImpactMetricKey>();
  return value.map((entry): ImpactEntry => {
    if (!entry || typeof entry !== "object") {
      throw new ActivityError("Invalid impact data.");
    }
    const { metric, value: rawValue } = entry as Record<string, unknown>;
    if (!isImpactMetric(metric)) {
      throw new ActivityError("Unknown impact counter. Reload the page and try again.");
    }
    const label = impactLabel(metric);
    if (seen.has(metric)) {
      throw new ActivityError(`"${label}" is listed more than once. Combine the values into one row.`);
    }
    seen.add(metric);

    const amount =
      typeof rawValue === "number"
        ? rawValue
        : typeof rawValue === "string" && rawValue.trim() !== ""
          ? Number(rawValue)
          : Number.NaN;
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ActivityError(`${label} must be a number of 0 or more.`);
    }
    if (amount > MAX_IMPACT_VALUE) {
      throw new ActivityError(`${label} cannot exceed ${MAX_IMPACT_VALUE.toLocaleString("en-US")}.`);
    }
    const allowsDecimals = DECIMAL_IMPACT_METRICS.includes(metric);
    if (!allowsDecimals && !Number.isInteger(amount)) {
      throw new ActivityError(`${label} must be a whole number.`);
    }
    return { metric, value: allowsDecimals ? Math.round(amount * 100) / 100 : amount };
  });
}

function validateActivityInput(input: unknown): ValidActivityInput {
  if (!input || typeof input !== "object") {
    throw new ActivityError("Invalid activity data.");
  }
  const data = input as Record<string, unknown>;

  const title = requiredText(data.title, "Title", 120);
  const location = requiredText(data.location, "Location", 200);
  const category = requiredText(data.category, "Category", 60);

  const description = typeof data.description === "string" ? data.description.trim() : "";
  if (description.length > 2000) {
    throw new ActivityError("Description must be 2000 characters or fewer.");
  }

  const date = typeof data.date === "string" ? data.date.trim() : "";
  if (!date) {
    throw new ActivityError("Date is required.");
  }
  if (!isValidDate(date)) {
    throw new ActivityError("Date must be a valid date (YYYY-MM-DD).");
  }

  const startTime = toTime24(data.startTime);
  const endTime = toTime24(data.endTime);
  if (!startTime || !endTime) {
    throw new ActivityError("Start and end time are required (HH:mm).");
  }
  if (endTime <= startTime) {
    throw new ActivityError("End time must be after the start time.");
  }

  const maxVolunteers = Number(data.maxVolunteers);
  if (!Number.isInteger(maxVolunteers) || maxVolunteers < 1) {
    throw new ActivityError("Maximum volunteers must be a whole number of at least 1.");
  }
  if (maxVolunteers > 10000) {
    throw new ActivityError("Maximum volunteers cannot exceed 10,000.");
  }

  if (!isActivityStatus(data.status)) {
    throw new ActivityError("Invalid activity status.");
  }

  return {
    title,
    description,
    date,
    startTime,
    endTime,
    location,
    maxVolunteers,
    category,
    status: data.status,
    projectId: validateProjectId(data.projectId),
    impact: validateImpact(data.impact),
  };
}

function assertDocumentId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !DOCUMENT_ID_PATTERN.test(id) || id.startsWith("drafts.") || id.startsWith("versions.")) {
    throw new ActivityError("Invalid activity id.");
  }
}

/** Reads stored impact leniently: unknown metrics and invalid values are dropped, duplicate metrics are summed. */
function normalizeImpact(value: unknown): ImpactEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const totals = new Map<ImpactMetricKey, number>();
  for (const entry of value) {
    const metric = (entry as { metric?: unknown } | null)?.metric;
    const amount = Number((entry as { value?: unknown } | null)?.value);
    if (!isImpactMetric(metric) || !Number.isFinite(amount) || amount < 0) continue;
    totals.set(metric, (totals.get(metric) ?? 0) + amount);
  }
  return Array.from(totals, ([metric, total]) => ({ metric, value: total }));
}

function normalizeActivity(doc: StoredActivity): ActivityData {
  return {
    _id: doc._id,
    title: doc.title ?? "Untitled activity",
    description: doc.description ?? "",
    date: toDateKey(doc.date),
    startTime: toTime24(doc.startTime) ?? doc.startTime ?? "",
    endTime: toTime24(doc.endTime) ?? doc.endTime ?? "",
    location: doc.location ?? "",
    maxVolunteers: Number(doc.maxVolunteers) || 0,
    category: doc.category ?? "",
    status: normalizeActivityStatus(doc.status),
    createdAt: doc.createdAt,
    spotsFilled: doc.spotsFilled ?? 0,
    attendanceCount: doc.attendanceCount ?? 0,
    projectId: doc.projectId || undefined,
    projectName: doc.projectId ? (doc.projectName ?? undefined) : undefined,
    impact: normalizeImpact(doc.impact),
  };
}

function sameImpact(a: ImpactEntry[] | undefined, b: ImpactEntry[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((entry, index) => entry.metric === right[index].metric && entry.value === right[index].value);
}

/** Converts portal fields to Sanity patch operations (`projectId` -> reference, empty values are unset). */
function toSanityPatch(fields: Partial<ValidActivityInput>): PatchOperations {
  const { projectId, impact, ...scalars } = fields;
  const set: Record<string, unknown> = { ...scalars };
  const unset: string[] = [];
  if ("projectId" in fields) {
    if (projectId) {
      set.project = { _type: "reference", _ref: projectId };
    } else {
      unset.push("project");
    }
  }
  if ("impact" in fields) {
    if (impact && impact.length > 0) {
      set.impact = impact.map((entry) => ({ _key: entry.metric, _type: "impactEntry", metric: entry.metric, value: entry.value }));
    } else {
      unset.push("impact");
    }
  }
  return {
    ...(Object.keys(set).length > 0 ? { set } : {}),
    ...(unset.length > 0 ? { unset } : {}),
  };
}

function toSanityDocument(fields: ValidActivityInput): Record<string, unknown> {
  return toSanityPatch(fields).set ?? {};
}

function withMockAttendanceCounts(activities: ActivityData[]): ActivityData[] {
  const records = listMockAttendance();
  return activities.map((activity) => {
    const linked = records.filter((record) => record.activityId === activity._id);
    const checkedIn = linked.filter((record) => record.status === "Present" || record.status === "Late");
    return {
      ...activity,
      spotsFilled: new Set(checkedIn.map((record) => record.volunteerId)).size,
      attendanceCount: linked.length,
    };
  });
}

async function fetchActivity(id: string): Promise<ActivityData | null> {
  const doc = await sanityClient.fetch<StoredActivity | null>(
    `*[_type == "activity" && _id == $id][0]${ACTIVITY_PROJECTION}`,
    { id }
  );
  return doc ? normalizeActivity(doc) : null;
}

async function fetchExistingActivity(id: string): Promise<ActivityData> {
  const activity = await fetchActivity(id);
  if (!activity) {
    throw new ActivityNotFoundError("Activity not found. It may have been deleted.");
  }
  return activity;
}

/**
 * Confirms the project exists and is a published "project" document; returns its name for the response.
 * Without Sanity the in-memory projects store (via getProjectsAction) is the source of truth.
 */
async function resolveProject(projectId: string | undefined): Promise<{ _id: string; name?: string } | null> {
  if (!projectId) {
    return null;
  }
  let project: { _id: string; name?: string } | null | undefined;
  if (isSanityConfigured()) {
    project = await sanityClient.fetch<{ _id: string; name?: string } | null>(
      `*[_type == "project" && _id == $id][0]{_id, name}`,
      { id: projectId }
    );
  } else {
    let projects: Awaited<ReturnType<typeof getProjectsAction>>;
    try {
      projects = await getProjectsAction();
    } catch (error) {
      console.error("Could not load projects to verify the activity's project:", error);
      throw new ActivityError("Could not verify the selected project. Please try again.");
    }
    project = projects.find((entry) => entry._id === projectId);
  }
  if (!project) {
    throw new ActivityError("The selected project no longer exists. Choose another project or none.");
  }
  return project;
}

/**
 * Patches the published document and, when one exists, its Studio draft in the same transaction,
 * so publishing a stale draft later can't silently revert the change.
 */
async function patchActivity(
  id: string,
  fields: Partial<ValidActivityInput>,
  draftFields: Partial<ValidActivityInput> = fields
) {
  const draftId = `drafts.${id}`;
  const hasDraft =
    Object.keys(draftFields).length > 0 &&
    (await sanityClient.fetch<boolean>(`defined(*[_id == $draftId][0]._id)`, { draftId }, { perspective: "raw" }));
  const transaction = sanityWriteClient.transaction().patch(id, toSanityPatch(fields));
  if (hasDraft) {
    transaction.patch(draftId, toSanityPatch(draftFields));
  }
  await transaction.commit();
}

/** Fields whose value differs from the stored activity (used to patch an open Studio draft). */
function changedFields(current: ActivityData, data: ValidActivityInput): Partial<ValidActivityInput> {
  const changed: Partial<Record<keyof ValidActivityInput, unknown>> = {};
  for (const key of Object.keys(data) as (keyof ValidActivityInput)[]) {
    const same =
      key === "impact" ? sameImpact(current.impact, data.impact) : (current[key] ?? undefined) === (data[key] ?? undefined);
    if (!same) {
      changed[key] = data[key];
    }
  }
  return changed as Partial<ValidActivityInput>;
}

/** Refuses the delete when it would remove more attendance records than the confirmation dialog showed. */
function assertAttendanceCount(current: number, expected: number) {
  if (current > expected) {
    throw new AttendanceCountChangedError(current);
  }
}

/** Lowering capacity below the current check-ins is refused; an unchanged capacity is always accepted. */
function assertCapacity(current: ActivityData, maxVolunteers: number) {
  const checkedIn = current.spotsFilled ?? 0;
  if (maxVolunteers !== current.maxVolunteers && maxVolunteers < checkedIn) {
    throw new ActivityError(`Capacity can't be lower than the ${pluralize(checkedIn, "volunteer")} already checked in.`);
  }
}

function revalidateActivityPages() {
  revalidatePath("/activities");
  revalidatePath("/attendance");
  revalidatePath("/volunteers");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

/** assertActionRole only throws user-safe messages (signed out / missing role / account lookup failed). */
async function authorize(roles: AppRole[]) {
  try {
    return await assertActionRole(roles);
  } catch (error) {
    throw new ActivityError(
      error instanceof Error && error.message ? error.message : "You do not have permission to do this."
    );
  }
}

function sanityStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return undefined;
}

/** Shows ActivityError messages as-is; backend errors are logged and replaced with a generic message. */
function failure(error: unknown, fallback: string): ActivityFailure {
  if (error instanceof ActivityNotFoundError) {
    revalidateActivityPages();
    return { ok: false, error: error.message, notFound: true };
  }
  if (error instanceof AttendanceCountChangedError) {
    return { ok: false, error: error.message, attendanceCount: error.attendanceCount };
  }
  if (error instanceof ActivityError) {
    return { ok: false, error: error.message };
  }
  console.error(fallback, error);
  const statusCode = sanityStatusCode(error);
  if (statusCode === 401 || statusCode === 403) {
    return { ok: false, error: "Sanity rejected the request. Check the API token permissions and try again." };
  }
  return { ok: false, error: fallback };
}

async function loadActivities(): Promise<ActivityData[]> {
  if (!isSanityConfigured()) {
    return withMockAttendanceCounts(mockActivities);
  }
  const docs = await sanityClient.fetch<StoredActivity[]>(
    `*[_type == "activity"] | order(date asc, startTime asc)${ACTIVITY_PROJECTION}`
  );
  return docs.map(normalizeActivity);
}

/**
 * Validates the input once and creates `occurrences` activities, 7 days apart, starting on input.date.
 * Impact is only stored on the first occurrence (later weeks have not happened yet).
 * With Sanity all documents are created in one transaction, so either all or none exist.
 */
async function createActivities(input: unknown, occurrences: unknown): Promise<ActivityData[]> {
  const data = validateActivityInput(input);
  if (
    typeof occurrences !== "number" ||
    !Number.isInteger(occurrences) ||
    occurrences < 1 ||
    occurrences > ACTIVITY_MAX_WEEKLY_REPEATS
  ) {
    throw new ActivityError(`Repeat weekly must be between 1 and ${ACTIVITY_MAX_WEEKLY_REPEATS} weeks.`);
  }
  const project = await resolveProject(data.projectId);
  const createdAt = new Date().toISOString();
  const items: ValidActivityInput[] = Array.from({ length: occurrences }, (_, index) => ({
    ...data,
    date: addDays(data.date, index * 7),
    impact: index === 0 ? data.impact : [],
  }));

  if (!isSanityConfigured()) {
    const stamp = Date.now();
    const created: ActivityData[] = items.map((item, index) => ({
      ...item,
      _id: `act-${stamp}-${index + 1}`,
      createdAt,
      projectName: project?.name,
      spotsFilled: 0,
      attendanceCount: 0,
    }));
    mockActivities = [...mockActivities, ...created];
    return created;
  }

  const transaction = sanityWriteClient.transaction();
  const created = items.map((item) => {
    const _id = randomUUID();
    transaction.create({ _id, _type: "activity", ...toSanityDocument(item), createdAt });
    return normalizeActivity({ ...item, _id, createdAt, projectName: project?.name, spotsFilled: 0, attendanceCount: 0 });
  });
  await transaction.commit();
  return created;
}

/** Read for pages that need to show a load error instead of an empty list. */
export async function getActivitiesResultAction(): Promise<ActionResult<ActivityData[]>> {
  try {
    await authorize([...APP_ROLES]);
    return actionOk(await loadActivities());
  } catch (error) {
    return failure(error, "Could not load activities. Please try again.");
  }
}

/** All activities (including projectId/projectName and impact). Returns [] when loading fails. */
export async function getActivitiesAction(): Promise<ActivityData[]> {
  await assertActionRole([...APP_ROLES]);
  try {
    return await loadActivities();
  } catch (error) {
    console.error("Failed to fetch activities from Sanity CMS:", error);
    return [];
  }
}

export async function createActivityAction(input: ActivityInput): Promise<ActivityActionResult<ActivityData>> {
  try {
    await authorize(MANAGER_ROLES);
    const [created] = await createActivities(input, 1);
    revalidateActivityPages();
    return actionOk(created);
  } catch (error) {
    return failure(error, "Could not create the activity. Please try again.");
  }
}

/**
 * Creates a weekly series: `weeks` activities (1-12) on input.date, +7 days, +14 days, ...
 * All occurrences are validated together and written in a single transaction. Returns the created activities.
 */
export async function createActivitySeriesAction(
  input: ActivityInput,
  weeks: number
): Promise<ActivityActionResult<ActivityData[]>> {
  try {
    await authorize(MANAGER_ROLES);
    const created = await createActivities(input, weeks);
    revalidateActivityPages();
    return actionOk(created);
  } catch (error) {
    return failure(
      error,
      weeks > 1 ? "Could not create the weekly activities. Nothing was saved. Please try again." : "Could not create the activity. Please try again."
    );
  }
}

export async function updateActivityAction(
  id: string,
  input: ActivityInput
): Promise<ActivityActionResult<ActivityData>> {
  try {
    await authorize(MANAGER_ROLES);
    assertDocumentId(id);
    const data = validateActivityInput(input);

    if (!isSanityConfigured()) {
      const existing = mockActivities.find((activity) => activity._id === id);
      if (!existing) {
        throw new ActivityNotFoundError("Activity not found. It may have been deleted.");
      }
      const project = await resolveProject(data.projectId);
      const [current] = withMockAttendanceCounts([existing]);
      assertCapacity(current, data.maxVolunteers);
      const updated: ActivityData = { ...existing, ...data, projectName: project?.name };
      mockActivities = mockActivities.map((activity) => (activity._id === id ? updated : activity));
      revalidateActivityPages();
      return actionOk({ ...current, ...data, projectName: project?.name });
    }

    const current = await fetchExistingActivity(id);
    const project = await resolveProject(data.projectId);
    assertCapacity(current, data.maxVolunteers);
    await patchActivity(id, data, changedFields(current, data));
    revalidateActivityPages();
    return actionOk({ ...current, ...data, projectName: project?.name });
  } catch (error) {
    return failure(error, "Could not update the activity. Please try again.");
  }
}

export async function updateActivityStatusAction(
  id: string,
  status: ActivityStatus
): Promise<ActivityActionResult<ActivityData>> {
  try {
    await authorize(MANAGER_ROLES);
    assertDocumentId(id);
    if (!isActivityStatus(status)) {
      throw new ActivityError("Invalid activity status.");
    }

    if (!isSanityConfigured()) {
      const existing = mockActivities.find((activity) => activity._id === id);
      if (!existing) {
        throw new ActivityNotFoundError("Activity not found. It may have been deleted.");
      }
      const updated = { ...existing, status };
      mockActivities = mockActivities.map((activity) => (activity._id === id ? updated : activity));
      revalidateActivityPages();
      const [withCounts] = withMockAttendanceCounts([updated]);
      return actionOk(withCounts);
    }

    const current = await fetchExistingActivity(id);
    await patchActivity(id, { status });
    revalidateActivityPages();
    return actionOk({ ...current, status });
  } catch (error) {
    return failure(error, "Could not change the activity status. Please try again.");
  }
}

/**
 * Deletes the activity together with every attendance record that references it.
 * expectedAttendanceCount is the count the confirmation dialog showed; the delete is refused if more exist now.
 */
export async function deleteActivityAction(
  id: string,
  expectedAttendanceCount: number
): Promise<ActivityActionResult<{ deletedAttendance: number }>> {
  try {
    await authorize(MANAGER_ROLES);
    assertDocumentId(id);
    if (!Number.isInteger(expectedAttendanceCount) || expectedAttendanceCount < 0) {
      throw new ActivityError("Invalid delete request. Reload the page and try again.");
    }

    if (!isSanityConfigured()) {
      if (!mockActivities.some((activity) => activity._id === id)) {
        throw new ActivityNotFoundError("Activity not found. It may already have been deleted.");
      }
      assertAttendanceCount(listMockAttendance(id).length, expectedAttendanceCount);
      mockActivities = mockActivities.filter((activity) => activity._id !== id);
      const deletedAttendance = removeMockAttendance({ activityId: id });
      revalidateActivityPages();
      return actionOk({ deletedAttendance });
    }

    const linked = await sanityClient.fetch<{ exists: boolean; attendanceIds: string[]; activityDraftIds: string[] }>(
      `{
        "exists": defined(*[_type == "activity" && _id == $id][0]._id),
        "attendanceIds": *[_type == "attendance" && activity._ref == $id]._id,
        "activityDraftIds": *[_id == $draftId]._id
      }`,
      { id, draftId: `drafts.${id}` },
      { perspective: "raw" }
    );
    if (!linked.exists) {
      throw new ActivityNotFoundError("Activity not found. It may already have been deleted.");
    }
    const deletedAttendance = linked.attendanceIds.filter(isPublishedId).length;
    assertAttendanceCount(deletedAttendance, expectedAttendanceCount);

    const transaction = sanityWriteClient.transaction();
    for (const docId of [...linked.attendanceIds, ...linked.activityDraftIds, id]) {
      transaction.delete(docId);
    }
    await transaction.commit();

    revalidateActivityPages();
    return actionOk({ deletedAttendance });
  } catch (error) {
    if (sanityStatusCode(error) === 409) {
      console.error("Activity delete blocked by references:", error);
      return actionError(null, "Other documents in Sanity still reference this activity, so it can't be deleted yet.");
    }
    return failure(error, "Could not delete the activity. Please try again.");
  }
}
