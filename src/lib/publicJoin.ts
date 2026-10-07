import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import { APPLICATION_SOURCE_LABELS, DEFAULT_LANGUAGES, DEFAULT_SKILLS, PROJECT_STATUSES } from "@/lib/domain";
import {
  PORTAL_SETTINGS_ID,
  contactEmailError,
  contactPhoneError,
  normalizeSocialUrl,
  socialUrlError,
} from "@/sanity/schemas/settings";
import {
  cleanLine,
  isRealDate,
  moroccoToday,
  type JoinPresets,
  type ParsedApplication,
  type PublicJoinData,
  type PublicOrgInfo,
  type PublicProject,
} from "@/app/join/joinShared";

// Server-only helpers for the public /join page and submitApplicationAction. Deliberately NOT a
// "use server" module: nothing here checks auth, so none of it may be callable from the browser.
// Only safe, public fields leave this module — never volunteer data.

const DEFAULT_ORGANIZATION_NAME = "Volunteer in Morocco";
const PUBLIC_STATUSES = ["planned", "open", "running"] as const satisfies readonly (typeof PROJECT_STATUSES)[number][];
const PUBLISHED_FILTER = `!(_id in path("drafts.**")) && !(_id in path("versions.**"))`;
const MAX_PUBLIC_PROJECTS = 50;
const MAX_TAGS = 60;
const MAX_TAG_LENGTH = 60;
const INTAKE_NOTES_MAX = 2000; // matches the volunteer schema and the volunteers action

/* ---------- Public read: organisation info + presets ---------- */

// Same lookup as the settings action: the fixed singleton first, then the newest published settings doc.
const PORTAL_SETTINGS_QUERY = `coalesce(
  *[_id == $id][0],
  *[_type == "portalSettings" && ${PUBLISHED_FILTER}] | order(_updatedAt desc)[0]
){ organizationName, contactEmail, contactPhone, instagramUrl, facebookUrl, languages, skills }`;

interface StoredSettings {
  organizationName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  instagramUrl?: unknown;
  facebookUrl?: unknown;
  languages?: unknown;
  skills?: unknown;
}

function readTags(value: unknown, defaults: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...defaults];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const tag = cleanLine(raw);
    if (!tag || tag.length > MAX_TAG_LENGTH || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags.length > 0 ? tags : [...defaults];
}

/** Returns the value only when it passes the same validation the Settings page uses. */
function safeText(value: unknown, check: (value: string) => string | null): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();
  return check(trimmed) === null ? trimmed : undefined;
}

function safeSocialUrl(value: unknown, network: "instagram" | "facebook"): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const url = normalizeSocialUrl(value);
  return socialUrlError(url, network) === null ? url : undefined;
}

function toPublicSettings(doc: StoredSettings | null): { org: PublicOrgInfo; presets: JoinPresets } {
  const name = typeof doc?.organizationName === "string" ? cleanLine(doc.organizationName).slice(0, 100) : "";
  const org: PublicOrgInfo = { organizationName: name || DEFAULT_ORGANIZATION_NAME };
  const contactEmail = safeText(doc?.contactEmail, contactEmailError);
  const contactPhone = safeText(doc?.contactPhone, contactPhoneError);
  const instagramUrl = safeSocialUrl(doc?.instagramUrl, "instagram");
  const facebookUrl = safeSocialUrl(doc?.facebookUrl, "facebook");
  if (contactEmail) org.contactEmail = contactEmail;
  if (contactPhone) org.contactPhone = contactPhone;
  if (instagramUrl) org.instagramUrl = instagramUrl;
  if (facebookUrl) org.facebookUrl = facebookUrl;
  return {
    org,
    presets: {
      languages: readTags(doc?.languages, DEFAULT_LANGUAGES),
      skills: readTags(doc?.skills, DEFAULT_SKILLS),
    },
  };
}

export async function loadPublicSettings(): Promise<{ org: PublicOrgInfo; presets: JoinPresets }> {
  if (!isSanityConfigured()) return toPublicSettings(null);
  const doc = await sanityClient.fetch<StoredSettings | null>(PORTAL_SETTINGS_QUERY, { id: PORTAL_SETTINGS_ID });
  return toPublicSettings(doc);
}

/* ---------- Public read: open projects ---------- */

const PUBLIC_PROJECT_FILTER = `_type == "project" && isPublic == true && status in $statuses && endDate >= $today && ${PUBLISHED_FILTER}`;

const PUBLIC_PROJECT_PROJECTION = `{
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
  "participantCount": count(*[_type == "stay" && project._ref == ^._id && status != "cancelled" && ${PUBLISHED_FILTER}])
}`;

interface StoredPublicProject {
  _id?: unknown;
  name?: unknown;
  description?: unknown;
  status?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  location?: unknown;
  maxParticipants?: unknown;
  ageMin?: unknown;
  ageMax?: unknown;
  eligibleCountries?: unknown;
  applicationDeadline?: unknown;
  participantCount?: unknown;
}

function wholeNumber(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

function optionalDate(value: unknown): string | undefined {
  return typeof value === "string" && isRealDate(value) ? value : undefined;
}

/** Keeps only public, display-safe fields. Returns null for anything malformed. */
function toPublicProject(doc: StoredPublicProject, today: string): PublicProject | null {
  const status = doc.status;
  if (
    typeof doc._id !== "string" ||
    typeof doc.name !== "string" ||
    !cleanLine(doc.name) ||
    !(PUBLIC_STATUSES as readonly unknown[]).includes(status)
  ) {
    return null;
  }
  const startDate = optionalDate(doc.startDate);
  const endDate = optionalDate(doc.endDate);
  if (!startDate || !endDate || endDate < today) return null;

  const project: PublicProject = {
    id: doc._id,
    name: cleanLine(doc.name).slice(0, 120),
    status: status as PublicProject["status"],
    startDate,
    endDate,
    spotsLeft: null,
    acceptingApplications: true,
  };

  if (typeof doc.description === "string" && doc.description.trim()) {
    project.description = doc.description.replace(/\r\n?/g, "\n").trim().slice(0, 2000);
  }
  if (typeof doc.location === "string" && cleanLine(doc.location)) {
    project.location = cleanLine(doc.location).slice(0, 120);
  }
  const ageMin = wholeNumber(doc.ageMin, 0, 120);
  const ageMax = wholeNumber(doc.ageMax, 0, 120);
  if (ageMin !== undefined) project.ageMin = ageMin;
  if (ageMax !== undefined && (ageMin === undefined || ageMax >= ageMin)) project.ageMax = ageMax;

  if (Array.isArray(doc.eligibleCountries)) {
    const countries = doc.eligibleCountries
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => cleanLine(entry).slice(0, 80))
      .filter(Boolean)
      .slice(0, 60);
    if (countries.length > 0) project.eligibleCountries = countries;
  }

  const deadline = optionalDate(doc.applicationDeadline);
  if (deadline) {
    project.applicationDeadline = deadline;
    project.acceptingApplications = deadline >= today;
  }

  const max = wholeNumber(doc.maxParticipants, 1, 100_000);
  if (max !== undefined) {
    const taken = typeof doc.participantCount === "number" ? doc.participantCount : 0;
    project.spotsLeft = Math.max(0, max - taken);
  }
  return project;
}

function sortProjects(projects: PublicProject[]): PublicProject[] {
  return [...projects].sort((a, b) => {
    if (a.acceptingApplications !== b.acceptingApplications) return a.acceptingApplications ? -1 : 1;
    return a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name);
  });
}

async function loadPublicProjects(today: string): Promise<PublicProject[]> {
  // Projects only exist in Sanity; the projects module's in-memory store is not shared.
  if (!isSanityConfigured()) return [];
  const docs = await sanityClient.fetch<StoredPublicProject[]>(
    `*[${PUBLIC_PROJECT_FILTER}] | order(startDate asc) [0...${MAX_PUBLIC_PROJECTS}]${PUBLIC_PROJECT_PROJECTION}`,
    { statuses: [...PUBLIC_STATUSES], today }
  );
  return sortProjects(
    (Array.isArray(docs) ? docs : [])
      .map((doc) => toPublicProject(doc, today))
      .filter((project): project is PublicProject => project !== null)
  );
}

/**
 * Everything the public join page needs. Never throws: when Sanity cannot be reached the page still
 * renders with default organisation info and the general application form.
 */
export async function getPublicJoinData(today: string = moroccoToday()): Promise<PublicJoinData> {
  const [settings, projects] = await Promise.allSettled([loadPublicSettings(), loadPublicProjects(today)]);
  if (settings.status === "rejected") {
    console.error("Join page: could not load portal settings:", settings.reason);
  }
  if (projects.status === "rejected") {
    console.error("Join page: could not load public projects:", projects.reason);
  }
  const { org, presets } = settings.status === "fulfilled" ? settings.value : toPublicSettings(null);
  return {
    org,
    presets,
    projects: projects.status === "fulfilled" ? projects.value : [],
    projectsUnavailable: projects.status === "rejected",
  };
}

/**
 * The public project an applicant may apply for, or null when it is not public, not open, has ended or
 * its deadline has passed. Throws when Sanity cannot be read (the caller reports a generic error).
 */
export async function findApplicableProject(projectId: string, today: string = moroccoToday()): Promise<PublicProject | null> {
  if (!isSanityConfigured()) return null;
  const doc = await sanityClient.fetch<StoredPublicProject | null>(
    `*[_id == $id && ${PUBLIC_PROJECT_FILTER}][0]${PUBLIC_PROJECT_PROJECTION}`,
    { id: projectId, statuses: [...PUBLIC_STATUSES], today }
  );
  const project = doc ? toPublicProject(doc, today) : null;
  return project?.acceptingApplications ? project : null;
}

/* ---------- Form token (minimum fill time) ---------- */

export const FORM_MIN_FILL_MS = 4_000;
const FORM_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60_000;

// Derived from an existing server secret so tokens survive restarts; falls back to a per-process key.
const TOKEN_KEY = createHmac(
  "sha256",
  process.env.JOIN_FORM_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.SANITY_API_WRITE_TOKEN ||
    randomBytes(32).toString("hex")
)
  .update("servetrack:join-form-token:v1")
  .digest();

function signIssuedAt(issuedAt: number): string {
  return createHmac("sha256", TOKEN_KEY).update(`join:${issuedAt}`).digest("base64url");
}

/** Signed timestamp rendered into the form. `issuedAt` can be backdated to issue an immediately valid token. */
export function issueFormToken(issuedAt: number = Date.now()): string {
  return `${issuedAt}.${signIssuedAt(issuedAt)}`;
}

/** A replacement token that is valid right away (used after an expired token, so the user can resubmit). */
export function issueReadyFormToken(): string {
  return issueFormToken(Date.now() - FORM_MIN_FILL_MS);
}

export type FormTokenCheck = "ok" | "too_fast" | "expired" | "invalid";

export function checkFormToken(token: unknown, now: number = Date.now()): FormTokenCheck {
  if (typeof token !== "string" || token.length > 100) return "invalid";
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return "invalid";
  const issuedAt = Number(match[1]);
  const expected = Buffer.from(signIssuedAt(issuedAt));
  const given = Buffer.from(match[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = now - issuedAt;
  if (age < -CLOCK_SKEW_MS) return "invalid";
  if (age < FORM_MIN_FILL_MS) return "too_fast";
  if (age > FORM_MAX_AGE_MS) return "expired";
  return "ok";
}

/* ---------- Client IP ---------- */

const IP_PATTERN = /^[0-9a-fA-F:.]{2,64}$/;

/** Best-effort client IP: the proxy-set x-real-ip first, then the first x-forwarded-for hop. */
export function clientIpFromHeaders(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && IP_PATTERN.test(realIp)) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && IP_PATTERN.test(forwarded)) return forwarded;
  return "unknown";
}

/* ---------- In-memory rate limits (per server instance) ---------- */

const HOUR_MS = 60 * 60 * 1000;
const RATE_LIMITS = {
  /** Every call to the action, valid or not. */
  attemptsPerIp: { limit: 30, windowMs: HOUR_MS },
  /** Applications that passed validation. */
  applicationsPerIp: { limit: 5, windowMs: HOUR_MS },
  /** Requests without a usable IP header share one bucket, so it is more generous. */
  applicationsUnknownIp: { limit: 30, windowMs: HOUR_MS },
  applicationsPerEmail: { limit: 3, windowMs: HOUR_MS },
  /** Protects Sanity from a distributed flood. */
  applicationsGlobal: { limit: 120, windowMs: HOUR_MS },
} as const;
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, number[]>();

function liveHits(key: string, windowMs: number, now: number): number[] {
  const hits = (buckets.get(key) ?? []).filter((time) => now - time < windowMs);
  if (hits.length > 0) buckets.set(key, hits);
  else buckets.delete(key);
  return hits;
}

function pruneBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, hits] of buckets) {
    if (hits.every((time) => now - time >= HOUR_MS)) buckets.delete(key);
  }
  // Still too many distinct keys: drop the oldest (Map keeps insertion order).
  for (const key of buckets.keys()) {
    if (buckets.size < MAX_BUCKETS) break;
    buckets.delete(key);
  }
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/** Counts one call from this IP. Returns false when the IP has made too many calls. */
export function countAttempt(ip: string, now: number = Date.now()): boolean {
  pruneBuckets(now);
  const { limit, windowMs } = RATE_LIMITS.attemptsPerIp;
  const key = `attempt:${hashKey(ip)}`;
  const hits = liveHits(key, windowMs, now);
  if (hits.length >= limit) return false;
  buckets.set(key, [...hits, now]);
  return true;
}

export type SlotReservation = { ok: true; release: () => void } | { ok: false };

/**
 * Reserves one application for this IP and email (checked and recorded synchronously, so parallel
 * requests can't slip past). Call release() when the application could not be stored.
 */
export function reserveApplicationSlot({ ip, email }: { ip: string; email: string }, now: number = Date.now()): SlotReservation {
  pruneBuckets(now);
  const ipRule = ip === "unknown" ? RATE_LIMITS.applicationsUnknownIp : RATE_LIMITS.applicationsPerIp;
  const checks = [
    { key: `apply-ip:${hashKey(ip)}`, ...ipRule },
    { key: `apply-email:${hashKey(email.toLowerCase())}`, ...RATE_LIMITS.applicationsPerEmail },
    { key: "apply-global", ...RATE_LIMITS.applicationsGlobal },
  ];
  for (const check of checks) {
    if (liveHits(check.key, check.windowMs, now).length >= check.limit) return { ok: false };
  }
  for (const check of checks) {
    buckets.set(check.key, [...(buckets.get(check.key) ?? []), now]);
  }
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      for (const check of checks) {
        const hits = buckets.get(check.key);
        const index = hits?.lastIndexOf(now) ?? -1;
        if (hits && index >= 0) hits.splice(index, 1);
      }
    },
  };
}

/* ---------- Storing an application ---------- */

function noteEntry(application: ParsedApplication, today: string, projectName: string | undefined, room: number): string | null {
  const details = [
    projectName ? `project: ${projectName}` : "general application",
    `heard via ${APPLICATION_SOURCE_LABELS[application.source]}`,
    `phone ${application.phone}`,
  ].join("; ");
  const header = `[${today}] Applied again via the join page (${details}).`;
  if (header.length > room) return null;
  const motivationRoom = room - header.length - "\nMotivation: ".length;
  if (motivationRoom < 20) return header;
  const motivation =
    application.motivation.length > motivationRoom
      ? `${application.motivation.slice(0, motivationRoom - 1)}…`
      : application.motivation;
  return `${header}\nMotivation: ${motivation}`;
}

/** Appends the new application to existing intake notes, staying within the 2000-character limit. */
function appendIntakeNote(existing: unknown, application: ParsedApplication, today: string, projectName?: string): string | null {
  const current = typeof existing === "string" ? existing.trimEnd() : "";
  const separator = current ? "\n\n" : "";
  const entry = noteEntry(application, today, projectName, INTAKE_NOTES_MAX - current.length - separator.length);
  return entry ? `${current}${separator}${entry}` : null;
}

interface ExistingVolunteer {
  _id: string;
  _rev: string;
  intakeNotes?: unknown;
}

async function findVolunteersByEmail(email: string): Promise<ExistingVolunteer[]> {
  // Raw perspective: also catch a volunteer that only exists as an unpublished Studio draft.
  return sanityWriteClient.fetch<ExistingVolunteer[]>(
    `*[_type == "volunteer" && lower(email) == $email && !(_id in path("versions.**"))]{ _id, _rev, intakeNotes }`,
    { email },
    { perspective: "raw" }
  );
}

function statusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return undefined;
}

/** Appends the application to every copy (published + draft) of the existing volunteer. Retries on concurrent edits. */
async function appendToExisting(
  existing: ExistingVolunteer[],
  application: ParsedApplication,
  today: string,
  projectName?: string
): Promise<void> {
  let docs = existing;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const transaction = sanityWriteClient.transaction();
    let changes = 0;
    for (const doc of docs) {
      const notes = appendIntakeNote(doc.intakeNotes, application, today, projectName);
      if (notes === null) continue; // notes are full; staff still have the original application
      transaction.patch(doc._id, (patch) => patch.ifRevisionId(doc._rev).set({ intakeNotes: notes }));
      changes += 1;
    }
    if (changes === 0) return;
    try {
      await transaction.commit({ visibility: "async" });
      return;
    } catch (error) {
      if (statusCode(error) !== 409 || attempt === 2) throw error;
      docs = await findVolunteersByEmail(application.email);
      if (docs.length === 0) return;
    }
  }
}

function newVolunteerDocument(application: ParsedApplication) {
  return {
    _type: "volunteer",
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    phoneNumber: application.phone,
    country: application.country,
    city: application.city,
    nationality: application.nationality,
    dateOfBirth: application.dateOfBirth,
    languages: application.languages,
    skills: application.skills,
    volunteerType: application.volunteerType,
    pipelineStage: "lead",
    active: false,
    source: application.source,
    ...(application.projectId
      ? { appliedProject: { _type: "reference", _ref: application.projectId, _weak: true } }
      : {}),
    motivation: application.motivation,
    ...(application.diet ? { diet: application.diet } : {}),
    emergencyContact: {
      name: application.emergencyName,
      phone: application.emergencyPhone,
      ...(application.emergencyRelation ? { relation: application.emergencyRelation } : {}),
    },
    ...(application.healthNotes ? { medicalNotes: application.healthNotes } : {}),
    applicationDetails: applicationDetails(application),
    createdAt: new Date().toISOString(),
  };
}

/** Extra Join-form answers stored on the volunteer (undefined values are dropped by JSON). */
function applicationDetails(application: ParsedApplication) {
  return {
    submittedAt: new Date().toISOString(),
    gender: application.gender,
    address: application.address,
    escPortalId: application.escPortalId,
    sendingOrganisation: application.sendingOrganisation,
    travelFrom: application.travelFrom,
    availableFrom: application.availableFrom,
    availableTo: application.availableTo,
    occupation: application.occupation,
    education: application.education,
    previousVolunteering: application.previousVolunteering,
    expectations: application.expectations,
    supportNeeds: application.supportNeeds,
    photoConsent: application.photoConsent,
  };
}

/* In-memory store used only when no Sanity project is configured (not visible in the portal). */
const mockApplications = new Map<string, ReturnType<typeof newVolunteerDocument> & { intakeNotes?: string }>();

/**
 * Stores an application: creates a new "Applied" (lead) volunteer, or — when the email is already
 * known — appends the application to that volunteer's intake notes. Both outcomes look identical to
 * the applicant. Throws when Sanity fails (never silently falls back).
 */
export async function storeApplication(
  application: ParsedApplication,
  { today, projectName }: { today: string; projectName?: string }
): Promise<void> {
  if (!isSanityConfigured()) {
    const existing = mockApplications.get(application.email);
    if (existing) {
      existing.intakeNotes = appendIntakeNote(existing.intakeNotes, application, today, projectName) ?? existing.intakeNotes;
    } else {
      mockApplications.set(application.email, newVolunteerDocument(application));
    }
    return;
  }

  const existing = await findVolunteersByEmail(application.email);
  if (existing.length > 0) {
    await appendToExisting(existing, application, today, projectName);
    return;
  }

  // Deterministic id: two simultaneous submissions with the same email can't create duplicates.
  const document = { _id: `applicant-${hashKey(`volunteer:${application.email}`)}`, ...newVolunteerDocument(application) };
  try {
    await sanityWriteClient.create(document, { visibility: "async" });
  } catch (error) {
    if (statusCode(error) !== 409) throw error;
    const raced = await findVolunteersByEmail(application.email);
    if (raced.length > 0) {
      await appendToExisting(raced, application, today, projectName);
      return;
    }
    // The id belongs to a record whose email was changed later: store under a fresh id instead.
    const { _id: _unused, ...withoutId } = document;
    void _unused;
    await sanityWriteClient.create(withoutId, { visibility: "async" });
  }
}
