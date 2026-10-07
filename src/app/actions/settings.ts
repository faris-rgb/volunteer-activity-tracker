"use server";

import { randomUUID } from "crypto";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import { ADMIN_ROLES, APP_ROLES } from "@/lib/roles";
import { assertActionRole, getDisplayName, type RoleUser } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import {
  DEFAULT_ACTIVITY_CATEGORIES,
  DEFAULT_LANGUAGES,
  DEFAULT_LOCATIONS,
  DEFAULT_SKILLS,
  DEFAULT_WHATSAPP_TEMPLATES,
  type PortalPresets,
  type WhatsAppTemplate,
} from "@/lib/domain";
import {
  PORTAL_COUNTRIES,
  PORTAL_SETTINGS_ID,
  SETTINGS_LIMITS,
  TEMPLATE_KEY_PATTERN,
  contactEmailError,
  contactPhoneError,
  escOidError,
  escPicError,
  isIsoDate,
  normalizeEscOid,
  normalizeEscPic,
  normalizeSocialUrl,
  socialUrlError,
  templateKeyFromLabel,
  unknownPlaceholders,
} from "@/sanity/schemas/settings";

/**
 * Settings every signed-in role may read: organisation details, ESC accreditation info, the preset
 * lists (locations, languages, skills, activity categories) and the WhatsApp message templates.
 * Missing stored values fall back to the defaults from @/lib/domain.
 */
export interface PortalSettings extends PortalPresets {
  organizationName: string;
  attendanceTarget: number;
  defaultCountry: string;
}

export interface PortalSettingsInput extends PortalSettings {
  weeklyDigest: boolean;
  registrationAlerts: boolean;
}

/**
 * Full settings for the admin Settings page. `revision` is sent back on save to detect concurrent edits.
 * `updatedBy` is only set when the last write came from the portal.
 */
export interface EditablePortalSettings extends PortalSettingsInput {
  updatedAt: string | null;
  updatedBy: string | null;
  updatedOutsidePortal: boolean;
  revision: string | null;
}

export type SavePortalSettingsResult =
  | ActionResult<EditablePortalSettings>
  | { ok: false; error: string; conflict: true };

type PortalSettingsChanges = PortalSettingsInput & { updatedAt: string; updatedBy: string };

/** Raw document as stored in Sanity (validated field by field when read). */
type StoredPortalSettings = Record<string, unknown> & {
  _id?: unknown;
  _rev?: unknown;
  _updatedAt?: unknown;
};

type TagListField = "locations" | "languages" | "skills" | "activityCategories";
type OptionalTextField =
  | "contactEmail"
  | "contactPhone"
  | "instagramUrl"
  | "facebookUrl"
  | "escPic"
  | "escOid"
  | "escLabelExpiry";

const REVISION_MAX_LENGTH = 128;
/** Upper bound on raw list input before trimming/deduplication, to reject oversized payloads early. */
const RAW_LIST_MAX_LENGTH = 200;
const CONFLICT_ERROR = "Settings were changed by someone else. Load the latest settings and try again.";

// The fixed singleton id is authoritative. Until the portal first saves it, a portalSettings
// document created in Sanity Studio seeds the values; saving always writes the fixed id.
const PORTAL_SETTINGS_QUERY = `coalesce(
  *[_id == $id][0],
  *[_type == "portalSettings" && !(_id in path("drafts.**"))] | order(_updatedAt desc)[0]
)`;

const TAG_LISTS: Record<TagListField, { label: string; defaults: readonly string[] }> = {
  locations: { label: "Locations", defaults: DEFAULT_LOCATIONS },
  languages: { label: "Languages", defaults: DEFAULT_LANGUAGES },
  skills: { label: "Skills", defaults: DEFAULT_SKILLS },
  activityCategories: { label: "Activity categories", defaults: DEFAULT_ACTIVITY_CATEGORIES },
};

/** Optional text fields: label for error messages, normalisation, and validation (null = valid). */
const OPTIONAL_TEXT_FIELDS: Record<
  OptionalTextField,
  { label: string; normalize: (value: string) => string; check: (value: string) => string | null }
> = {
  contactEmail: { label: "Contact email", normalize: (value) => value, check: contactEmailError },
  contactPhone: { label: "Contact phone", normalize: (value) => value, check: contactPhoneError },
  instagramUrl: {
    label: "Instagram link",
    normalize: normalizeSocialUrl,
    check: (value) => socialUrlError(value, "instagram"),
  },
  facebookUrl: {
    label: "Facebook link",
    normalize: normalizeSocialUrl,
    check: (value) => socialUrlError(value, "facebook"),
  },
  escPic: { label: "PIC", normalize: normalizeEscPic, check: escPicError },
  escOid: { label: "OID", normalize: normalizeEscOid, check: escOidError },
  escLabelExpiry: {
    label: "Quality Label expiry date",
    normalize: (value) => value,
    check: (value) => (isIsoDate(value) ? null : "Enter a valid date."),
  },
};

const OPTIONAL_TEXT_FIELD_NAMES = Object.keys(OPTIONAL_TEXT_FIELDS) as OptionalTextField[];

function defaultTemplates(): WhatsAppTemplate[] {
  return DEFAULT_WHATSAPP_TEMPLATES.map((template) => ({ ...template }));
}

const DEFAULT_PORTAL_SETTINGS: EditablePortalSettings = {
  organizationName: "Volunteer in Morocco",
  attendanceTarget: 85,
  defaultCountry: "Morocco",
  locations: [...DEFAULT_LOCATIONS],
  languages: [...DEFAULT_LANGUAGES],
  skills: [...DEFAULT_SKILLS],
  activityCategories: [...DEFAULT_ACTIVITY_CATEGORIES],
  whatsappTemplates: defaultTemplates(),
  weeklyDigest: false,
  registrationAlerts: false,
  updatedAt: null,
  updatedBy: null,
  updatedOutsidePortal: false,
  revision: null,
};

function cloneSettings(settings: EditablePortalSettings): EditablePortalSettings {
  return {
    ...settings,
    locations: [...settings.locations],
    languages: [...settings.languages],
    skills: [...settings.skills],
    activityCategories: [...settings.activityCategories],
    whatsappTemplates: settings.whatsappTemplates.map((template) => ({ ...template })),
  };
}

let mockPortalSettings: EditablePortalSettings = cloneSettings(DEFAULT_PORTAL_SETTINGS);
let mockRevisionCounter = 0;

function isPortalCountry(value: unknown): value is string {
  return typeof value === "string" && (PORTAL_COUNTRIES as readonly string[]).includes(value);
}

function isValidAttendanceTarget(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

function isConflictError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { statusCode?: unknown }).statusCode === 409
  );
}

/** Trimmed, non-empty, case-insensitively unique strings (first spelling wins). */
function uniqueTags(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const tag = value.trim();
    const id = tag.toLocaleLowerCase();
    if (tag && !seen.has(id)) {
      seen.add(id);
      result.push(tag);
    }
  }
  return result;
}

/* ---------- Reading stored values (anything missing or invalid falls back to defaults) ---------- */

function readTagList(value: unknown, defaults: readonly string[]): string[] {
  if (!Array.isArray(value)) {
    return [...defaults];
  }
  const tags = uniqueTags(value.filter((tag): tag is string => typeof tag === "string")).filter(
    (tag) => tag.length <= SETTINGS_LIMITS.tagLength
  );
  return tags.length ? tags.slice(0, SETTINGS_LIMITS.tagsPerList) : [...defaults];
}

function readTemplates(value: unknown): WhatsAppTemplate[] {
  if (!Array.isArray(value)) {
    return defaultTemplates();
  }
  const keys = new Set<string>();
  const templates: WhatsAppTemplate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const { key, _key: sanityKey, label, text } = item as Record<string, unknown>;
    if (typeof label !== "string" || !label.trim() || typeof text !== "string" || !text.trim()) {
      continue;
    }
    const usableKey = (candidate: unknown): candidate is string =>
      typeof candidate === "string" && TEMPLATE_KEY_PATTERN.test(candidate) && !keys.has(candidate);
    const templateKey = usableKey(key) ? key : usableKey(sanityKey) ? sanityKey : templateKeyFromLabel(label, keys);
    keys.add(templateKey);
    templates.push({ key: templateKey, label: label.trim(), text: text.trim() });
    if (templates.length >= SETTINGS_LIMITS.templates) {
      break;
    }
  }
  return templates.length ? templates : defaultTemplates();
}

function readOptionalText(field: OptionalTextField, value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const { normalize, check } = OPTIONAL_TEXT_FIELDS[field];
  const normalized = normalize(value.trim());
  // Values that fail validation (e.g. a non-http link written outside the portal) are never handed out.
  return check(normalized) === null ? normalized : undefined;
}

function getLastWriter(doc: StoredPortalSettings): Pick<EditablePortalSettings, "updatedBy" | "updatedOutsidePortal"> {
  // Sanity assigns its own _rev (it is not the transactionId), so attribute the save to updatedBy when present.
  const updatedBy = typeof doc.updatedBy === "string" && doc.updatedBy ? doc.updatedBy : null;
  return { updatedBy, updatedOutsidePortal: !updatedBy };
}

function toEditableSettings(doc: StoredPortalSettings | null | undefined): EditablePortalSettings {
  if (!doc) {
    return cloneSettings(DEFAULT_PORTAL_SETTINGS);
  }

  const settings: EditablePortalSettings = {
    organizationName:
      typeof doc.organizationName === "string" && doc.organizationName.trim()
        ? doc.organizationName
        : DEFAULT_PORTAL_SETTINGS.organizationName,
    attendanceTarget: isValidAttendanceTarget(doc.attendanceTarget)
      ? doc.attendanceTarget
      : DEFAULT_PORTAL_SETTINGS.attendanceTarget,
    defaultCountry: isPortalCountry(doc.defaultCountry)
      ? doc.defaultCountry
      : DEFAULT_PORTAL_SETTINGS.defaultCountry,
    locations: readTagList(doc.locations, DEFAULT_LOCATIONS),
    languages: readTagList(doc.languages, DEFAULT_LANGUAGES),
    skills: readTagList(doc.skills, DEFAULT_SKILLS),
    activityCategories: readTagList(doc.activityCategories, DEFAULT_ACTIVITY_CATEGORIES),
    whatsappTemplates: readTemplates(doc.whatsappTemplates),
    weeklyDigest: doc.weeklyDigest === true,
    registrationAlerts: doc.registrationAlerts === true,
    updatedAt:
      typeof doc._updatedAt === "string"
        ? doc._updatedAt
        : typeof doc.updatedAt === "string"
          ? doc.updatedAt
          : null,
    ...getLastWriter(doc),
    revision: typeof doc._rev === "string" ? doc._rev : null,
  };

  for (const field of OPTIONAL_TEXT_FIELD_NAMES) {
    const value = readOptionalText(field, doc[field]);
    if (value !== undefined) {
      settings[field] = value;
    }
  }
  return settings;
}

/* ---------- Validating input from the Settings page ---------- */

function validateTagList(value: unknown, field: TagListField): string[] {
  const { label } = TAG_LISTS[field];
  if (!Array.isArray(value) || value.length > RAW_LIST_MAX_LENGTH) {
    throw new Error(`Invalid ${label.toLowerCase()} list.`);
  }
  if (!value.every((tag) => typeof tag === "string")) {
    throw new Error(`${label} may only contain text.`);
  }
  const tags = uniqueTags(value as string[]);
  if (tags.length === 0) {
    throw new Error(`${label}: add at least one entry.`);
  }
  if (tags.length > SETTINGS_LIMITS.tagsPerList) {
    throw new Error(`${label}: use ${SETTINGS_LIMITS.tagsPerList} entries or fewer.`);
  }
  const tooLong = tags.find((tag) => tag.length > SETTINGS_LIMITS.tagLength);
  if (tooLong) {
    throw new Error(`${label}: "${tooLong.slice(0, 20)}..." is longer than ${SETTINGS_LIMITS.tagLength} characters.`);
  }
  return tags;
}

function validateTemplates(value: unknown): WhatsAppTemplate[] {
  if (!Array.isArray(value) || value.length > RAW_LIST_MAX_LENGTH) {
    throw new Error("Invalid WhatsApp templates.");
  }
  if (value.length === 0) {
    throw new Error("Add at least one WhatsApp template.");
  }
  if (value.length > SETTINGS_LIMITS.templates) {
    throw new Error(`Use ${SETTINGS_LIMITS.templates} WhatsApp templates or fewer.`);
  }

  const keys = new Set<string>();
  const labels = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid WhatsApp template.");
    }
    const { key, label, text } = item as Record<string, unknown>;
    const name = typeof label === "string" && label.trim() ? `"${label.trim().slice(0, 40)}"` : `#${index + 1}`;

    if (typeof key !== "string" || !TEMPLATE_KEY_PATTERN.test(key) || keys.has(key)) {
      throw new Error(`WhatsApp template ${name} has an invalid key. Reload the page and try again.`);
    }
    if (typeof label !== "string" || !label.trim()) {
      throw new Error(`WhatsApp template ${name}: a label is required.`);
    }
    const cleanLabel = label.trim();
    if (cleanLabel.length > SETTINGS_LIMITS.templateLabel) {
      throw new Error(`WhatsApp template ${name}: use ${SETTINGS_LIMITS.templateLabel} characters or fewer for the label.`);
    }
    if (labels.has(cleanLabel.toLocaleLowerCase())) {
      throw new Error(`WhatsApp template labels must be unique (${name} is used twice).`);
    }
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`WhatsApp template ${name}: the message is required.`);
    }
    const cleanText = text.trim();
    if (cleanText.length > SETTINGS_LIMITS.templateText) {
      throw new Error(`WhatsApp template ${name}: use ${SETTINGS_LIMITS.templateText} characters or fewer.`);
    }
    const unknown = unknownPlaceholders(cleanText);
    if (unknown.length) {
      throw new Error(
        `WhatsApp template ${name}: unknown placeholder ${unknown.map((placeholder) => `{${placeholder}}`).join(", ")}.`
      );
    }

    keys.add(key);
    labels.add(cleanLabel.toLocaleLowerCase());
    return { key, label: cleanLabel, text: cleanText };
  });
}

function validateOptionalText(field: OptionalTextField, value: unknown): string | undefined {
  const { label, normalize, check } = OPTIONAL_TEXT_FIELDS[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.length > 1000) {
    throw new Error(`Invalid ${label.toLowerCase()}.`);
  }
  const normalized = normalize(value.trim());
  if (!normalized) {
    return undefined;
  }
  const error = check(normalized);
  if (error) {
    throw new Error(`${label}: ${error}`);
  }
  return normalized;
}

function validatePortalSettingsInput(input: unknown): PortalSettingsInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid settings.");
  }
  const data = input as Record<string, unknown>;

  const organizationName =
    typeof data.organizationName === "string" ? data.organizationName.trim() : "";
  if (!organizationName) {
    throw new Error("Organization name is required.");
  }
  if (organizationName.length > SETTINGS_LIMITS.organizationName) {
    throw new Error(`Organization name must be ${SETTINGS_LIMITS.organizationName} characters or fewer.`);
  }
  if (!isValidAttendanceTarget(data.attendanceTarget)) {
    throw new Error("Attendance target must be a whole number between 0 and 100.");
  }
  if (!isPortalCountry(data.defaultCountry)) {
    throw new Error("Please choose a supported default country.");
  }
  if (typeof data.weeklyDigest !== "boolean" || typeof data.registrationAlerts !== "boolean") {
    throw new Error("Invalid notification preferences.");
  }

  const settings: PortalSettingsInput = {
    organizationName,
    attendanceTarget: data.attendanceTarget,
    defaultCountry: data.defaultCountry,
    locations: validateTagList(data.locations, "locations"),
    languages: validateTagList(data.languages, "languages"),
    skills: validateTagList(data.skills, "skills"),
    activityCategories: validateTagList(data.activityCategories, "activityCategories"),
    whatsappTemplates: validateTemplates(data.whatsappTemplates),
    weeklyDigest: data.weeklyDigest,
    registrationAlerts: data.registrationAlerts,
  };
  for (const field of OPTIONAL_TEXT_FIELD_NAMES) {
    const value = validateOptionalText(field, data[field]);
    if (value !== undefined) {
      settings[field] = value;
    }
  }
  return settings;
}

function validateRevision(revision: unknown): string | null {
  if (revision === null) {
    return null;
  }
  if (typeof revision !== "string" || !revision || revision.length > REVISION_MAX_LENGTH) {
    throw new Error("Invalid settings revision. Reload the page and try again.");
  }
  return revision;
}

/* ---------- Actions ---------- */

const loadPortalSettings = cache(async (): Promise<EditablePortalSettings> => {
  if (!isSanityConfigured()) {
    return cloneSettings(mockPortalSettings);
  }

  try {
    const doc = await sanityClient.fetch<StoredPortalSettings | null>(PORTAL_SETTINGS_QUERY, {
      id: PORTAL_SETTINGS_ID,
    });
    return toEditableSettings(doc);
  } catch (error) {
    console.error("Failed to fetch portal settings from Sanity CMS:", error);
    throw new Error("Could not load portal settings. Please try again.");
  }
});

/**
 * Organisation details, ESC accreditation, presets and WhatsApp templates (defaults for anything not
 * saved yet). None of these are sensitive. Available to every role. Throws when Sanity cannot be read.
 */
export async function getPortalSettingsAction(): Promise<PortalSettings> {
  await assertActionRole([...APP_ROLES]);
  const settings = await loadPortalSettings();
  const result: PortalSettings = {
    organizationName: settings.organizationName,
    attendanceTarget: settings.attendanceTarget,
    defaultCountry: settings.defaultCountry,
    locations: [...settings.locations],
    languages: [...settings.languages],
    skills: [...settings.skills],
    activityCategories: [...settings.activityCategories],
    whatsappTemplates: settings.whatsappTemplates.map((template) => ({ ...template })),
  };
  for (const field of OPTIONAL_TEXT_FIELD_NAMES) {
    if (settings[field] !== undefined) {
      result[field] = settings[field];
    }
  }
  return result;
}

/** Full settings, including notification preferences and who saved them last. Admins only; throws on failure. */
export async function getEditablePortalSettingsAction(): Promise<EditablePortalSettings> {
  await assertActionRole(ADMIN_ROLES);
  return cloneSettings(await loadPortalSettings());
}

async function getCallerName(caller: RoleUser): Promise<string> {
  try {
    const clerkUser = await currentUser();
    if (clerkUser?.id === caller.clerkUserId) {
      return getDisplayName({
        firstName: clerkUser.firstName ?? undefined,
        lastName: clerkUser.lastName ?? undefined,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? caller.email,
      });
    }
  } catch (error) {
    console.error("Failed to load the current user from Clerk:", error);
  }
  return getDisplayName(caller);
}

/** Splits the changes into Sanity `set` values and the optional fields to `unset` (cleared in the form). */
function toSanityPatch(changes: PortalSettingsChanges): { set: Record<string, unknown>; unset: string[] } {
  const set: Record<string, unknown> = {
    organizationName: changes.organizationName,
    attendanceTarget: changes.attendanceTarget,
    defaultCountry: changes.defaultCountry,
    locations: changes.locations,
    languages: changes.languages,
    skills: changes.skills,
    activityCategories: changes.activityCategories,
    whatsappTemplates: changes.whatsappTemplates.map((template) => ({
      _key: template.key,
      _type: "whatsappTemplate",
      key: template.key,
      label: template.label,
      text: template.text,
    })),
    weeklyDigest: changes.weeklyDigest,
    registrationAlerts: changes.registrationAlerts,
    updatedAt: changes.updatedAt,
    updatedBy: changes.updatedBy,
  };
  const unset: string[] = [];
  for (const field of OPTIONAL_TEXT_FIELD_NAMES) {
    const value = changes[field];
    if (value === undefined) {
      unset.push(field);
    } else {
      set[field] = value;
    }
  }
  return { set, unset };
}

async function saveToSanity(
  changes: PortalSettingsChanges,
  expectedRevision: string | null
): Promise<EditablePortalSettings | null> {
  try {
    const current = await sanityWriteClient.fetch<StoredPortalSettings | null>(PORTAL_SETTINGS_QUERY, {
      id: PORTAL_SETTINGS_ID,
    });
    const currentRevision = typeof current?._rev === "string" ? current._rev : null;
    if (currentRevision !== expectedRevision) {
      return null;
    }

    const transactionId = randomUUID();
    const { set, unset } = toSanityPatch(changes);
    set.portalRevision = transactionId;

    let doc: StoredPortalSettings;
    if (current?._id === PORTAL_SETTINGS_ID && currentRevision) {
      let patch = sanityWriteClient.patch(PORTAL_SETTINGS_ID).ifRevisionId(currentRevision).set(set);
      if (unset.length) {
        patch = patch.unset(unset);
      }
      doc = await patch.commit<StoredPortalSettings>({ transactionId });
    } else {
      doc = await sanityWriteClient.create<StoredPortalSettings>(
        { _id: PORTAL_SETTINGS_ID, _type: "portalSettings", ...set },
        { transactionId }
      );
    }
    return toEditableSettings(doc);
  } catch (error) {
    if (isConflictError(error)) {
      return null;
    }
    console.error("Failed to save portal settings to Sanity CMS:", error);
    throw new Error("Could not save settings to the database. Please try again.");
  }
}

export async function updatePortalSettingsAction(
  input: PortalSettingsInput,
  revision: string | null
): Promise<SavePortalSettingsResult> {
  try {
    const caller = await assertActionRole(ADMIN_ROLES);
    const values = validatePortalSettingsInput(input);
    const expectedRevision = validateRevision(revision);
    const changes: PortalSettingsChanges = {
      ...values,
      updatedAt: new Date().toISOString(),
      updatedBy: await getCallerName(caller),
    };

    let saved: EditablePortalSettings | null;
    if (isSanityConfigured()) {
      saved = await saveToSanity(changes, expectedRevision);
    } else if (mockPortalSettings.revision !== expectedRevision) {
      saved = null;
    } else {
      mockRevisionCounter += 1;
      mockPortalSettings = cloneSettings({
        ...changes,
        updatedOutsidePortal: false,
        revision: `mock-${mockRevisionCounter}`,
      });
      saved = cloneSettings(mockPortalSettings);
    }

    if (!saved) {
      return { ok: false, error: CONFLICT_ERROR, conflict: true };
    }

    revalidatePath("/", "layout");
    return actionOk(saved);
  } catch (error) {
    return actionError(error, "Failed to save settings");
  }
}
