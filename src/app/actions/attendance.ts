"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertActionRole, getDisplayName, type RoleUser } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { APP_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { formatDateKey, toDateKey } from "@/lib/dates";
import { isSanityConfigured, sanityClient, sanityWriteClient } from "@/lib/sanity";
import { findMockAttendance, listMockAttendance, upsertMockAttendance } from "@/lib/mockAttendanceStore";
import { getActivitiesResultAction } from "@/app/actions/activities";
import { getVolunteersAction } from "@/app/actions/volunteers";
import { activityDurationHours, isValidHours, MAX_HOURS, nextHours, roundToQuarter } from "@/app/(app)/attendance/hours";

export type AttendanceStatus = "Present" | "Absent" | "Late";

export interface AttendanceRecord {
  _id?: string;
  volunteerId: string;
  activityId: string;
  status: AttendanceStatus;
  /** ISO timestamp. Records saved by older versions may hold a preformatted time such as "08:52 AM". */
  checkInTime?: string;
  /** Hours volunteered (0–24, quarter-hour steps). Only set for Present or Late. */
  hours?: number;
  notes?: string;
  recordedBy?: string;
  createdAt?: string;

  volunteer?: {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    country?: string;
    skills?: string[];
  } | null;
  activity?: {
    _id: string;
    title: string;
    date: string;
  } | null;
}

export interface RecordAttendanceInput {
  volunteerId: string;
  activityId: string;
  status: AttendanceStatus;
  /** Omit to keep the current notes; an empty string clears them. */
  notes?: string;
  /**
   * Hours volunteered (0–24 in 0.25 steps), ignored for Absent. Omit to keep the hours of a volunteer who was already
   * checked in (otherwise the activity's duration is used); `null` resets them to the activity's duration.
   */
  hours?: number | null;
  /** The recorder's IANA time zone, used to decide whether the save happens on the activity's date. */
  timeZone?: string;
}

interface ExistingAttendance {
  _id: string;
  volunteerId: string;
  status: string | null;
  checkInTime?: string;
  hours?: number | null;
  notes?: string;
  createdAt?: string;
}

/** Errors whose message is safe and useful to show to the user. */
class AttendanceError extends Error {}

const STATUSES: AttendanceStatus[] = ["Present", "Late", "Absent"];
const MAX_NOTES_LENGTH = 1000;
const MAX_BULK_SIZE = 500;
const MAX_TIME_ZONE_LENGTH = 64;

const ATTENDANCE_PROJECTION = `{
  _id,
  "volunteerId": volunteer._ref,
  "activityId": activity._ref,
  status,
  "checkInTime": coalesce(checkInTime, attendedAt),
  hours,
  notes,
  recordedBy,
  "createdAt": coalesce(createdAt, _createdAt),
  volunteer->{_id, firstName, lastName, email, country, skills},
  activity->{_id, title, date}
}`;

function parseId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || value.length > 128 || /\s/.test(value) || value.startsWith("drafts.")) {
    throw new AttendanceError(`Invalid ${label} id.`);
  }
  return value;
}

/** Studio-created documents may store lowercase statuses ("present"). */
function normalizeStatus(value: unknown): AttendanceStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  const lower = value.trim().toLowerCase();
  return STATUSES.find((status) => status.toLowerCase() === lower) ?? null;
}

function normalizeRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return records.flatMap((record) => {
    const status = normalizeStatus(record.status);
    if (!status) {
      return [];
    }
    const checkedIn = status !== "Absent";
    return [
      {
        ...record,
        status,
        checkInTime: checkedIn ? record.checkInTime || undefined : undefined,
        hours: checkedIn && isValidHours(record.hours) ? record.hours : undefined,
      },
    ];
  });
}

function parseStatus(value: unknown): AttendanceStatus {
  if (typeof value !== "string" || !(STATUSES as string[]).includes(value)) {
    throw new AttendanceError("Invalid attendance status.");
  }
  return value as AttendanceStatus;
}

function parseNotes(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AttendanceError("Notes must be text.");
  }
  const notes = value.trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new AttendanceError(`Notes must be at most ${MAX_NOTES_LENGTH} characters.`);
  }
  return notes;
}

/** A number from 0 to 24 in quarter-hour steps; `null` asks for the activity's duration. */
function parseHours(value: unknown): number | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_HOURS) {
    throw new AttendanceError(`Hours must be a number from 0 to ${MAX_HOURS}.`);
  }
  if (!isValidHours(value)) {
    throw new AttendanceError("Hours must be in 15-minute steps (e.g. 2, 2.25, 2.5 or 2.75).");
  }
  return roundToQuarter(value);
}

/** Today's "YYYY-MM-DD" in the recorder's time zone; falls back to the server's when it is missing or invalid. */
function todayKey(timeZone: unknown, now: Date): string {
  if (typeof timeZone === "string" && timeZone && timeZone.length <= MAX_TIME_ZONE_LENGTH) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    } catch {
      // Unknown time zone: use the server's.
    }
  }
  return formatDateKey(now);
}

/** Present/Late may not push the number of distinct checked-in volunteers past the activity's capacity. */
function assertCapacity(
  maxVolunteers: number,
  checkedInIds: string[],
  volunteerIds: string[],
  status: AttendanceStatus
) {
  if (status === "Absent" || !(maxVolunteers > 0)) {
    return;
  }
  const checkedIn = new Set(checkedInIds);
  const added = volunteerIds.filter((id) => !checkedIn.has(id)).length;
  if (added === 0 || checkedIn.size + added <= maxVolunteers) {
    return;
  }
  const remaining = Math.max(0, maxVolunteers - checkedIn.size);
  throw new AttendanceError(
    remaining === 0
      ? `This activity is full (${checkedIn.size} of ${maxVolunteers} spots checked in). Raise its capacity on the Activities page to check in more volunteers.`
      : `Only ${remaining} of ${maxVolunteers} spots are left, so ${added} more volunteers can't be checked in. Select fewer volunteers or raise the activity's capacity on the Activities page.`
  );
}

/** One deterministic document per volunteer and activity, so concurrent saves cannot create duplicates. */
function attendanceDocId(activityId: string, volunteerId: string): string {
  const hash = createHash("sha256").update(`${activityId}\u0000${volunteerId}`).digest("hex");
  return `attendance-${hash.slice(0, 40)}`;
}

/**
 * Keeps the original check-in when switching between Present and Late; Absent clears it. A new check-in is
 * only stamped when attendance is recorded on the activity's date, so late entries don't invent arrival times.
 */
function nextCheckInTime(
  previous: Pick<AttendanceRecord, "status" | "checkInTime"> | undefined,
  status: AttendanceStatus,
  checkInNow: string | undefined
): string | undefined {
  if (status === "Absent") {
    return undefined;
  }
  if (previous && previous.status !== "Absent" && previous.checkInTime) {
    return previous.checkInTime;
  }
  return checkInNow;
}

function withoutPrivateFields(record: AttendanceRecord): AttendanceRecord {
  return {
    ...record,
    notes: undefined,
    recordedBy: undefined,
    volunteer: record.volunteer ? { ...record.volunteer, email: undefined } : record.volunteer,
  };
}

function revalidateAttendanceViews() {
  revalidatePath("/attendance");
  revalidatePath("/activities");
  revalidatePath("/volunteers");
  revalidatePath("/");
}

function failure(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof AttendanceError) {
    return actionError(error);
  }
  console.error(fallback, error);
  return actionError(null, fallback);
}

export async function getAttendanceRecordsAction(activityId?: string): Promise<AttendanceRecord[]> {
  const caller = await assertActionRole([...APP_ROLES]);
  const filterId = activityId === undefined ? undefined : parseId(activityId, "activity");

  let records: AttendanceRecord[];
  if (!isSanityConfigured()) {
    records = listMockAttendance(filterId);
  } else {
    try {
      const filter = filterId ? " && activity._ref == $activityId" : "";
      const docs = await sanityClient.fetch<AttendanceRecord[]>(
        `*[_type == "attendance" && defined(volunteer._ref) && defined(activity._ref)${filter}]
          | order(coalesce(createdAt, _createdAt) asc)${ATTENDANCE_PROJECTION}`,
        filterId ? { activityId: filterId } : {}
      );
      records = normalizeRecords(docs);
    } catch (error) {
      console.error("Failed to load attendance records from Sanity:", error);
      throw new Error("Could not load attendance records. Please try again.");
    }
  }

  return MANAGER_ROLES.includes(caller.role) ? records : records.map(withoutPrivateFields);
}

interface SaveOptions {
  notes: string | undefined;
  hours: number | null | undefined;
  recordedBy: string;
  timeZone: unknown;
}

async function saveMockAttendance(
  activityId: string,
  volunteerIds: string[],
  status: AttendanceStatus,
  { notes, hours, recordedBy, timeZone }: SaveOptions
): Promise<AttendanceRecord[]> {
  const [activities, volunteers] = await Promise.all([getActivitiesResultAction(), getVolunteersAction()]);
  if (!activities.ok) {
    throw new AttendanceError(activities.error);
  }
  const activity = activities.data.find((item) => item._id === activityId);
  if (!activity) {
    throw new AttendanceError("This activity no longer exists. Refresh the page and try again.");
  }
  const volunteersById = new Map(volunteers.map((volunteer) => [volunteer._id, volunteer]));
  const missing = volunteerIds.filter((id) => !volunteersById.has(id)).length;
  if (missing > 0) {
    throw new AttendanceError(
      `${missing} selected volunteer${missing === 1 ? " no longer exists" : "s no longer exist"}. Refresh the page and try again.`
    );
  }

  const checkedInIds = listMockAttendance(activityId)
    .filter((record) => record.status !== "Absent")
    .map((record) => record.volunteerId);
  assertCapacity(activity.maxVolunteers, checkedInIds, volunteerIds, status);

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const checkInNow = toDateKey(activity.date) === todayKey(timeZone, nowDate) ? now : undefined;
  const defaultHours = activityDurationHours(activity.startTime, activity.endTime);
  return volunteerIds.map((volunteerId) => {
    const volunteer = volunteersById.get(volunteerId)!;
    const previous = findMockAttendance(activityId, volunteerId);
    const record: AttendanceRecord = {
      _id: previous?._id ?? attendanceDocId(activityId, volunteerId),
      volunteerId,
      activityId,
      status,
      checkInTime: nextCheckInTime(previous, status, checkInNow),
      hours: nextHours(previous, status, hours, defaultHours),
      notes: notes === undefined ? previous?.notes : notes || undefined,
      recordedBy,
      createdAt: previous?.createdAt ?? now,
      volunteer: {
        _id: volunteer._id,
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        email: volunteer.email,
        country: volunteer.country,
        skills: volunteer.skills,
      },
      activity: { _id: activityId, title: activity.title, date: activity.date },
    };
    upsertMockAttendance(record);
    return record;
  });
}

async function saveSanityAttendance(
  activityId: string,
  volunteerIds: string[],
  status: AttendanceStatus,
  { notes, hours, recordedBy, timeZone }: SaveOptions
): Promise<AttendanceRecord[]> {
  let lookup: {
    activity: { date: string; startTime: string | null; endTime: string | null; maxVolunteers: number | null } | null;
    checkedInIds: string[];
    volunteerIds: string[];
    existing: ExistingAttendance[];
  };
  try {
    lookup = await sanityClient.fetch(
      `{
        "activity": *[_type == "activity" && _id == $activityId][0]{
          "date": coalesce(date, ""),
          startTime,
          endTime,
          "maxVolunteers": coalesce(maxVolunteers, capacity)
        },
        "checkedInIds": array::unique(*[
          _type == "attendance" && activity._ref == $activityId && defined(volunteer._ref) && lower(status) in ["present", "late"]
        ].volunteer._ref),
        "volunteerIds": *[_type == "volunteer" && _id in $volunteerIds]._id,
        "existing": *[_type == "attendance" && activity._ref == $activityId && volunteer._ref in $volunteerIds]
          | order(coalesce(createdAt, _createdAt) asc) {
            _id,
            "volunteerId": volunteer._ref,
            status,
            "checkInTime": coalesce(checkInTime, attendedAt),
            hours,
            notes,
            "createdAt": coalesce(createdAt, _createdAt)
          }
      }`,
      { activityId, volunteerIds }
    );
  } catch (error) {
    console.error("Failed to look up attendance in Sanity:", error);
    throw new AttendanceError("Could not reach Sanity to save attendance. Please try again.");
  }

  if (!lookup.activity) {
    throw new AttendanceError("This activity no longer exists. Refresh the page and try again.");
  }
  const found = new Set(lookup.volunteerIds);
  const missing = volunteerIds.filter((id) => !found.has(id)).length;
  if (missing > 0) {
    throw new AttendanceError(
      `${missing} selected volunteer${missing === 1 ? " no longer exists" : "s no longer exist"}. Refresh the page and try again.`
    );
  }

  assertCapacity(Number(lookup.activity.maxVolunteers) || 0, lookup.checkedInIds ?? [], volunteerIds, status);

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const checkInNow = toDateKey(lookup.activity.date) === todayKey(timeZone, nowDate) ? now : undefined;
  const defaultHours = activityDurationHours(lookup.activity.startTime, lookup.activity.endTime);
  const transaction = sanityWriteClient.transaction();
  const saved = volunteerIds.map((volunteerId): AttendanceRecord => {
    const matches = lookup.existing.filter((record) => record.volunteerId === volunteerId);
    const previous = matches[matches.length - 1];
    const previousStatus = normalizeStatus(previous?.status);
    const previousRecord = previousStatus
      ? {
          status: previousStatus,
          checkInTime: previous.checkInTime,
          hours: isValidHours(previous.hours) ? previous.hours : undefined,
        }
      : undefined;
    const checkInTime = nextCheckInTime(previousRecord, status, checkInNow);
    const savedHours = nextHours(previousRecord, status, hours, defaultHours);
    const targetIds = matches.length > 0 ? matches.map((record) => record._id) : [attendanceDocId(activityId, volunteerId)];

    if (matches.length === 0) {
      transaction.createIfNotExists({
        _id: targetIds[0],
        _type: "attendance",
        volunteer: { _type: "reference", _ref: volunteerId },
        activity: { _type: "reference", _ref: activityId },
        status,
        createdAt: now,
      });
    }

    const set: Record<string, string | number> = { status, recordedBy };
    const unset: string[] = [];
    if (checkInTime) {
      set.checkInTime = checkInTime;
    } else {
      unset.push("checkInTime");
    }
    if (savedHours !== undefined) {
      set.hours = savedHours;
    } else {
      unset.push("hours");
    }
    if (notes) {
      set.notes = notes;
    } else if (notes === "") {
      unset.push("notes");
    }
    targetIds.forEach((id) => transaction.patch(id, unset.length > 0 ? { set, unset } : { set }));

    return {
      _id: targetIds[targetIds.length - 1],
      volunteerId,
      activityId,
      status,
      checkInTime,
      hours: savedHours,
      notes: notes === undefined ? previous?.notes : notes || undefined,
      recordedBy,
      createdAt: previous?.createdAt ?? now,
    };
  });

  try {
    await transaction.commit({ visibility: "sync" });
  } catch (error) {
    console.error("Failed to save attendance in Sanity:", error);
    throw new AttendanceError("Could not save attendance to Sanity. Check the API token permissions and try again.");
  }
  return saved;
}

function saveAttendance(
  activityId: string,
  volunteerIds: string[],
  status: AttendanceStatus,
  options: SaveOptions
): Promise<AttendanceRecord[]> {
  return isSanityConfigured()
    ? saveSanityAttendance(activityId, volunteerIds, status, options)
    : saveMockAttendance(activityId, volunteerIds, status, options);
}

export async function recordAttendanceAction(input: RecordAttendanceInput): Promise<ActionResult<AttendanceRecord>> {
  let caller: RoleUser;
  try {
    caller = await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    if (!input || typeof input !== "object") {
      throw new AttendanceError("Invalid attendance data.");
    }
    const activityId = parseId(input.activityId, "activity");
    const volunteerId = parseId(input.volunteerId, "volunteer");
    const status = parseStatus(input.status);
    const notes = parseNotes(input.notes);
    const hours = parseHours(input.hours);

    const [record] = await saveAttendance(activityId, [volunteerId], status, {
      notes,
      hours,
      recordedBy: getDisplayName(caller),
      timeZone: input.timeZone,
    });
    revalidateAttendanceViews();
    return actionOk(record);
  } catch (error) {
    return failure(error, "Could not save attendance. Please try again.");
  }
}

export async function bulkRecordAttendanceAction(
  activityId: string,
  volunteerIds: string[],
  status: AttendanceStatus,
  timeZone?: string
): Promise<ActionResult<AttendanceRecord[]>> {
  let caller: RoleUser;
  try {
    caller = await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    const parsedActivityId = parseId(activityId, "activity");
    if (!Array.isArray(volunteerIds) || volunteerIds.length === 0) {
      throw new AttendanceError("Select at least one volunteer.");
    }
    const ids = [...new Set(volunteerIds.map((id) => parseId(id, "volunteer")))];
    if (ids.length > MAX_BULK_SIZE) {
      throw new AttendanceError(`You can update at most ${MAX_BULK_SIZE} volunteers at once.`);
    }
    const parsedStatus = parseStatus(status);

    // Newly checked-in volunteers get the activity's duration; volunteers already checked in keep their hours.
    const records = await saveAttendance(parsedActivityId, ids, parsedStatus, {
      notes: undefined,
      hours: undefined,
      recordedBy: getDisplayName(caller),
      timeZone,
    });
    revalidateAttendanceViews();
    return actionOk(records);
  } catch (error) {
    return failure(error, "Could not update attendance. Please try again.");
  }
}
