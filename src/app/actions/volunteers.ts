"use server";

import { revalidatePath } from "next/cache";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import { assertActionRole } from "@/lib/auth";
import { APP_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { listMockAttendance, removeMockAttendance } from "@/lib/mockAttendanceStore";

export interface VolunteerInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  country?: string;
  city?: string;
  languages?: string[];
  skills?: string[];
  notes?: string;
  active: boolean;
}

export interface VolunteerData extends VolunteerInput {
  _id: string;
  createdAt?: string;
  attendanceCount?: number;
}

export interface DeletedVolunteer {
  id: string;
  removedAttendance: number;
}

/** A refused delete reports the current attendance count when it no longer matches what the user confirmed. */
export type DeleteVolunteerResult =
  | ActionResult<DeletedVolunteer>
  | { ok: false; error: string; attendanceCount: number };

type VolunteerFields = Required<VolunteerInput>;

/** Errors whose message is safe and useful to show to the user. */
class VolunteerError extends Error {}

// In-memory store used only when no Sanity project is configured.
let mockVolunteers: VolunteerData[] = [];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_LIST_ITEMS = 30;

const VOLUNTEER_PROJECTION = `{
  _id,
  "firstName": coalesce(firstName, ""),
  "lastName": coalesce(lastName, ""),
  "email": coalesce(email, ""),
  "phoneNumber": coalesce(phoneNumber, ""),
  "country": coalesce(country, ""),
  "city": coalesce(city, ""),
  "languages": coalesce(languages, []),
  "skills": coalesce(skills, []),
  "notes": coalesce(notes, ""),
  "active": coalesce(active, true),
  "createdAt": coalesce(createdAt, _createdAt),
  "attendanceCount": count(*[_type == "attendance" && references(^._id)])
}`;

function readText(value: unknown, label: string, { required = false, max = 100 } = {}): string {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new VolunteerError(`${label} is invalid.`);
  }
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) {
    throw new VolunteerError(`${label} is required.`);
  }
  if (text.length > max) {
    throw new VolunteerError(`${label} must be at most ${max} characters.`);
  }
  return text;
}

function readList(value: unknown, label: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new VolunteerError(`${label} are invalid.`);
  }

  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value as string[]) {
    const item = raw.trim();
    if (!item || seen.has(item.toLowerCase())) {
      continue;
    }
    if (item.length > 50) {
      throw new VolunteerError(`Each entry in ${label.toLowerCase()} must be at most 50 characters.`);
    }
    seen.add(item.toLowerCase());
    items.push(item);
  }

  if (items.length > MAX_LIST_ITEMS) {
    throw new VolunteerError(`Add at most ${MAX_LIST_ITEMS} ${label.toLowerCase()}.`);
  }
  return items;
}

function parseVolunteerInput(input: unknown): VolunteerFields {
  if (!input || typeof input !== "object") {
    throw new VolunteerError("Invalid volunteer details.");
  }
  const data = input as Record<string, unknown>;

  const firstName = readText(data.firstName, "First name", { required: true, max: 80 });
  const lastName = readText(data.lastName, "Last name", { required: true, max: 80 });

  const email = readText(data.email, "Email", { required: true, max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new VolunteerError("Enter a valid email address.");
  }

  const phoneNumber = readText(data.phoneNumber, "Phone number", { max: 30 });
  if (phoneNumber && (!PHONE_PATTERN.test(phoneNumber) || phoneNumber.replace(/\D/g, "").length < 6)) {
    throw new VolunteerError("Enter a valid phone number (digits, spaces, +, -, parentheses).");
  }

  if (typeof data.active !== "boolean") {
    throw new VolunteerError("Active status is invalid.");
  }

  return {
    firstName,
    lastName,
    email,
    phoneNumber,
    country: readText(data.country, "Country", { max: 80 }),
    city: readText(data.city, "City", { max: 80 }),
    languages: readList(data.languages, "Languages"),
    skills: readList(data.skills, "Skills"),
    notes: readText(data.notes, "Notes", { max: 2000 }),
    active: data.active,
  };
}

function parseId(id: unknown): string {
  if (typeof id !== "string" || !ID_PATTERN.test(id) || id.startsWith("drafts.")) {
    throw new VolunteerError("Invalid volunteer id.");
  }
  return id;
}

async function fetchVolunteer(id: string): Promise<VolunteerData | null> {
  return sanityClient.fetch<VolunteerData | null>(
    `*[_type == "volunteer" && _id == $id][0]${VOLUNTEER_PROJECTION}`,
    { id }
  );
}

function withMockAttendanceCounts(volunteers: VolunteerData[]): VolunteerData[] {
  const counts = new Map<string, number>();
  for (const record of listMockAttendance()) {
    counts.set(record.volunteerId, (counts.get(record.volunteerId) ?? 0) + 1);
  }
  return volunteers.map((vol) => ({ ...vol, attendanceCount: counts.get(vol._id) ?? 0 }));
}

async function requireVolunteer(id: string): Promise<VolunteerData> {
  let volunteer: VolunteerData | null;
  if (isSanityConfigured()) {
    volunteer = await fetchVolunteer(id);
  } else {
    const mock = mockVolunteers.find((vol) => vol._id === id);
    volunteer = mock ? withMockAttendanceCounts([mock])[0] : null;
  }
  if (!volunteer) {
    throw new VolunteerError("This volunteer no longer exists. Refresh the page and try again.");
  }
  return volunteer;
}

async function assertEmailAvailable(email: string, excludeId?: string): Promise<void> {
  const taken = isSanityConfigured()
    ? (await sanityClient.fetch<number>(
        `count(*[_type == "volunteer" && lower(email) == $email && !(_id in $excludeIds)])`,
        { email, excludeIds: excludeId ? [excludeId, `drafts.${excludeId}`] : [] }
      )) > 0
    : mockVolunteers.some((vol) => vol._id !== excludeId && vol.email.toLowerCase() === email);
  if (taken) {
    throw new VolunteerError("A volunteer with this email address already exists.");
  }
}

/** The only volunteer fields non-manager roles may see. */
function toPublicVolunteer({ _id, firstName, lastName, country, skills, active }: VolunteerData): VolunteerData {
  return { _id, firstName, lastName, email: "", country, skills, active };
}

function isPublishedId(id: string): boolean {
  return !id.startsWith("drafts.") && !id.startsWith("versions.");
}

function attendanceChanged(attendanceCount: number): DeleteVolunteerResult {
  return {
    ok: false,
    error: "This volunteer's attendance history changed since you opened this dialog. Review it and confirm again.",
    attendanceCount,
  };
}

function revalidateVolunteerPages() {
  revalidatePath("/volunteers");
  revalidatePath("/attendance");
  revalidatePath("/");
}

function failure(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof VolunteerError) {
    return actionError(error);
  }
  console.error(fallback, error);
  return actionError(null, fallback);
}

export async function getVolunteersAction(): Promise<VolunteerData[]> {
  const caller = await assertActionRole([...APP_ROLES]);
  const isManager = MANAGER_ROLES.includes(caller.role);

  let volunteers: VolunteerData[];
  if (isSanityConfigured()) {
    try {
      volunteers = await sanityClient.fetch<VolunteerData[]>(
        `*[_type == "volunteer"] | order(coalesce(createdAt, _createdAt) desc)${VOLUNTEER_PROJECTION}`
      );
    } catch (error) {
      console.error("Failed to load volunteers from Sanity:", error);
      throw new Error("Could not load volunteers. Please try again.");
    }
  } else {
    volunteers = withMockAttendanceCounts(mockVolunteers);
  }

  return isManager ? volunteers : volunteers.map(toPublicVolunteer);
}

export async function createVolunteerAction(input: VolunteerInput): Promise<ActionResult<VolunteerData>> {
  try {
    await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    const fields = parseVolunteerInput(input);
    await assertEmailAvailable(fields.email);
    const createdAt = new Date().toISOString();

    let volunteer: VolunteerData;
    if (isSanityConfigured()) {
      const created = await sanityWriteClient.create({ _type: "volunteer", ...fields, createdAt });
      volunteer = { ...fields, _id: created._id, createdAt, attendanceCount: 0 };
    } else {
      volunteer = { ...fields, _id: `mock-${crypto.randomUUID()}`, createdAt, attendanceCount: 0 };
      mockVolunteers = [volunteer, ...mockVolunteers];
    }

    revalidateVolunteerPages();
    return actionOk(volunteer);
  } catch (error) {
    return failure(error, "Could not add the volunteer. Please try again.");
  }
}

export async function updateVolunteerAction(
  id: string,
  input: VolunteerInput
): Promise<ActionResult<VolunteerData>> {
  try {
    await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    const volunteerId = parseId(id);
    const fields = parseVolunteerInput(input);
    const existing = await requireVolunteer(volunteerId);
    await assertEmailAvailable(fields.email, volunteerId);

    const volunteer: VolunteerData = { ...existing, ...fields };
    if (isSanityConfigured()) {
      await sanityWriteClient.patch(volunteerId).set(fields).commit();
    } else {
      mockVolunteers = mockVolunteers.map((vol) => (vol._id === volunteerId ? volunteer : vol));
    }

    revalidateVolunteerPages();
    return actionOk(volunteer);
  } catch (error) {
    return failure(error, "Could not save the volunteer. Please try again.");
  }
}

export async function setVolunteerActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult<VolunteerData>> {
  try {
    await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    const volunteerId = parseId(id);
    if (typeof active !== "boolean") {
      throw new VolunteerError("Active status is invalid.");
    }
    const existing = await requireVolunteer(volunteerId);

    const volunteer: VolunteerData = { ...existing, active };
    if (isSanityConfigured()) {
      await sanityWriteClient.patch(volunteerId).set({ active }).commit();
    } else {
      mockVolunteers = mockVolunteers.map((vol) => (vol._id === volunteerId ? volunteer : vol));
    }

    revalidateVolunteerPages();
    return actionOk(volunteer);
  } catch (error) {
    return failure(error, "Could not update the volunteer status. Please try again.");
  }
}

export async function deleteVolunteerAction(
  id: string,
  expectedAttendance: number
): Promise<DeleteVolunteerResult> {
  try {
    await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    const volunteerId = parseId(id);
    if (!Number.isInteger(expectedAttendance) || expectedAttendance < 0) {
      throw new VolunteerError("Invalid request. Refresh the page and try again.");
    }
    const volunteer = await requireVolunteer(volunteerId);

    if (!isSanityConfigured()) {
      const attendanceCount = volunteer.attendanceCount ?? 0;
      if (attendanceCount !== expectedAttendance) {
        return attendanceChanged(attendanceCount);
      }
      const removedAttendance = removeMockAttendance({ volunteerId });
      mockVolunteers = mockVolunteers.filter((vol) => vol._id !== volunteerId);
      revalidateVolunteerPages();
      return actionOk({ id: volunteerId, removedAttendance });
    }

    // Attendance records hold strong references to the volunteer, so they are removed in the
    // same transaction; otherwise Sanity refuses to delete the volunteer.
    const attendanceIds = await sanityClient.fetch<string[]>(
      `*[_type == "attendance" && references($id)]._id`,
      { id: volunteerId },
      { perspective: "raw" }
    );
    const removedAttendance = attendanceIds.filter(isPublishedId).length;
    if (removedAttendance !== expectedAttendance) {
      return attendanceChanged(removedAttendance);
    }

    const transaction = sanityWriteClient.transaction();
    attendanceIds.forEach((attendanceId) => transaction.delete(attendanceId));
    await transaction.delete(volunteerId).delete(`drafts.${volunteerId}`).commit();

    revalidateVolunteerPages();
    return actionOk({ id: volunteerId, removedAttendance });
  } catch (error) {
    return failure(error, "Could not delete the volunteer. Please try again.");
  }
}
