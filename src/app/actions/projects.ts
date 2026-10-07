"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import { assertActionRole } from "@/lib/auth";
import { APP_ROLES, MANAGER_ROLES, type AppRole } from "@/lib/roles";
import { actionOk } from "@/lib/actionResult";
import { toDateKey } from "@/lib/dates";
import {
  FUNDING_TYPES,
  PROJECT_STATUSES,
  type FundingType,
  type Partner,
  type Project,
  type ProjectStatus,
} from "@/lib/domain";
import { ESC_PROJECT_CODE_PATTERN } from "@/sanity/schemas/project";
import { PARTNER_TYPES, type PartnerType } from "@/sanity/schemas/partner";

/* ---------- Public types ---------- */

/** A project plus how many (non-cancelled) stays and activities are linked to it. */
export type ProjectWithStats = Project & { participantCount: number; activityCount: number };

export type ProjectInput = Omit<Project, "_id" | "createdAt">;
export type PartnerInput = Omit<Partner, "_id">;

/** Records that still reference a project, so it can't be deleted. */
export interface ProjectLinks {
  activities: number;
  stays: number;
  /** Volunteers whose join-form project is a strong reference (weak ones don't block a delete). */
  applicants: number;
  other: number;
}

/** Records that still reference a partner, so it can't be deleted. */
export interface PartnerLinks {
  projects: string[];
  other: number;
}

/**
 * notFound: the document no longer exists (the client should drop it).
 * projectLinks / partnerLinks: a delete was refused because other records still reference the document.
 */
export type ProjectsFailure = {
  ok: false;
  error: string;
  notFound?: true;
  projectLinks?: ProjectLinks;
  partnerLinks?: PartnerLinks;
};
export type ProjectsResult<T> = { ok: true; data: T } | ProjectsFailure;

/* ---------- Errors ---------- */

/** Errors whose message is safe and useful to show to the user. */
class ProjectsError extends Error {}

class NotFoundError extends ProjectsError {}

class ProjectLinkedError extends ProjectsError {
  constructor(readonly links: ProjectLinks) {
    super(describeProjectLinks(links));
  }
}

class PartnerLinkedError extends ProjectsError {
  constructor(readonly links: PartnerLinks) {
    super(describePartnerLinks(links));
  }
}

/* ---------- Constants ---------- */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PUBLISHED_FILTER = `!(_id in path("drafts.**")) && !(_id in path("versions.**"))`;
const MAX_COUNTRIES = 60;
const MAX_PARTNERS = 30;

const PROJECT_PROJECTION = `{
  _id,
  name,
  description,
  status,
  startDate,
  endDate,
  location,
  maxParticipants,
  ageMin,
  ageMax,
  eligibleCountries,
  applicationDeadline,
  funding,
  escProjectCode,
  "partnerIds": partners[]._ref,
  isPublic,
  "createdAt": coalesce(createdAt, _createdAt),
  "participantCount": count(*[_type == "stay" && project._ref == ^._id && status != "cancelled"]),
  "activityCount": count(*[_type == "activity" && project._ref == ^._id])
}`;

const PARTNER_PROJECTION = `{
  _id,
  name,
  country,
  type,
  website,
  notes
}`;

/* ---------- In-memory store (only used when no Sanity project is configured) ---------- */

let mockProjects: Project[] = [];
let mockPartners: Partner[] = [];

function withMockStats(project: Project): ProjectWithStats {
  // Stays and activities live in other modules' stores, so links can't be counted without Sanity.
  return { ...project, participantCount: 0, activityCount: 0 };
}

/* ---------- Helpers ---------- */

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function describeProjectLinks({ activities, stays, applicants, other }: ProjectLinks): string {
  const parts: string[] = [];
  if (activities > 0) parts.push(pluralize(activities, "activity", "activities"));
  if (stays > 0) parts.push(pluralize(stays, "stay"));
  if (applicants > 0) parts.push(pluralize(applicants, "applicant"));
  if (other > 0) parts.push(pluralize(other, "other record"));
  const total = activities + stays + applicants + other;
  return `${joinList(parts)} ${total === 1 ? "is" : "are"} linked to this project, so it can't be deleted. Set its status to Cancelled instead to keep the history.`;
}

function describePartnerLinks({ projects, other }: PartnerLinks): string {
  const parts: string[] = [];
  if (projects.length > 0) {
    const names = projects.slice(0, 3).map((name) => `"${name}"`);
    const more = projects.length > 3 ? ` and ${projects.length - 3} more` : "";
    parts.push(`${pluralize(projects.length, "project")} (${names.join(", ")}${more})`);
  }
  if (other > 0) parts.push(pluralize(other, "other record"));
  const total = projects.length + other;
  return `This partner is linked to ${joinList(parts)}. Remove it from ${total === 1 ? "that record" : "those records"} first, then delete it.`;
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function readText(value: unknown, label: string, { required = false, max = 120 } = {}): string | undefined {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new ProjectsError(`${label} is invalid.`);
  }
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) {
    throw new ProjectsError(`${label} is required.`);
  }
  if (text.length > max) {
    throw new ProjectsError(`${label} must be ${max} characters or fewer.`);
  }
  return text || undefined;
}

function readDate(value: unknown, label: string, required: boolean): string | undefined {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new ProjectsError(`${label} is invalid.`);
  }
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    if (required) throw new ProjectsError(`${label} is required.`);
    return undefined;
  }
  if (!isValidDate(text)) {
    throw new ProjectsError(`${label} must be a valid date (YYYY-MM-DD).`);
  }
  return text;
}

function readInteger(value: unknown, label: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isInteger(number)) {
    throw new ProjectsError(`${label} must be a whole number.`);
  }
  if (number < min || number > max) {
    throw new ProjectsError(`${label} must be between ${min} and ${max.toLocaleString("en-US")}.`);
  }
  return number;
}

function readCountries(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ProjectsError("Eligible countries are invalid.");
  }
  const seen = new Set<string>();
  const countries: string[] = [];
  for (const raw of value as string[]) {
    const country = raw.trim().replace(/\s+/g, " ");
    if (!country || seen.has(country.toLowerCase())) continue;
    if (country.length > 60) {
      throw new ProjectsError("Each eligible country must be 60 characters or fewer.");
    }
    seen.add(country.toLowerCase());
    countries.push(country);
  }
  if (countries.length > MAX_COUNTRIES) {
    throw new ProjectsError(`Add at most ${MAX_COUNTRIES} eligible countries.`);
  }
  return countries;
}

function isDocumentId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ID_PATTERN.test(value) &&
    !value.startsWith("drafts.") &&
    !value.startsWith("versions.")
  );
}

function parseId(value: unknown, label: string): string {
  if (!isDocumentId(value)) {
    throw new ProjectsError(`Invalid ${label} id.`);
  }
  return value;
}

function readPartnerIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(isDocumentId)) {
    throw new ProjectsError("The selected partners are invalid. Reload the page and try again.");
  }
  const ids = Array.from(new Set(value as string[]));
  if (ids.length > MAX_PARTNERS) {
    throw new ProjectsError(`Select at most ${MAX_PARTNERS} partners.`);
  }
  return ids;
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && (PROJECT_STATUSES as readonly string[]).includes(value);
}

function isFundingType(value: unknown): value is FundingType {
  return typeof value === "string" && (FUNDING_TYPES as readonly string[]).includes(value);
}

function isPartnerType(value: unknown): value is PartnerType {
  return typeof value === "string" && (PARTNER_TYPES as readonly string[]).includes(value);
}

/** All project fields; optional ones are undefined when empty (and are unset on update). */
interface ProjectFields {
  name: string;
  description: string | undefined;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  location: string | undefined;
  maxParticipants: number | undefined;
  ageMin: number | undefined;
  ageMax: number | undefined;
  eligibleCountries: string[];
  applicationDeadline: string | undefined;
  funding: FundingType | undefined;
  escProjectCode: string | undefined;
  partnerIds: string[];
  isPublic: boolean;
}

function parseProjectInput(input: unknown): ProjectFields {
  if (!input || typeof input !== "object") {
    throw new ProjectsError("Invalid project details.");
  }
  const data = input as Record<string, unknown>;

  const name = readText(data.name, "Name", { required: true, max: 120 }) as string;
  const description = readText(data.description, "Description", { max: 2000 });
  const location = readText(data.location, "Location", { max: 120 });

  if (!isProjectStatus(data.status)) {
    throw new ProjectsError("Choose a valid project status.");
  }

  const startDate = readDate(data.startDate, "Start date", true) as string;
  const endDate = readDate(data.endDate, "End date", true) as string;
  if (endDate < startDate) {
    throw new ProjectsError("End date can't be before the start date.");
  }
  // A deadline after the start date is allowed (the form only warns about it).
  const applicationDeadline = readDate(data.applicationDeadline, "Application deadline", false);

  const maxParticipants = readInteger(data.maxParticipants, "Maximum participants", 1, 10000);
  const ageMin = readInteger(data.ageMin, "Minimum age", 0, 120);
  const ageMax = readInteger(data.ageMax, "Maximum age", 0, 120);
  if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
    throw new ProjectsError("Minimum age can't be higher than the maximum age.");
  }

  let funding: FundingType | undefined;
  if (data.funding !== undefined && data.funding !== null && data.funding !== "") {
    if (!isFundingType(data.funding)) {
      throw new ProjectsError("Choose a valid funding type.");
    }
    funding = data.funding;
  }

  const escProjectCode = readText(data.escProjectCode, "ESC project code", { max: 60 })?.toUpperCase();
  if (escProjectCode && !ESC_PROJECT_CODE_PATTERN.test(escProjectCode)) {
    throw new ProjectsError("ESC project code can only contain letters, digits and dashes.");
  }

  if (data.isPublic !== undefined && typeof data.isPublic !== "boolean") {
    throw new ProjectsError("Invalid public setting.");
  }

  return {
    name,
    description,
    status: data.status,
    startDate,
    endDate,
    location,
    maxParticipants,
    ageMin,
    ageMax,
    eligibleCountries: readCountries(data.eligibleCountries),
    applicationDeadline,
    funding,
    escProjectCode,
    partnerIds: readPartnerIds(data.partnerIds),
    isPublic: data.isPublic === true,
  };
}

/** Partner fields; optional ones are undefined when empty (and are unset on update). */
interface PartnerFields {
  name: string;
  country: string | undefined;
  type: PartnerType | undefined;
  website: string | undefined;
  notes: string | undefined;
}

function readWebsite(value: unknown): string | undefined {
  const text = readText(value, "Website", { max: 300 });
  if (!text) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ProjectsError("Website must be a valid web address, e.g. https://example.org.");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) {
    throw new ProjectsError("Website must be a valid web address, e.g. https://example.org.");
  }
  return url.toString();
}

function parsePartnerInput(input: unknown): PartnerFields {
  if (!input || typeof input !== "object") {
    throw new ProjectsError("Invalid partner details.");
  }
  const data = input as Record<string, unknown>;

  let type: PartnerType | undefined;
  if (data.type !== undefined && data.type !== null && data.type !== "") {
    if (!isPartnerType(data.type)) {
      throw new ProjectsError("Choose a valid partner type.");
    }
    type = data.type;
  }

  return {
    name: readText(data.name, "Name", { required: true, max: 120 }) as string,
    country: readText(data.country, "Country", { max: 80 }),
    type,
    website: readWebsite(data.website),
    notes: readText(data.notes, "Notes", { max: 2000 }),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

type StoredProject = Record<string, unknown> & { _id: string };

function normalizeProject(doc: StoredProject): ProjectWithStats {
  const maxParticipants = optionalInteger(doc.maxParticipants);
  return {
    _id: doc._id,
    name: optionalString(doc.name) ?? "Untitled project",
    description: optionalString(doc.description),
    status: isProjectStatus(doc.status) ? doc.status : "planned",
    startDate: toDateKey(optionalString(doc.startDate)),
    endDate: toDateKey(optionalString(doc.endDate)),
    location: optionalString(doc.location),
    maxParticipants: maxParticipants !== undefined && maxParticipants >= 1 ? maxParticipants : undefined,
    ageMin: optionalInteger(doc.ageMin),
    ageMax: optionalInteger(doc.ageMax),
    eligibleCountries: Array.isArray(doc.eligibleCountries)
      ? doc.eligibleCountries.filter((country): country is string => typeof country === "string" && !!country.trim())
      : [],
    applicationDeadline: toDateKey(optionalString(doc.applicationDeadline)) || undefined,
    funding: isFundingType(doc.funding) ? doc.funding : undefined,
    escProjectCode: optionalString(doc.escProjectCode),
    partnerIds: Array.isArray(doc.partnerIds)
      ? doc.partnerIds.filter((id): id is string => typeof id === "string" && !!id)
      : [],
    isPublic: doc.isPublic === true,
    createdAt: optionalString(doc.createdAt),
    participantCount: Number(doc.participantCount) || 0,
    activityCount: Number(doc.activityCount) || 0,
  };
}

function normalizePartner(doc: Record<string, unknown> & { _id: string }): Partner {
  return {
    _id: doc._id,
    name: optionalString(doc.name) ?? "Unnamed partner",
    country: optionalString(doc.country),
    type: isPartnerType(doc.type) ? doc.type : undefined,
    website: optionalString(doc.website),
    notes: optionalString(doc.notes),
  };
}

function sortPartners(partners: Partner[]): Partner[] {
  return [...partners].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

function fieldsToProject(fields: ProjectFields): Omit<Project, "_id" | "createdAt"> {
  return { ...fields };
}

/** Splits fields into values to set and empty keys to unset, mapping partnerIds to stored references. */
function toProjectPatch(fields: ProjectFields): { set: Record<string, unknown>; unset: string[] } {
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === "partnerIds") continue;
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      unset.push(key);
    } else {
      set[key] = value;
    }
  }
  if (fields.partnerIds.length > 0) {
    set.partners = fields.partnerIds.map((id) => ({
      _type: "reference",
      _ref: id,
      _key: randomUUID().replace(/-/g, "").slice(0, 12),
    }));
  } else {
    unset.push("partners");
  }
  return { set, unset };
}

function toPartnerPatch(fields: PartnerFields): { set: Record<string, unknown>; unset: string[] } {
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) unset.push(key);
    else set[key] = value;
  }
  return { set, unset };
}

/**
 * Patches the published document and, when one exists, its Studio draft in the same transaction,
 * so publishing a stale draft later can't silently revert the change.
 */
async function patchWithDraft(id: string, set: Record<string, unknown>, unset: string[]) {
  const draftId = `drafts.${id}`;
  const hasDraft = await sanityClient.fetch<boolean>(
    `defined(*[_id == $draftId][0]._id)`,
    { draftId },
    { perspective: "raw" }
  );
  const apply = (patch: ReturnType<typeof sanityWriteClient.patch>) => {
    let next = patch.set(set);
    if (unset.length > 0) next = next.unset(unset);
    return next;
  };
  const transaction = sanityWriteClient.transaction().patch(apply(sanityWriteClient.patch(id)));
  if (hasDraft) {
    transaction.patch(apply(sanityWriteClient.patch(draftId)));
  }
  await transaction.commit();
}

async function fetchProject(id: string): Promise<ProjectWithStats> {
  const doc = await sanityClient.fetch<StoredProject | null>(
    `*[_type == "project" && _id == $id][0]${PROJECT_PROJECTION}`,
    { id }
  );
  if (!doc) {
    throw new NotFoundError("Project not found. It may have been deleted.");
  }
  return normalizeProject(doc);
}

function findMockProject(id: string): Project {
  const project = mockProjects.find((entry) => entry._id === id);
  if (!project) {
    throw new NotFoundError("Project not found. It may have been deleted.");
  }
  return project;
}

/** Refuses partner ids that don't belong to an existing partner document. */
async function assertPartnersExist(ids: string[]) {
  if (ids.length === 0) return;
  const found = isSanityConfigured()
    ? await sanityClient.fetch<number>(`count(*[_type == "partner" && _id in $ids])`, { ids })
    : mockPartners.filter((partner) => ids.includes(partner._id)).length;
  if (found !== ids.length) {
    throw new ProjectsError("One of the selected partners no longer exists. Untick it and try again.");
  }
}

async function assertPartnerNameAvailable(name: string, excludeId?: string) {
  const lower = name.toLowerCase();
  const taken = isSanityConfigured()
    ? await sanityClient.fetch<boolean>(
        `count(*[_type == "partner" && lower(name) == $lower && _id != $excludeId]) > 0`,
        { lower, excludeId: excludeId ?? "" }
      )
    : mockPartners.some((partner) => partner._id !== excludeId && partner.name.toLowerCase() === lower);
  if (taken) {
    throw new ProjectsError(`A partner named "${name}" already exists.`);
  }
}

function hasLinks({ activities, stays, applicants, other }: ProjectLinks): boolean {
  return activities + stays + applicants + other > 0;
}

/**
 * Without Sanity, activities and stays live in their own modules' in-memory stores. They are imported
 * lazily (only on delete) so the modules, which also import this one, don't form a load-time cycle.
 */
async function countMockProjectLinks(projectId: string): Promise<ProjectLinks> {
  const [{ getActivitiesAction }, { getStaysAction }] = await Promise.all([
    import("@/app/actions/activities"),
    import("@/app/actions/stays"),
  ]);
  const [activities, stays] = await Promise.all([getActivitiesAction(), getStaysAction()]);
  return {
    activities: activities.filter((activity) => activity.projectId === projectId).length,
    stays: stays.filter((stay) => stay.projectId === projectId).length,
    applicants: 0, // join-form applications are weak references and never block a delete
    other: 0,
  };
}

function revalidateProjectPages() {
  revalidatePath("/projects");
  revalidatePath("/stays");
  revalidatePath("/activities");
  revalidatePath("/join");
  revalidatePath("/");
}

/** assertActionRole only throws user-safe messages (signed out / missing role). */
async function authorize(roles: AppRole[]) {
  try {
    return await assertActionRole(roles);
  } catch (error) {
    throw new ProjectsError(
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

/** Shows ProjectsError messages as-is; backend errors are logged and replaced with a generic message. */
function failure(error: unknown, fallback: string): ProjectsFailure {
  if (error instanceof NotFoundError) {
    revalidateProjectPages();
    return { ok: false, error: error.message, notFound: true };
  }
  if (error instanceof ProjectLinkedError) {
    return { ok: false, error: error.message, projectLinks: error.links };
  }
  if (error instanceof PartnerLinkedError) {
    return { ok: false, error: error.message, partnerLinks: error.links };
  }
  if (error instanceof ProjectsError) {
    return { ok: false, error: error.message };
  }
  console.error(fallback, error);
  const statusCode = sanityStatusCode(error);
  if (statusCode === 401 || statusCode === 403) {
    return { ok: false, error: "Sanity rejected the request. Check the API token permissions and try again." };
  }
  if (statusCode === 409) {
    return { ok: false, error: "Other records in Sanity still reference this document, so it can't be changed or deleted yet." };
  }
  return { ok: false, error: fallback };
}

/* ---------- Reads ---------- */

/** All projects with participant (non-cancelled stays) and activity counts. Readable by every role. */
export async function getProjectsAction(): Promise<ProjectWithStats[]> {
  await assertActionRole([...APP_ROLES]);
  if (!isSanityConfigured()) {
    return mockProjects.map(withMockStats);
  }
  try {
    const docs = await sanityClient.fetch<StoredProject[]>(
      `*[_type == "project"] | order(startDate desc)${PROJECT_PROJECTION}`
    );
    return docs.map(normalizeProject);
  } catch (error) {
    console.error("Failed to load projects from Sanity:", error);
    throw new Error("Could not load projects. Please try again.");
  }
}

/** All partner organisations, sorted by name. Readable by every role; internal notes only for managers. */
export async function getPartnersAction(): Promise<Partner[]> {
  const caller = await assertActionRole([...APP_ROLES]);
  const isManager = MANAGER_ROLES.includes(caller.role);

  let partners: Partner[];
  if (!isSanityConfigured()) {
    partners = mockPartners;
  } else {
    try {
      const docs = await sanityClient.fetch<(Record<string, unknown> & { _id: string })[]>(
        `*[_type == "partner"]${PARTNER_PROJECTION}`
      );
      partners = docs.map(normalizePartner);
    } catch (error) {
      console.error("Failed to load partners from Sanity:", error);
      throw new Error("Could not load partners. Please try again.");
    }
  }

  const sorted = sortPartners(partners);
  return isManager ? sorted : sorted.map((partner) => ({ ...partner, notes: undefined }));
}

/* ---------- Project mutations ---------- */

export async function createProjectAction(input: ProjectInput): Promise<ProjectsResult<ProjectWithStats>> {
  try {
    await authorize(MANAGER_ROLES);
    const fields = parseProjectInput(input);
    await assertPartnersExist(fields.partnerIds);
    const createdAt = new Date().toISOString();

    if (!isSanityConfigured()) {
      const project: Project = { ...fieldsToProject(fields), _id: `project-${randomUUID()}`, createdAt };
      mockProjects = [project, ...mockProjects];
      revalidateProjectPages();
      return actionOk(withMockStats(project));
    }

    const { set } = toProjectPatch(fields);
    const created = await sanityWriteClient.create({ _type: "project", ...set, createdAt });
    revalidateProjectPages();
    return actionOk({
      ...fieldsToProject(fields),
      _id: created._id,
      createdAt,
      participantCount: 0,
      activityCount: 0,
    });
  } catch (error) {
    return failure(error, "Could not create the project. Please try again.");
  }
}

export async function updateProjectAction(
  id: string,
  input: ProjectInput
): Promise<ProjectsResult<ProjectWithStats>> {
  try {
    await authorize(MANAGER_ROLES);
    const projectId = parseId(id, "project");
    const fields = parseProjectInput(input);
    await assertPartnersExist(fields.partnerIds);

    if (!isSanityConfigured()) {
      const existing = findMockProject(projectId);
      const updated: Project = { ...fieldsToProject(fields), _id: projectId, createdAt: existing.createdAt };
      mockProjects = mockProjects.map((project) => (project._id === projectId ? updated : project));
      revalidateProjectPages();
      return actionOk(withMockStats(updated));
    }

    const current = await fetchProject(projectId);
    const { set, unset } = toProjectPatch(fields);
    await patchWithDraft(projectId, set, unset);
    revalidateProjectPages();
    return actionOk({ ...current, ...fieldsToProject(fields) });
  } catch (error) {
    return failure(error, "Could not update the project. Please try again.");
  }
}

/** Quick status change (e.g. "Mark as cancelled" when a project can't be deleted). */
export async function setProjectStatusAction(
  id: string,
  status: ProjectStatus
): Promise<ProjectsResult<ProjectWithStats>> {
  try {
    await authorize(MANAGER_ROLES);
    const projectId = parseId(id, "project");
    if (!isProjectStatus(status)) {
      throw new ProjectsError("Choose a valid project status.");
    }

    if (!isSanityConfigured()) {
      const updated: Project = { ...findMockProject(projectId), status };
      mockProjects = mockProjects.map((project) => (project._id === projectId ? updated : project));
      revalidateProjectPages();
      return actionOk(withMockStats(updated));
    }

    const current = await fetchProject(projectId);
    await patchWithDraft(projectId, { status }, []);
    revalidateProjectPages();
    return actionOk({ ...current, status });
  } catch (error) {
    return failure(error, "Could not change the project status. Please try again.");
  }
}

/** Shows or hides a project on the public Join page. */
export async function setProjectPublicAction(
  id: string,
  isPublic: boolean
): Promise<ProjectsResult<ProjectWithStats>> {
  try {
    await authorize(MANAGER_ROLES);
    const projectId = parseId(id, "project");
    if (typeof isPublic !== "boolean") {
      throw new ProjectsError("Invalid public setting.");
    }

    if (!isSanityConfigured()) {
      const updated: Project = { ...findMockProject(projectId), isPublic };
      mockProjects = mockProjects.map((project) => (project._id === projectId ? updated : project));
      revalidateProjectPages();
      return actionOk(withMockStats(updated));
    }

    const current = await fetchProject(projectId);
    await patchWithDraft(projectId, { isPublic }, []);
    revalidateProjectPages();
    return actionOk({ ...current, isPublic });
  } catch (error) {
    return failure(error, "Could not update the Join page setting. Please try again.");
  }
}

/** Deletes a project. Refused (with projectLinks) while activities, stays or other records reference it. */
export async function deleteProjectAction(id: string): Promise<ProjectsResult<{ id: string }>> {
  try {
    await authorize(MANAGER_ROLES);
    const projectId = parseId(id, "project");

    if (!isSanityConfigured()) {
      findMockProject(projectId);
      const links = await countMockProjectLinks(projectId);
      if (hasLinks(links)) {
        throw new ProjectLinkedError(links);
      }
      mockProjects = mockProjects.filter((project) => project._id !== projectId);
      revalidateProjectPages();
      return actionOk({ id: projectId });
    }

    // Volunteers point at the project they chose on the join form with a weak reference, which doesn't
    // block a delete (the volunteer just loses the link); only strong ones are counted.
    const linked = await sanityClient.fetch<{
      exists: boolean;
      activities: number;
      stays: number;
      applicants: number;
      other: number;
      draftIds: string[];
    }>(
      `{
        "exists": defined(*[_type == "project" && _id == $id][0]._id),
        "activities": count(*[_type == "activity" && project._ref == $id && ${PUBLISHED_FILTER}]),
        "stays": count(*[_type == "stay" && project._ref == $id && ${PUBLISHED_FILTER}]),
        "applicants": count(*[_type == "volunteer" && appliedProject._ref == $id && appliedProject._weak != true && ${PUBLISHED_FILTER}]),
        "other": count(*[references($id) && !(_type in ["activity", "stay", "volunteer"]) && ${PUBLISHED_FILTER}]),
        "draftIds": *[_id == $draftId]._id
      }`,
      { id: projectId, draftId: `drafts.${projectId}` },
      { perspective: "raw" }
    );
    if (!linked.exists) {
      throw new NotFoundError("Project not found. It may already have been deleted.");
    }
    const links: ProjectLinks = {
      activities: linked.activities,
      stays: linked.stays,
      applicants: linked.applicants,
      other: linked.other,
    };
    if (hasLinks(links)) {
      throw new ProjectLinkedError(links);
    }

    const transaction = sanityWriteClient.transaction();
    for (const docId of [...linked.draftIds, projectId]) {
      transaction.delete(docId);
    }
    await transaction.commit();

    revalidateProjectPages();
    return actionOk({ id: projectId });
  } catch (error) {
    if (sanityStatusCode(error) === 409) {
      console.error("Project delete blocked by references:", error);
      return {
        ok: false,
        error:
          "Other records in Sanity (for example drafts) still reference this project, so it can't be deleted. Set its status to Cancelled instead.",
      };
    }
    return failure(error, "Could not delete the project. Please try again.");
  }
}

/* ---------- Partner mutations ---------- */

export async function createPartnerAction(input: PartnerInput): Promise<ProjectsResult<Partner>> {
  try {
    await authorize(MANAGER_ROLES);
    const fields = parsePartnerInput(input);
    await assertPartnerNameAvailable(fields.name);
    const createdAt = new Date().toISOString();

    if (!isSanityConfigured()) {
      const partner = normalizePartner({ ...fields, _id: `partner-${randomUUID()}` });
      mockPartners = [...mockPartners, partner];
      revalidateProjectPages();
      return actionOk(partner);
    }

    const { set } = toPartnerPatch(fields);
    const created = await sanityWriteClient.create({ _type: "partner", ...set, createdAt });
    revalidateProjectPages();
    return actionOk(normalizePartner({ ...fields, _id: created._id }));
  } catch (error) {
    return failure(error, "Could not add the partner. Please try again.");
  }
}

export async function updatePartnerAction(id: string, input: PartnerInput): Promise<ProjectsResult<Partner>> {
  try {
    await authorize(MANAGER_ROLES);
    const partnerId = parseId(id, "partner");
    const fields = parsePartnerInput(input);

    if (!isSanityConfigured()) {
      if (!mockPartners.some((partner) => partner._id === partnerId)) {
        throw new NotFoundError("Partner not found. It may have been deleted.");
      }
      await assertPartnerNameAvailable(fields.name, partnerId);
      const updated = normalizePartner({ ...fields, _id: partnerId });
      mockPartners = mockPartners.map((partner) => (partner._id === partnerId ? updated : partner));
      revalidateProjectPages();
      return actionOk(updated);
    }

    const exists = await sanityClient.fetch<boolean>(`defined(*[_type == "partner" && _id == $id][0]._id)`, {
      id: partnerId,
    });
    if (!exists) {
      throw new NotFoundError("Partner not found. It may have been deleted.");
    }
    await assertPartnerNameAvailable(fields.name, partnerId);
    const { set, unset } = toPartnerPatch(fields);
    await patchWithDraft(partnerId, set, unset);
    revalidateProjectPages();
    return actionOk(normalizePartner({ ...fields, _id: partnerId }));
  } catch (error) {
    return failure(error, "Could not update the partner. Please try again.");
  }
}

/** Deletes a partner. Refused (with partnerLinks) while projects or other records reference it. */
export async function deletePartnerAction(id: string): Promise<ProjectsResult<{ id: string }>> {
  try {
    await authorize(MANAGER_ROLES);
    const partnerId = parseId(id, "partner");

    if (!isSanityConfigured()) {
      if (!mockPartners.some((partner) => partner._id === partnerId)) {
        throw new NotFoundError("Partner not found. It may already have been deleted.");
      }
      const projects = mockProjects
        .filter((project) => project.partnerIds?.includes(partnerId))
        .map((project) => project.name);
      if (projects.length > 0) {
        throw new PartnerLinkedError({ projects, other: 0 });
      }
      mockPartners = mockPartners.filter((partner) => partner._id !== partnerId);
      revalidateProjectPages();
      return actionOk({ id: partnerId });
    }

    const linked = await sanityClient.fetch<{
      exists: boolean;
      projects: { name?: string | null }[];
      other: number;
      draftIds: string[];
    }>(
      `{
        "exists": defined(*[_type == "partner" && _id == $id][0]._id),
        "projects": *[_type == "project" && references($id) && ${PUBLISHED_FILTER}]{ name },
        "other": count(*[references($id) && _type != "project" && ${PUBLISHED_FILTER}]),
        "draftIds": *[_id == $draftId]._id
      }`,
      { id: partnerId, draftId: `drafts.${partnerId}` },
      { perspective: "raw" }
    );
    if (!linked.exists) {
      throw new NotFoundError("Partner not found. It may already have been deleted.");
    }
    if (linked.projects.length > 0 || linked.other > 0) {
      throw new PartnerLinkedError({
        projects: linked.projects
          .map((project) => optionalString(project.name) ?? "Untitled project")
          .sort((a, b) => a.localeCompare(b)),
        other: linked.other,
      });
    }

    const transaction = sanityWriteClient.transaction();
    for (const docId of [...linked.draftIds, partnerId]) {
      transaction.delete(docId);
    }
    await transaction.commit();

    revalidateProjectPages();
    return actionOk({ id: partnerId });
  } catch (error) {
    if (sanityStatusCode(error) === 409) {
      console.error("Partner delete blocked by references:", error);
      return {
        ok: false,
        error: "Other records in Sanity (for example drafts) still reference this partner, so it can't be deleted yet.",
      };
    }
    return failure(error, "Could not delete the partner. Please try again.");
  }
}
