"use server";

import { randomUUID } from "crypto";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import { ADMIN_ROLES, APP_ROLES } from "@/lib/roles";
import { assertActionRole, getDisplayName, type RoleUser } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { PORTAL_COUNTRIES, PORTAL_SETTINGS_ID } from "@/sanity/schemas/settings";

/** Settings every signed-in role may read. */
export interface PortalSettings {
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

type StoredPortalSettings = Partial<PortalSettingsChanges> & {
  _id?: string;
  _rev?: string;
  _updatedAt?: string;
  portalRevision?: string;
};

const ORGANIZATION_NAME_MAX_LENGTH = 100;
const REVISION_MAX_LENGTH = 128;
const CONFLICT_ERROR = "Settings were changed by someone else. Load the latest settings and try again.";

// The fixed singleton id is authoritative. Until the portal first saves it, a portalSettings
// document created in Sanity Studio seeds the values; saving always writes the fixed id.
const PORTAL_SETTINGS_QUERY = `coalesce(
  *[_id == $id][0],
  *[_type == "portalSettings" && !(_id in path("drafts.**"))] | order(_updatedAt desc)[0]
)`;

const DEFAULT_PORTAL_SETTINGS: EditablePortalSettings = {
  organizationName: "ServeTrack",
  attendanceTarget: 85,
  defaultCountry: "United States",
  weeklyDigest: false,
  registrationAlerts: false,
  updatedAt: null,
  updatedBy: null,
  updatedOutsidePortal: false,
  revision: null,
};

let mockPortalSettings: EditablePortalSettings = { ...DEFAULT_PORTAL_SETTINGS };
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

function getLastWriter(doc: StoredPortalSettings): Pick<EditablePortalSettings, "updatedBy" | "updatedOutsidePortal"> {
  // Sanity assigns its own _rev (it is not the transactionId), so attribute the save to updatedBy when present.
  const updatedBy = typeof doc.updatedBy === "string" && doc.updatedBy ? doc.updatedBy : null;
  return { updatedBy, updatedOutsidePortal: !updatedBy };
}

function toEditableSettings(doc: StoredPortalSettings | null | undefined): EditablePortalSettings {
  if (!doc) {
    return { ...DEFAULT_PORTAL_SETTINGS };
  }
  return {
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
  if (organizationName.length > ORGANIZATION_NAME_MAX_LENGTH) {
    throw new Error(`Organization name must be ${ORGANIZATION_NAME_MAX_LENGTH} characters or fewer.`);
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

  return {
    organizationName,
    attendanceTarget: data.attendanceTarget,
    defaultCountry: data.defaultCountry,
    weeklyDigest: data.weeklyDigest,
    registrationAlerts: data.registrationAlerts,
  };
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

const loadPortalSettings = cache(async (): Promise<EditablePortalSettings> => {
  if (!isSanityConfigured()) {
    return { ...mockPortalSettings };
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
 * Organization name, attendance target and default country (defaults when nothing was saved yet).
 * Available to every role. Throws when Sanity cannot be read.
 */
export async function getPortalSettingsAction(): Promise<PortalSettings> {
  await assertActionRole([...APP_ROLES]);
  const { organizationName, attendanceTarget, defaultCountry } = await loadPortalSettings();
  return { organizationName, attendanceTarget, defaultCountry };
}

/** Full settings, including notification preferences and who saved them last. Admins only; throws on failure. */
export async function getEditablePortalSettingsAction(): Promise<EditablePortalSettings> {
  await assertActionRole(ADMIN_ROLES);
  return loadPortalSettings();
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

async function saveToSanity(
  changes: PortalSettingsChanges,
  expectedRevision: string | null
): Promise<EditablePortalSettings | null> {
  try {
    const current = await sanityWriteClient.fetch<StoredPortalSettings | null>(PORTAL_SETTINGS_QUERY, {
      id: PORTAL_SETTINGS_ID,
    });
    if ((current?._rev ?? null) !== expectedRevision) {
      return null;
    }

    const transactionId = randomUUID();
    const values = { ...changes, portalRevision: transactionId };
    const doc =
      current?._id === PORTAL_SETTINGS_ID && current._rev
        ? await sanityWriteClient
            .patch(PORTAL_SETTINGS_ID)
            .ifRevisionId(current._rev)
            .set(values)
            .commit<StoredPortalSettings>({ transactionId })
        : await sanityWriteClient.create<StoredPortalSettings>(
            { _id: PORTAL_SETTINGS_ID, _type: "portalSettings", ...values },
            { transactionId }
          );
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
      mockPortalSettings = { ...changes, updatedOutsidePortal: false, revision: `mock-${mockRevisionCounter}` };
      saved = { ...mockPortalSettings };
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
