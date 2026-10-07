"use server";

import { revalidatePath } from "next/cache";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import { assertActionRole, type RoleUser } from "@/lib/auth";
import { ADMIN_ROLES, APP_ROLES, MANAGER_ROLES, type AppRole } from "@/lib/roles";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { listMockAttendance, removeMockAttendance } from "@/lib/mockAttendanceStore";
import {
  APPLICATION_SOURCES,
  DIET_OPTIONS,
  PIPELINE_STAGES,
  VOLUNTEER_TYPES,
  type ApplicationSource,
  type DietOption,
  type EmergencyContact,
  type Membership,
  type PipelineStage,
  type VolunteerProfileExtras,
  type VolunteerType,
} from "@/lib/domain";

/** Profile fields managers can edit. appliedProjectId and motivation come from the public join form (read-only). */
export type VolunteerEditableExtras = Omit<VolunteerProfileExtras, "appliedProjectId" | "motivation">;

export interface VolunteerInput extends VolunteerEditableExtras {
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

export interface VolunteerData extends VolunteerInput, VolunteerProfileExtras {
  _id: string;
  createdAt?: string;
  attendanceCount?: number;
  /** Name of the project chosen on the join form, when it still exists. */
  appliedProjectName?: string;
}

export interface DeletedVolunteer {
  id: string;
  removedAttendance: number;
}

/** A refused delete reports the current attendance count when it no longer matches what the user confirmed. */
export type DeleteVolunteerResult =
  | ActionResult<DeletedVolunteer>
  | { ok: false; error: string; attendanceCount: number };

interface BaseFields {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  country: string;
  city: string;
  languages: string[];
  skills: string[];
  notes: string;
  active: boolean;
}

/** Optional profile fields after validation; `undefined` means "clear the stored value". */
interface ExtraFields {
  volunteerType: VolunteerType | undefined;
  dateOfBirth: string | undefined;
  nationality: string | undefined;
  pipelineStage: PipelineStage | undefined;
  source: ApplicationSource | undefined;
  intakeNotes: string | undefined;
  diet: DietOption | undefined;
  membership: Membership | undefined;
  emergencyContact: EmergencyContact | undefined;
  /** Only present when the caller may edit medical notes (owner/admin). */
  medicalNotes?: string | undefined;
}

type ParsedVolunteer = BaseFields & ExtraFields;

/** Errors whose message is safe and useful to show to the user. */
class VolunteerError extends Error {}

// In-memory store used only when no Sanity project is configured.
let mockVolunteers: VolunteerData[] = [];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIST_ITEMS = 30;
const MAX_PAYMENT_AMOUNT = 100_000;
const CURRENCIES = ["MAD", "EUR"] as const;

const EXTRA_KEYS = [
  "volunteerType",
  "dateOfBirth",
  "nationality",
  "pipelineStage",
  "source",
  "intakeNotes",
  "diet",
  "membership",
  "emergencyContact",
  "medicalNotes",
] as const satisfies readonly (keyof ExtraFields)[];

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
  "attendanceCount": count(*[_type == "attendance" && references(^._id)]),
  volunteerType,
  dateOfBirth,
  nationality,
  pipelineStage,
  source,
  intakeNotes,
  diet,
  membership,
  emergencyContact,
  medicalNotes,
  motivation,
  "appliedProjectId": coalesce(appliedProject._ref, appliedProjectId),
  "appliedProjectName": coalesce(
    appliedProject->name,
    *[_type == "project" && _id == ^.appliedProjectId][0].name
  )
}`;

/* ---------- Input parsing ---------- */

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

function readOptionalText(value: unknown, label: string, max: number): string | undefined {
  return readText(value, label, { max }) || undefined;
}

function readPhone(value: unknown, label: string): string {
  const phone = readText(value, label, { max: 30 });
  if (phone && (!PHONE_PATTERN.test(phone) || phone.replace(/\D/g, "").length < 6)) {
    throw new VolunteerError(`Enter a valid ${label.toLowerCase()} (digits, spaces, +, -, parentheses).`);
  }
  return phone;
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

function readEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new VolunteerError(`${label} is invalid.`);
  }
  return value as T;
}

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function readDate(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !isRealDate(value) || value < "1900-01-01" || value > "2200-12-31") {
    throw new VolunteerError(`${label} must be a valid date.`);
  }
  return value;
}

/** Latest date accepted as "not in the future": tomorrow in UTC, so every time zone's today passes. */
function latestPastDateKey(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function readMembership(value: unknown): Membership | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new VolunteerError("Membership details are invalid.");
  }
  const data = value as Record<string, unknown>;
  if (data.isMember !== undefined && typeof data.isMember !== "boolean") {
    throw new VolunteerError("Membership status is invalid.");
  }

  const isMember = data.isMember === true;
  const memberSince = readDate(data.memberSince, "Member since");
  const paidUntil = readDate(data.paidUntil, "Paid until");
  if (memberSince && memberSince > latestPastDateKey()) {
    throw new VolunteerError("Member since cannot be in the future.");
  }
  if (memberSince && paidUntil && paidUntil < memberSince) {
    throw new VolunteerError("Paid until cannot be before the member-since date.");
  }

  let lastPaymentAmount: number | undefined;
  if (data.lastPaymentAmount !== undefined && data.lastPaymentAmount !== null && data.lastPaymentAmount !== "") {
    const amount = data.lastPaymentAmount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > MAX_PAYMENT_AMOUNT) {
      throw new VolunteerError(`Last payment amount must be a number between 0 and ${MAX_PAYMENT_AMOUNT}.`);
    }
    lastPaymentAmount = Math.round(amount * 100) / 100;
  }
  const lastPaymentCurrency = readEnum(data.lastPaymentCurrency, CURRENCIES, "Payment currency");
  if (lastPaymentAmount !== undefined && !lastPaymentCurrency) {
    throw new VolunteerError("Choose the currency of the last payment.");
  }

  if (!isMember && !memberSince && !paidUntil && lastPaymentAmount === undefined) {
    return undefined;
  }
  return withoutUndefined({
    isMember,
    memberSince,
    paidUntil,
    lastPaymentAmount,
    lastPaymentCurrency: lastPaymentAmount !== undefined ? lastPaymentCurrency : undefined,
  });
}

function readEmergencyContact(value: unknown): EmergencyContact | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new VolunteerError("Emergency contact details are invalid.");
  }
  const data = value as Record<string, unknown>;
  const contact = withoutUndefined({
    name: readOptionalText(data.name, "Emergency contact name", 100),
    phone: readPhone(data.phone, "Emergency contact phone") || undefined,
    relation: readOptionalText(data.relation, "Emergency contact relation", 60),
  });
  return Object.keys(contact).length > 0 ? contact : undefined;
}

function parseVolunteerInput(input: unknown, { canEditMedical }: { canEditMedical: boolean }): ParsedVolunteer {
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

  if (typeof data.active !== "boolean") {
    throw new VolunteerError("Active status is invalid.");
  }

  const dateOfBirth = readDate(data.dateOfBirth, "Date of birth");
  if (dateOfBirth && dateOfBirth > latestPastDateKey()) {
    throw new VolunteerError("Date of birth cannot be in the future.");
  }

  const parsed: ParsedVolunteer = {
    firstName,
    lastName,
    email,
    phoneNumber: readPhone(data.phoneNumber, "Phone number"),
    country: readText(data.country, "Country", { max: 80 }),
    city: readText(data.city, "City", { max: 80 }),
    languages: readList(data.languages, "Languages"),
    skills: readList(data.skills, "Skills"),
    notes: readText(data.notes, "Notes", { max: 2000 }),
    active: data.active,
    volunteerType: readEnum(data.volunteerType, VOLUNTEER_TYPES, "Volunteer type"),
    dateOfBirth,
    nationality: readOptionalText(data.nationality, "Nationality", 80),
    pipelineStage: readEnum(data.pipelineStage, PIPELINE_STAGES, "Pipeline stage"),
    source: readEnum(data.source, APPLICATION_SOURCES, "Application source"),
    intakeNotes: readOptionalText(data.intakeNotes, "Intake notes", 2000),
    diet: readEnum(data.diet, DIET_OPTIONS, "Diet"),
    membership: readMembership(data.membership),
    emergencyContact: readEmergencyContact(data.emergencyContact),
  };
  if (canEditMedical) {
    parsed.medicalNotes = readOptionalText(data.medicalNotes, "Medical notes", 2000);
  }
  return parsed;
}

function parseId(id: unknown): string {
  if (typeof id !== "string" || !ID_PATTERN.test(id) || id.startsWith("drafts.")) {
    throw new VolunteerError("Invalid volunteer id.");
  }
  return id;
}

/* ---------- Output normalisation ---------- */

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function optionalDate(value: unknown): string | undefined {
  return typeof value === "string" && isRealDate(value) ? value : undefined;
}

function normalizeMembership(value: unknown): Membership | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const amount = data.lastPaymentAmount;
  return withoutUndefined({
    isMember: data.isMember === true,
    memberSince: optionalDate(data.memberSince),
    paidUntil: optionalDate(data.paidUntil),
    lastPaymentAmount: typeof amount === "number" && Number.isFinite(amount) ? amount : undefined,
    lastPaymentCurrency: optionalEnum(data.lastPaymentCurrency, CURRENCIES),
  });
}

function normalizeEmergencyContact(value: unknown): EmergencyContact | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const contact = withoutUndefined({
    name: optionalString(data.name),
    phone: optionalString(data.phone),
    relation: optionalString(data.relation),
  });
  return Object.keys(contact).length > 0 ? contact : undefined;
}

/** Drops nulls and values outside the known presets (e.g. edited in Studio) so the UI can trust the shape. */
function normalizeVolunteer(raw: Record<string, unknown>): VolunteerData {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  return withoutUndefined<VolunteerData>({
    _id: String(raw._id),
    firstName: text(raw.firstName),
    lastName: text(raw.lastName),
    email: text(raw.email),
    phoneNumber: text(raw.phoneNumber),
    country: text(raw.country),
    city: text(raw.city),
    languages: list(raw.languages),
    skills: list(raw.skills),
    notes: text(raw.notes),
    active: raw.active !== false,
    createdAt: optionalString(raw.createdAt),
    attendanceCount: typeof raw.attendanceCount === "number" ? raw.attendanceCount : undefined,
    volunteerType: optionalEnum(raw.volunteerType, VOLUNTEER_TYPES),
    dateOfBirth: optionalDate(raw.dateOfBirth),
    nationality: optionalString(raw.nationality),
    pipelineStage: optionalEnum(raw.pipelineStage, PIPELINE_STAGES),
    source: optionalEnum(raw.source, APPLICATION_SOURCES),
    intakeNotes: optionalString(raw.intakeNotes),
    diet: optionalEnum(raw.diet, DIET_OPTIONS),
    membership: normalizeMembership(raw.membership),
    emergencyContact: normalizeEmergencyContact(raw.emergencyContact),
    medicalNotes: optionalString(raw.medicalNotes),
    motivation: optionalString(raw.motivation),
    appliedProjectId: optionalString(raw.appliedProjectId),
    appliedProjectName: optionalString(raw.appliedProjectName),
  });
}

/** The only volunteer fields non-manager roles may see. */
function toPublicVolunteer({ _id, firstName, lastName, country, skills, active, volunteerType }: VolunteerData): VolunteerData {
  return withoutUndefined({ _id, firstName, lastName, email: "", country, skills, active, volunteerType });
}

/** Strips fields the caller's role may not see: emergency contact (managers only) and medical notes (owner/admin only). */
function forRole(volunteer: VolunteerData, role: AppRole): VolunteerData {
  if (!MANAGER_ROLES.includes(role)) {
    return toPublicVolunteer(volunteer);
  }
  if (!ADMIN_ROLES.includes(role)) {
    const rest = { ...volunteer };
    delete rest.medicalNotes;
    return rest;
  }
  return volunteer;
}

/* ---------- Persistence helpers ---------- */

async function fetchVolunteer(id: string): Promise<VolunteerData | null> {
  const raw = await sanityClient.fetch<Record<string, unknown> | null>(
    `*[_type == "volunteer" && _id == $id][0]${VOLUNTEER_PROJECTION}`,
    { id }
  );
  return raw ? normalizeVolunteer(raw) : null;
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

/** Splits parsed fields into values to set and optional keys to unset (cleared in the form). */
function toPatch(fields: ParsedVolunteer): { set: Record<string, unknown>; unset: string[] } {
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      if ((EXTRA_KEYS as readonly string[]).includes(key)) {
        unset.push(key);
      }
    } else {
      set[key] = value;
    }
  }
  return { set, unset };
}

/** Merges parsed fields over an existing volunteer, dropping cleared optional values. */
function mergeVolunteer(existing: VolunteerData, fields: ParsedVolunteer): VolunteerData {
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged as unknown as VolunteerData;
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

const REFERENCE_LABELS: Record<string, [string, string]> = {
  stay: ["stay", "stays"],
  project: ["project", "projects"],
  activity: ["activity", "activities"],
};

function describeReferences(types: string[]): string {
  const counts = new Map<string, number>();
  types.forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1));
  return [...counts.entries()]
    .map(([type, count]) => {
      const [one, many] = REFERENCE_LABELS[type] ?? ["linked record", "linked records"];
      return `${count} ${count === 1 ? one : many}`;
    })
    .join(", ");
}

function revalidateVolunteerPages() {
  revalidatePath("/volunteers");
  revalidatePath("/attendance");
  revalidatePath("/stays");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

function failure(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof VolunteerError) {
    return actionError(error);
  }
  console.error(fallback, error);
  return actionError(null, fallback);
}

/* ---------- Actions ---------- */

/**
 * Lists volunteers for every signed-in role. Managers get contact and profile details (medical notes
 * only for owner/admin); the volunteer role only gets names, country, skills, type and active status.
 */
export async function getVolunteersAction(): Promise<VolunteerData[]> {
  const caller = await assertActionRole([...APP_ROLES]);

  let volunteers: VolunteerData[];
  if (isSanityConfigured()) {
    try {
      const raw = await sanityClient.fetch<Record<string, unknown>[]>(
        `*[_type == "volunteer"] | order(coalesce(createdAt, _createdAt) desc)${VOLUNTEER_PROJECTION}`
      );
      volunteers = raw.map(normalizeVolunteer);
    } catch (error) {
      console.error("Failed to load volunteers from Sanity:", error);
      throw new Error("Could not load volunteers. Please try again.");
    }
  } else {
    volunteers = withMockAttendanceCounts(mockVolunteers);
  }

  return volunteers.map((vol) => forRole(vol, caller.role));
}

export async function createVolunteerAction(input: VolunteerInput): Promise<ActionResult<VolunteerData>> {
  let caller: RoleUser;
  try {
    caller = await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    const fields = parseVolunteerInput(input, { canEditMedical: ADMIN_ROLES.includes(caller.role) });
    await assertEmailAvailable(fields.email);
    const createdAt = new Date().toISOString();
    const stored = withoutUndefined({ ...fields, createdAt });

    let volunteer: VolunteerData;
    if (isSanityConfigured()) {
      const created = await sanityWriteClient.create({ _type: "volunteer", ...stored });
      volunteer = { ...stored, _id: created._id, attendanceCount: 0 };
    } else {
      volunteer = { ...stored, _id: `mock-${crypto.randomUUID()}`, attendanceCount: 0 };
      mockVolunteers = [volunteer, ...mockVolunteers];
    }

    revalidateVolunteerPages();
    return actionOk(forRole(volunteer, caller.role));
  } catch (error) {
    return failure(error, "Could not add the volunteer. Please try again.");
  }
}

export async function updateVolunteerAction(
  id: string,
  input: VolunteerInput
): Promise<ActionResult<VolunteerData>> {
  let caller: RoleUser;
  try {
    caller = await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    const volunteerId = parseId(id);
    // Staff cannot see medical notes, so their saves never touch them.
    const fields = parseVolunteerInput(input, { canEditMedical: ADMIN_ROLES.includes(caller.role) });
    const existing = await requireVolunteer(volunteerId);
    await assertEmailAvailable(fields.email, volunteerId);

    const volunteer = mergeVolunteer(existing, fields);
    if (isSanityConfigured()) {
      const { set, unset } = toPatch(fields);
      let patch = sanityWriteClient.patch(volunteerId).set(set);
      if (unset.length > 0) {
        patch = patch.unset(unset);
      }
      await patch.commit();
    } else {
      mockVolunteers = mockVolunteers.map((vol) => (vol._id === volunteerId ? volunteer : vol));
    }

    revalidateVolunteerPages();
    return actionOk(forRole(volunteer, caller.role));
  } catch (error) {
    return failure(error, "Could not save the volunteer. Please try again.");
  }
}

/** Moves a volunteer to another application pipeline stage (pipeline board and stage selects). */
export async function updateVolunteerStageAction(
  id: string,
  stage: PipelineStage
): Promise<ActionResult<VolunteerData>> {
  let caller: RoleUser;
  try {
    caller = await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    return actionError(error, "You do not have permission to do this.");
  }

  try {
    const volunteerId = parseId(id);
    const pipelineStage = readEnum(stage, PIPELINE_STAGES, "Pipeline stage");
    if (!pipelineStage) {
      throw new VolunteerError("Choose a pipeline stage.");
    }
    const existing = await requireVolunteer(volunteerId);

    const volunteer: VolunteerData = { ...existing, pipelineStage };
    if (isSanityConfigured()) {
      await sanityWriteClient.patch(volunteerId).set({ pipelineStage }).commit();
    } else {
      mockVolunteers = mockVolunteers.map((vol) => (vol._id === volunteerId ? volunteer : vol));
    }

    revalidateVolunteerPages();
    return actionOk(forRole(volunteer, caller.role));
  } catch (error) {
    return failure(error, "Could not move the volunteer to that stage. Please try again.");
  }
}

export async function setVolunteerActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult<VolunteerData>> {
  let caller: RoleUser;
  try {
    caller = await assertActionRole(MANAGER_ROLES);
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
    return actionOk(forRole(volunteer, caller.role));
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

    // Stays and other records keep their own history, so they block the delete instead of being removed.
    const otherReferences = await sanityClient.fetch<{ _id: string; _type: string }[]>(
      `*[references($id) && _type != "attendance"]{ _id, _type }`,
      { id: volunteerId },
      { perspective: "raw" }
    );
    const blocking = otherReferences.filter((doc) => isPublishedId(doc._id));
    if (blocking.length > 0) {
      throw new VolunteerError(
        `This volunteer is linked to ${describeReferences(blocking.map((doc) => doc._type))}. ` +
          "Remove those first (for stays, on Stays & Arrivals), or deactivate the volunteer instead."
      );
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
