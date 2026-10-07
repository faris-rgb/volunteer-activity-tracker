"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertActionRole } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { MANAGER_ROLES } from "@/lib/roles";
import { isSanityConfigured, sanityClient, sanityWriteClient } from "@/lib/sanity";
import { formatDateKey, toDateKey } from "@/lib/dates";
import { listMockAttendance } from "@/lib/mockAttendanceStore";
import {
  ALLOWANCE_TYPES,
  ARRIVAL_AIRPORTS,
  PICKUP_STATUSES,
  STAY_STATUSES,
  YOUTHPASS_STATUSES,
  type AllowancePayment,
  type AllowanceType,
  type ArrivalAirportCode,
  type PickupStatus,
  type Stay,
  type StayDocuments,
  type StayStatus,
  type VolunteerProfileExtras,
  type YouthpassStatus,
} from "@/lib/domain";
import { getVolunteersAction, type VolunteerData } from "@/app/actions/volunteers";
import { getProjectsAction } from "@/app/actions/projects";
import { getRoomsAction } from "@/app/actions/rooms";
import { getActivitiesResultAction } from "@/app/actions/activities";

/** Everything the form edits. Allowance payments are changed through their own actions. */
export type StayInput = Omit<Stay, "_id" | "createdAt" | "allowances">;

export type AllowancePaymentInput = Omit<AllowancePayment, "_key">;

/** Data for the printable certificate of participation (/certificates/[stayId]). */
export interface StayCertificateData {
  stay: Stay;
  volunteer: { firstName: string; lastName: string; nationality?: string; country?: string } | null;
  project: {
    _id: string;
    name: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    escProjectCode?: string;
  } | null;
  /** Sum of attendance hours (Present/Late) on activities dated within the stay. Missing hours count as 0. */
  totalHours: number;
  activitiesAttended: number;
  /** Titles of attended activities, oldest first, at most 15. */
  activityTitles: string[];
  /** First and last day counted for the attendance totals ("YYYY-MM-DD"). */
  periodStart?: string;
  periodEnd?: string;
}

/** Errors whose message is safe and useful to show to the user. */
class StayError extends Error {}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const KEY_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const FLIGHT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]*$/;
const MAX_ALLOWANCES = 500;
const MAX_CERTIFICATE_TITLES = 15;
const AIRPORT_CODES = ARRIVAL_AIRPORTS.map((airport) => airport.code) as readonly string[];

const STAY_PROJECTION = `{
  _id,
  "volunteerId": volunteer._ref,
  "projectId": project._ref,
  status,
  arrivalDate,
  departureDate,
  arrivalTime,
  arrivalAirport,
  flightNumber,
  pickupBy,
  pickupStatus,
  "roomId": room._ref,
  documents,
  youthpassStatus,
  "allowances": allowances[]{ _key, type, date, amount, currency, note },
  notes,
  "createdAt": coalesce(createdAt, _createdAt)
}`;

// In-memory store used only when no Sanity project is configured.
let mockStays: Stay[] = [];

/* ---------- Parsing & normalisation ---------- */

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function readText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new StayError(`${label} is invalid.`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new StayError(`${label} must be at most ${max} characters.`);
  }
  return text || undefined;
}

function readDate(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !isValidDate(value)) {
    throw new StayError(`${label} must be a valid date (YYYY-MM-DD).`);
  }
  return value;
}

function readBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new StayError(`${label} is invalid.`);
  }
  return value;
}

function readId(value: unknown, label: string, { required = false } = {}): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new StayError(`${label} is required.`);
    }
    return undefined;
  }
  if (typeof value !== "string" || !ID_PATTERN.test(value) || value.startsWith("drafts.") || value.startsWith("versions.")) {
    throw new StayError(`Invalid ${label.toLowerCase()}.`);
  }
  return value;
}

function parseStayId(value: unknown): string {
  return readId(value, "Stay", { required: true }) as string;
}

function parseDocuments(value: unknown): StayDocuments | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new StayError("Documents checklist is invalid.");
  }
  const data = value as Record<string, unknown>;
  const documents: StayDocuments = {
    passportChecked: readBoolean(data.passportChecked, "Passport checked"),
    passportExpiry: readDate(data.passportExpiry, "Passport expiry"),
    insuranceProvider: readText(data.insuranceProvider, "Insurance provider", 100),
    insurancePolicyNumber: readText(data.insurancePolicyNumber, "Insurance policy number", 60),
    criminalRecordDate: readDate(data.criminalRecordDate, "Criminal record date"),
    agreementSigned: readBoolean(data.agreementSigned, "Agreement signed"),
    photoConsent: readBoolean(data.photoConsent, "Photo consent"),
  };
  const cleaned = stripUndefined(documents);
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function parseStayInput(input: unknown): StayInput {
  if (!input || typeof input !== "object") {
    throw new StayError("Invalid stay details.");
  }
  const data = input as Record<string, unknown>;

  const volunteerId = readId(data.volunteerId, "Volunteer", { required: true }) as string;
  const projectId = readId(data.projectId, "Project");
  const roomId = readId(data.roomId, "Room");

  if (!oneOf(STAY_STATUSES, data.status)) {
    throw new StayError("Choose a valid stay status.");
  }
  const status: StayStatus = data.status;

  const arrivalDate = readDate(data.arrivalDate, "Arrival date");
  const departureDate = readDate(data.departureDate, "Departure date");
  if (arrivalDate && departureDate && departureDate <= arrivalDate) {
    throw new StayError("Departure must be after the arrival date.");
  }
  if ((status === "arrived" || status === "completed") && !arrivalDate) {
    throw new StayError("Set the arrival date before marking the stay as arrived or completed.");
  }
  if (roomId && (!arrivalDate || !departureDate)) {
    throw new StayError("Set both arrival and departure dates to assign a room.");
  }

  const arrivalTime = readText(data.arrivalTime, "Arrival time", 5);
  if (arrivalTime && !TIME_PATTERN.test(arrivalTime)) {
    throw new StayError("Arrival time must be a 24-hour time (HH:mm).");
  }

  let arrivalAirport: ArrivalAirportCode | undefined;
  if (data.arrivalAirport !== undefined && data.arrivalAirport !== null && data.arrivalAirport !== "") {
    if (typeof data.arrivalAirport !== "string" || !AIRPORT_CODES.includes(data.arrivalAirport)) {
      throw new StayError("Choose a valid arrival airport.");
    }
    arrivalAirport = data.arrivalAirport as ArrivalAirportCode;
  }

  const flightNumber = readText(data.flightNumber, "Flight number", 20)?.toUpperCase();
  if (flightNumber && !FLIGHT_PATTERN.test(flightNumber)) {
    throw new StayError("Flight number may only contain letters, digits, spaces and dashes.");
  }

  const pickupBy = readText(data.pickupBy, "Pickup by", 80);

  let pickupStatus: PickupStatus | undefined;
  if (data.pickupStatus !== undefined && data.pickupStatus !== null && data.pickupStatus !== "") {
    if (!oneOf(PICKUP_STATUSES, data.pickupStatus)) {
      throw new StayError("Choose a valid pickup status.");
    }
    pickupStatus = data.pickupStatus;
  }

  let youthpassStatus: YouthpassStatus | undefined;
  if (data.youthpassStatus !== undefined && data.youthpassStatus !== null && data.youthpassStatus !== "") {
    if (!oneOf(YOUTHPASS_STATUSES, data.youthpassStatus)) {
      throw new StayError("Choose a valid Youthpass status.");
    }
    youthpassStatus = data.youthpassStatus;
  }

  return {
    volunteerId,
    projectId,
    status,
    arrivalDate,
    departureDate,
    arrivalTime,
    arrivalAirport,
    flightNumber,
    pickupBy,
    pickupStatus,
    roomId,
    documents: parseDocuments(data.documents),
    youthpassStatus,
    notes: readText(data.notes, "Notes", 2000),
  };
}

function parseAllowanceInput(input: unknown): AllowancePaymentInput {
  if (!input || typeof input !== "object") {
    throw new StayError("Invalid payment details.");
  }
  const data = input as Record<string, unknown>;
  if (!oneOf(ALLOWANCE_TYPES, data.type)) {
    throw new StayError("Choose a valid allowance type.");
  }
  const date = readDate(data.date, "Payment date");
  if (!date) {
    throw new StayError("Payment date is required.");
  }
  const amount = typeof data.amount === "number" ? data.amount : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    throw new StayError("Amount must be a positive number (at most 1,000,000).");
  }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    throw new StayError("Amount can have at most 2 decimals.");
  }
  if (data.currency !== "MAD" && data.currency !== "EUR") {
    throw new StayError("Currency must be MAD or EUR.");
  }
  return {
    type: data.type as AllowanceType,
    date,
    amount: Math.round(amount * 100) / 100,
    currency: data.currency,
    note: readText(data.note, "Note", 200),
  };
}

type RawStay = { [K in keyof Stay]?: Stay[K] | null } & { _id: string };

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeDocuments(value: unknown): StayDocuments | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const documents = stripUndefined<StayDocuments>({
    passportChecked: typeof data.passportChecked === "boolean" ? data.passportChecked : undefined,
    passportExpiry: toDateKey(data.passportExpiry as string | undefined) || undefined,
    insuranceProvider: cleanText(data.insuranceProvider),
    insurancePolicyNumber: cleanText(data.insurancePolicyNumber),
    criminalRecordDate: toDateKey(data.criminalRecordDate as string | undefined) || undefined,
    agreementSigned: typeof data.agreementSigned === "boolean" ? data.agreementSigned : undefined,
    photoConsent: typeof data.photoConsent === "boolean" ? data.photoConsent : undefined,
  });
  return Object.keys(documents).length > 0 ? documents : undefined;
}

function normalizeAllowances(value: unknown): AllowancePayment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item): AllowancePayment[] => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const data = item as Record<string, unknown>;
    const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
    if (typeof data._key !== "string" || !oneOf(ALLOWANCE_TYPES, data.type) || !Number.isFinite(amount)) {
      return [];
    }
    return [
      {
        _key: data._key,
        type: data.type,
        date: toDateKey(data.date as string | undefined),
        amount,
        currency: data.currency === "EUR" ? "EUR" : "MAD",
        note: cleanText(data.note),
      },
    ];
  });
}

function normalizeStay(doc: RawStay): Stay {
  return stripUndefined<Stay>({
    _id: doc._id,
    volunteerId: doc.volunteerId ?? "",
    projectId: doc.projectId ?? undefined,
    status: oneOf(STAY_STATUSES, doc.status) ? doc.status : "planned",
    arrivalDate: toDateKey(doc.arrivalDate) || undefined,
    departureDate: toDateKey(doc.departureDate) || undefined,
    arrivalTime: cleanText(doc.arrivalTime),
    arrivalAirport: doc.arrivalAirport && AIRPORT_CODES.includes(doc.arrivalAirport) ? doc.arrivalAirport : undefined,
    flightNumber: cleanText(doc.flightNumber),
    pickupBy: cleanText(doc.pickupBy),
    pickupStatus: oneOf(PICKUP_STATUSES, doc.pickupStatus) ? doc.pickupStatus : undefined,
    roomId: doc.roomId ?? undefined,
    documents: normalizeDocuments(doc.documents),
    youthpassStatus: oneOf(YOUTHPASS_STATUSES, doc.youthpassStatus) ? doc.youthpassStatus : undefined,
    allowances: normalizeAllowances(doc.allowances),
    notes: cleanText(doc.notes),
    createdAt: cleanText(doc.createdAt),
  }) as Stay;
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function reference(id: string) {
  return { _type: "reference", _ref: id };
}

/** Sanity fields to set and to unset for a validated input. */
function toSanityFields(data: StayInput): { set: Record<string, unknown>; unset: string[] } {
  const values: Record<string, unknown> = {
    volunteer: reference(data.volunteerId),
    project: data.projectId ? reference(data.projectId) : undefined,
    status: data.status,
    arrivalDate: data.arrivalDate,
    departureDate: data.departureDate,
    arrivalTime: data.arrivalTime,
    arrivalAirport: data.arrivalAirport,
    flightNumber: data.flightNumber,
    pickupBy: data.pickupBy,
    pickupStatus: data.pickupStatus,
    room: data.roomId ? reference(data.roomId) : undefined,
    documents: data.documents,
    youthpassStatus: data.youthpassStatus,
    notes: data.notes,
  };
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      unset.push(key);
    } else {
      set[key] = value;
    }
  }
  return { set, unset };
}

/* ---------- Errors, auth, revalidation ---------- */

function sanityStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return undefined;
}

async function authorize() {
  try {
    return await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    throw new StayError(error instanceof Error && error.message ? error.message : "You do not have permission to do this.");
  }
}

function failure(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof StayError) {
    return actionError(error);
  }
  console.error(fallback, error);
  const statusCode = sanityStatusCode(error);
  if (statusCode === 401 || statusCode === 403) {
    return actionError(null, "Sanity rejected the request. Check the API token permissions and try again.");
  }
  return actionError(null, fallback);
}

function revalidateStayPages() {
  revalidatePath("/stays");
  revalidatePath("/projects");
  revalidatePath("/");
}

/* ---------- Data access ---------- */

async function loadStays(): Promise<Stay[]> {
  if (!isSanityConfigured()) {
    return mockStays.map((stay) => ({ ...stay, allowances: [...(stay.allowances ?? [])] }));
  }
  const docs = await sanityClient.fetch<RawStay[]>(
    `*[_type == "stay"] | order(coalesce(arrivalDate, "9999-12-31") asc, arrivalTime asc)${STAY_PROJECTION}`
  );
  return docs.map(normalizeStay);
}

async function fetchStay(id: string): Promise<Stay | null> {
  if (!isSanityConfigured()) {
    const stay = mockStays.find((item) => item._id === id);
    return stay ? { ...stay, allowances: [...(stay.allowances ?? [])] } : null;
  }
  const doc = await sanityClient.fetch<RawStay | null>(`*[_type == "stay" && _id == $id][0]${STAY_PROJECTION}`, { id });
  return doc ? normalizeStay(doc) : null;
}

async function fetchExistingStay(id: string): Promise<Stay> {
  const stay = await fetchStay(id);
  if (!stay) {
    throw new StayError("Stay not found. It may have been deleted.");
  }
  return stay;
}

/** Checks that the referenced volunteer, project and room exist and have the expected document type. */
async function assertReferences(data: Pick<StayInput, "volunteerId" | "projectId" | "roomId">) {
  const refs = [
    { id: data.volunteerId, type: "volunteer", label: "The selected volunteer" },
    ...(data.projectId ? [{ id: data.projectId, type: "project", label: "The selected project" }] : []),
    ...(data.roomId ? [{ id: data.roomId, type: "room", label: "The selected room" }] : []),
  ];

  if (!isSanityConfigured()) {
    const [volunteers, projects, rooms] = await Promise.all([
      getVolunteersAction(),
      data.projectId ? getProjectsAction() : Promise.resolve([]),
      data.roomId ? getRoomsAction() : Promise.resolve([]),
    ]);
    const known: Record<string, Set<string>> = {
      volunteer: new Set(volunteers.map((item) => item._id)),
      project: new Set(projects.map((item) => item._id)),
      room: new Set(rooms.map((item) => item._id)),
    };
    for (const ref of refs) {
      if (!known[ref.type].has(ref.id)) {
        throw new StayError(`${ref.label} no longer exists. Reload the page and try again.`);
      }
    }
    return;
  }

  const docs = await sanityClient.fetch<{ _id: string; _type: string }[]>(`*[_id in $ids]{ _id, _type }`, {
    ids: refs.map((ref) => ref.id),
  });
  for (const ref of refs) {
    const doc = docs.find((item) => item._id === ref.id);
    if (!doc || doc._type !== ref.type) {
      throw new StayError(`${ref.label} no longer exists. Reload the page and try again.`);
    }
  }
}

function newKey(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

/* ---------- Reads ---------- */

/** All stays, ordered by arrival date. Managers only; throws when Sanity cannot be read. */
export async function getStaysAction(): Promise<Stay[]> {
  await assertActionRole(MANAGER_ROLES);
  try {
    return await loadStays();
  } catch (error) {
    console.error("Failed to load stays from Sanity:", error);
    throw new Error("Could not load stays. Please try again.");
  }
}

/* ---------- Stay CRUD ---------- */

export async function createStayAction(input: StayInput): Promise<ActionResult<Stay>> {
  try {
    await authorize();
    const data = parseStayInput(input);
    await assertReferences(data);
    const createdAt = new Date().toISOString();

    if (!isSanityConfigured()) {
      const stay: Stay = stripUndefined({ ...data, _id: `stay-${newKey()}`, allowances: [], createdAt });
      mockStays = [...mockStays, stay];
      revalidateStayPages();
      return actionOk(stay);
    }

    const { set } = toSanityFields(data);
    const created = await sanityWriteClient.create({ _type: "stay", ...set, allowances: [], createdAt });
    revalidateStayPages();
    return actionOk((await fetchStay(created._id)) ?? stripUndefined({ ...data, _id: created._id, allowances: [], createdAt }));
  } catch (error) {
    return failure(error, "Could not create the stay. Please try again.");
  }
}

export async function updateStayAction(id: string, input: StayInput): Promise<ActionResult<Stay>> {
  try {
    await authorize();
    const stayId = parseStayId(id);
    const data = parseStayInput(input);
    const current = await fetchExistingStay(stayId);
    await assertReferences(data);

    if (!isSanityConfigured()) {
      const updated: Stay = stripUndefined({
        ...data,
        _id: stayId,
        allowances: current.allowances ?? [],
        createdAt: current.createdAt,
      });
      mockStays = mockStays.map((stay) => (stay._id === stayId ? updated : stay));
      revalidateStayPages();
      return actionOk(updated);
    }

    const { set, unset } = toSanityFields(data);
    let patch = sanityWriteClient.patch(stayId).set(set);
    if (unset.length > 0) {
      patch = patch.unset(unset);
    }
    await patch.commit();
    revalidateStayPages();
    return actionOk(await fetchExistingStay(stayId));
  } catch (error) {
    return failure(error, "Could not save the stay. Please try again.");
  }
}

/**
 * Quick pickup update from the arrivals board. "Picked up" also marks a planned/confirmed stay as arrived.
 */
export async function updateStayPickupAction(id: string, pickupStatus: PickupStatus): Promise<ActionResult<Stay>> {
  try {
    await authorize();
    const stayId = parseStayId(id);
    if (!oneOf(PICKUP_STATUSES, pickupStatus)) {
      throw new StayError("Choose a valid pickup status.");
    }
    const current = await fetchExistingStay(stayId);
    if (current.status === "cancelled") {
      throw new StayError("This stay is cancelled. Reopen it before updating the pickup.");
    }
    const changes: Partial<Stay> = { pickupStatus };
    if (pickupStatus === "picked_up" && (current.status === "planned" || current.status === "confirmed")) {
      if (!current.arrivalDate) {
        throw new StayError("Set the arrival date before marking the volunteer as picked up.");
      }
      changes.status = "arrived";
    }

    if (!isSanityConfigured()) {
      const updated: Stay = { ...current, ...changes };
      mockStays = mockStays.map((stay) => (stay._id === stayId ? updated : stay));
      revalidateStayPages();
      return actionOk(updated);
    }

    await sanityWriteClient.patch(stayId).set(changes).commit();
    revalidateStayPages();
    return actionOk({ ...current, ...changes });
  } catch (error) {
    return failure(error, "Could not update the pickup. Please try again.");
  }
}

/** Deletes a stay together with its allowance ledger. */
export async function deleteStayAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await authorize();
    const stayId = parseStayId(id);

    if (!isSanityConfigured()) {
      if (!mockStays.some((stay) => stay._id === stayId)) {
        throw new StayError("Stay not found. It may already have been deleted.");
      }
      mockStays = mockStays.filter((stay) => stay._id !== stayId);
      revalidateStayPages();
      return actionOk({ id: stayId });
    }

    const linked = await sanityClient.fetch<{ exists: boolean; draftIds: string[] }>(
      `{ "exists": defined(*[_type == "stay" && _id == $id][0]._id), "draftIds": *[_id == $draftId]._id }`,
      { id: stayId, draftId: `drafts.${stayId}` },
      { perspective: "raw" }
    );
    if (!linked.exists) {
      throw new StayError("Stay not found. It may already have been deleted.");
    }
    const transaction = sanityWriteClient.transaction();
    for (const docId of [...linked.draftIds, stayId]) {
      transaction.delete(docId);
    }
    await transaction.commit();
    revalidateStayPages();
    return actionOk({ id: stayId });
  } catch (error) {
    if (sanityStatusCode(error) === 409) {
      console.error("Stay delete blocked by references:", error);
      return actionError(null, "Other documents in Sanity still reference this stay, so it can't be deleted yet.");
    }
    return failure(error, "Could not delete the stay. Please try again.");
  }
}

/* ---------- Allowance ledger ---------- */

export async function addAllowancePaymentAction(
  stayId: string,
  payment: AllowancePaymentInput
): Promise<ActionResult<Stay>> {
  try {
    await authorize();
    const id = parseStayId(stayId);
    const data = parseAllowanceInput(payment);
    const current = await fetchExistingStay(id);
    if ((current.allowances?.length ?? 0) >= MAX_ALLOWANCES) {
      throw new StayError(`A stay can hold at most ${MAX_ALLOWANCES} payments.`);
    }
    const item: AllowancePayment = stripUndefined({ _key: newKey(), ...data });

    if (!isSanityConfigured()) {
      const updated: Stay = { ...current, allowances: [...(current.allowances ?? []), item] };
      mockStays = mockStays.map((stay) => (stay._id === id ? updated : stay));
      revalidateStayPages();
      return actionOk(updated);
    }

    await sanityWriteClient
      .patch(id)
      .setIfMissing({ allowances: [] })
      .append("allowances", [{ _type: "allowancePayment", ...item }])
      .commit({ autoGenerateArrayKeys: false });
    revalidateStayPages();
    return actionOk(await fetchExistingStay(id));
  } catch (error) {
    return failure(error, "Could not record the payment. Please try again.");
  }
}

export async function removeAllowancePaymentAction(stayId: string, paymentKey: string): Promise<ActionResult<Stay>> {
  try {
    await authorize();
    const id = parseStayId(stayId);
    if (typeof paymentKey !== "string" || !KEY_PATTERN.test(paymentKey)) {
      throw new StayError("Invalid payment.");
    }
    const current = await fetchExistingStay(id);
    if (!(current.allowances ?? []).some((item) => item._key === paymentKey)) {
      throw new StayError("This payment was already removed.");
    }

    if (!isSanityConfigured()) {
      const updated: Stay = { ...current, allowances: (current.allowances ?? []).filter((item) => item._key !== paymentKey) };
      mockStays = mockStays.map((stay) => (stay._id === id ? updated : stay));
      revalidateStayPages();
      return actionOk(updated);
    }

    await sanityWriteClient.patch(id).unset([`allowances[_key=="${paymentKey}"]`]).commit();
    revalidateStayPages();
    return actionOk(await fetchExistingStay(id));
  } catch (error) {
    return failure(error, "Could not remove the payment. Please try again.");
  }
}

/* ---------- Certificate ---------- */

type CertificateVolunteer = Pick<VolunteerData, "_id" | "firstName" | "lastName" | "country"> &
  Pick<VolunteerProfileExtras, "nationality">;

interface AttendedActivity {
  title: string;
  date: string;
  hours: number;
}

function readHours(value: unknown): number {
  const hours = typeof value === "number" ? value : Number(value);
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

/** Everything needed to print a certificate of participation for one stay. Managers only. */
export async function getStayCertificateAction(stayId: string): Promise<ActionResult<StayCertificateData>> {
  try {
    await authorize();
    const id = parseStayId(stayId);
    const stay = await fetchExistingStay(id);

    let volunteer: CertificateVolunteer | null = null;
    let project: StayCertificateData["project"] = null;
    let attended: AttendedActivity[] = [];

    if (!isSanityConfigured()) {
      const [volunteers, projects, activities] = await Promise.all([
        getVolunteersAction(),
        stay.projectId ? getProjectsAction() : Promise.resolve([]),
        getActivitiesResultAction(),
      ]);
      const vol = volunteers.find((item) => item._id === stay.volunteerId) as
        | (VolunteerData & VolunteerProfileExtras)
        | undefined;
      volunteer = vol
        ? { _id: vol._id, firstName: vol.firstName, lastName: vol.lastName, country: vol.country, nationality: vol.nationality }
        : null;
      const proj = projects.find((item) => item._id === stay.projectId);
      project = proj
        ? {
            _id: proj._id,
            name: proj.name,
            location: proj.location,
            startDate: proj.startDate,
            endDate: proj.endDate,
            escProjectCode: proj.escProjectCode,
          }
        : null;
      if (!activities.ok) {
        throw new StayError(activities.error);
      }
      const activityById = new Map(activities.data.map((activity) => [activity._id, activity]));
      attended = listMockAttendance()
        .filter((record) => record.volunteerId === stay.volunteerId && (record.status === "Present" || record.status === "Late"))
        .flatMap((record) => {
          const activity = activityById.get(record.activityId);
          return activity
            ? [{ title: activity.title, date: activity.date, hours: readHours((record as { hours?: unknown }).hours) }]
            : [];
        });
    } else {
      const result = await sanityClient.fetch<{
        volunteer: CertificateVolunteer | null;
        project: (NonNullable<StayCertificateData["project"]> & { [key: string]: unknown }) | null;
        attendance: { title?: string | null; date?: string | null; hours?: unknown; status?: string | null }[];
      }>(
        `{
          "volunteer": *[_type == "volunteer" && _id == $volunteerId][0]{ _id, firstName, lastName, country, nationality },
          "project": *[_type == "project" && _id == $projectId][0]{ _id, name, location, startDate, endDate, escProjectCode },
          "attendance": *[_type == "attendance" && volunteer._ref == $volunteerId && defined(activity._ref)]{
            status,
            hours,
            "title": activity->title,
            "date": activity->date
          }
        }`,
        { volunteerId: stay.volunteerId, projectId: stay.projectId ?? "" }
      );
      volunteer = result.volunteer
        ? {
            _id: result.volunteer._id,
            firstName: result.volunteer.firstName ?? "",
            lastName: result.volunteer.lastName ?? "",
            country: cleanText(result.volunteer.country),
            nationality: cleanText(result.volunteer.nationality),
          }
        : null;
      project = result.project
        ? stripUndefined({
            _id: result.project._id,
            name: cleanText(result.project.name) ?? "Untitled project",
            location: cleanText(result.project.location),
            startDate: toDateKey(result.project.startDate) || undefined,
            endDate: toDateKey(result.project.endDate) || undefined,
            escProjectCode: cleanText(result.project.escProjectCode),
          })
        : null;
      attended = result.attendance.flatMap((record) => {
        const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
        if ((status !== "present" && status !== "late") || !record.date) {
          return [];
        }
        return [{ title: record.title?.trim() || "Untitled activity", date: record.date, hours: readHours(record.hours) }];
      });
    }

    const periodStart = stay.arrivalDate ?? project?.startDate;
    const periodEnd = stay.departureDate ?? project?.endDate ?? formatDateKey(new Date());
    const inPeriod = attended
      .map((item) => ({ ...item, date: toDateKey(item.date) }))
      .filter((item) => item.date && (!periodStart || item.date >= periodStart) && (!periodEnd || item.date <= periodEnd))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalHours = Math.round(inPeriod.reduce((sum, item) => sum + item.hours, 0) * 10) / 10;

    return actionOk({
      stay,
      volunteer: volunteer
        ? stripUndefined({
            firstName: volunteer.firstName,
            lastName: volunteer.lastName,
            nationality: volunteer.nationality,
            country: volunteer.country,
          })
        : null,
      project,
      totalHours,
      activitiesAttended: inPeriod.length,
      activityTitles: inPeriod.slice(0, MAX_CERTIFICATE_TITLES).map((item) => item.title),
      periodStart,
      periodEnd,
    });
  } catch (error) {
    return failure(error, "Could not load the certificate. Please try again.");
  }
}
