"use server";

import { revalidatePath } from "next/cache";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import { APP_ROLES, MANAGER_ROLES, type AppRole } from "@/lib/roles";
import { assertActionRole } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { toDateKey } from "@/lib/dates";
import { listMockAttendance, removeMockAttendance } from "@/lib/mockAttendanceStore";

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
}

export type ActivityInput = Pick<
  ActivityData,
  "title" | "description" | "date" | "startTime" | "endTime" | "location" | "maxVolunteers" | "category" | "status"
>;

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
  "spotsFilled": count(array::unique(*[
    _type == "attendance" && activity._ref == ^._id && defined(volunteer._ref) && lower(status) in ["present", "late"]
  ].volunteer._ref)),
  "attendanceCount": count(*[_type == "attendance" && activity._ref == ^._id])
}`;

let mockActivities: ActivityData[] = [
  {
    _id: "act-1",
    title: "Community Garden Planting",
    description: "Help plant vegetables and herbs in the neighborhood garden.",
    category: "Community",
    location: "Greenfield Community Garden",
    date: "2026-06-28",
    startTime: "09:00",
    endTime: "13:00",
    maxVolunteers: 25,
    status: "Upcoming",
    createdAt: "2026-06-27T10:00:00.000Z",
  },
  {
    _id: "act-2",
    title: "Beach Cleanup & Conservation",
    description: "Gather plastic waste and marine debris to protect our local coastal ecosystems.",
    category: "Environment",
    location: "Sunset Harbor Beach",
    date: "2026-06-29",
    startTime: "10:00",
    endTime: "14:00",
    maxVolunteers: 15,
    status: "Upcoming",
    createdAt: "2026-06-27T11:00:00.000Z",
  },
  {
    _id: "act-3",
    title: "Senior Center Companion Visits",
    description: "Spend time talking, playing board games, and reading with residents of Silver Pines.",
    category: "Elderly Care",
    location: "Silver Pines Residence",
    date: "2026-07-01",
    startTime: "14:00",
    endTime: "17:00",
    maxVolunteers: 10,
    status: "Upcoming",
    createdAt: "2026-06-27T12:00:00.000Z",
  },
  {
    _id: "act-4",
    title: "Youth Soccer Coaching Clinic",
    description: "Assist youth coaches in teaching basic soccer drills and promoting physical wellness.",
    category: "Recreation",
    location: "Oakridge Sports Field",
    date: "2026-07-05",
    startTime: "09:00",
    endTime: "12:00",
    maxVolunteers: 8,
    status: "Active",
    createdAt: "2026-06-27T13:00:00.000Z",
  },
  {
    _id: "act-5",
    title: "Community Library Book Audit",
    description: "Organize the local children's section and tag books with category labels.",
    category: "Education",
    location: "Public Library Annex",
    date: "2026-06-25",
    startTime: "13:00",
    endTime: "16:00",
    maxVolunteers: 6,
    status: "Completed",
    createdAt: "2026-06-24T09:00:00.000Z",
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

/** Studio-edited documents may hold lowercase statuses ("upcoming"). */
function normalizeActivityStatus(value: unknown): ActivityStatus {
  const lower = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ACTIVITY_STATUSES.find((status) => status.toLowerCase() === lower) ?? "Upcoming";
}

function validateActivityInput(input: unknown): ActivityInput {
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
  };
}

function assertDocumentId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !DOCUMENT_ID_PATTERN.test(id) || id.startsWith("drafts.") || id.startsWith("versions.")) {
    throw new ActivityError("Invalid activity id.");
  }
}

function normalizeActivity(doc: Partial<ActivityData> & { _id: string }): ActivityData {
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
  };
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
  const doc = await sanityClient.fetch<(Partial<ActivityData> & { _id: string }) | null>(
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
 * Patches the published document and, when one exists, its Studio draft in the same transaction,
 * so publishing a stale draft later can't silently revert the change.
 */
async function patchActivity(id: string, fields: Partial<ActivityInput>, draftFields: Partial<ActivityInput> = fields) {
  const draftId = `drafts.${id}`;
  const hasDraft =
    Object.keys(draftFields).length > 0 &&
    (await sanityClient.fetch<boolean>(`defined(*[_id == $draftId][0]._id)`, { draftId }, { perspective: "raw" }));
  const transaction = sanityWriteClient.transaction().patch(id, (patch) => patch.set(fields));
  if (hasDraft) {
    transaction.patch(draftId, (patch) => patch.set(draftFields));
  }
  await transaction.commit();
}

function changedFields(current: ActivityData, data: ActivityInput): Partial<ActivityInput> {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => current[key as keyof ActivityInput] !== value)
  ) as Partial<ActivityInput>;
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
  revalidatePath("/");
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
  const docs = await sanityClient.fetch<(Partial<ActivityData> & { _id: string })[]>(
    `*[_type == "activity"] | order(date asc, startTime asc)${ACTIVITY_PROJECTION}`
  );
  return docs.map(normalizeActivity);
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
    const data = validateActivityInput(input);
    const createdAt = new Date().toISOString();

    if (!isSanityConfigured()) {
      const mockDoc: ActivityData = {
        ...data,
        _id: `act-${Date.now()}`,
        createdAt,
        spotsFilled: 0,
        attendanceCount: 0,
      };
      mockActivities = [...mockActivities, mockDoc];
      revalidateActivityPages();
      return actionOk(mockDoc);
    }

    const created = await sanityWriteClient.create({ _type: "activity", ...data, createdAt });
    revalidateActivityPages();
    return actionOk(normalizeActivity({ ...data, _id: created._id, createdAt }));
  } catch (error) {
    return failure(error, "Could not create the activity. Please try again.");
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
      const [current] = withMockAttendanceCounts([existing]);
      assertCapacity(current, data.maxVolunteers);
      const updated = { ...existing, ...data };
      mockActivities = mockActivities.map((activity) => (activity._id === id ? updated : activity));
      revalidateActivityPages();
      return actionOk({ ...current, ...data });
    }

    const current = await fetchExistingActivity(id);
    assertCapacity(current, data.maxVolunteers);
    await patchActivity(id, data, changedFields(current, data));
    revalidateActivityPages();
    return actionOk({ ...current, ...data });
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
