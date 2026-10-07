import type { ValidationRule } from "./types";
import {
  DEFAULT_ACTIVITY_CATEGORIES,
  DEFAULT_LANGUAGES,
  DEFAULT_LOCATIONS,
  DEFAULT_SKILLS,
  DEFAULT_WHATSAPP_TEMPLATES,
} from "../../lib/domain";

interface SettingsValidationRule extends ValidationRule {
  required: () => SettingsValidationRule;
  min: (value: number) => SettingsValidationRule;
  max: (value: number) => SettingsValidationRule;
  integer: () => SettingsValidationRule;
  unique: () => SettingsValidationRule;
  custom: (validator: (value: unknown) => true | string) => SettingsValidationRule;
}

export const PORTAL_SETTINGS_ID = "portalSettings";

/**
 * Countries offered as the portal default (prefilled for new volunteers). Covers Morocco, the ESC
 * programme countries the association works with and the countries that were offered before, so
 * previously saved values stay valid.
 */
export const PORTAL_COUNTRIES = [
  "Algeria",
  "Australia",
  "Austria",
  "Belgium",
  "Bulgaria",
  "Canada",
  "Croatia",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Egypt",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "Ireland",
  "Italy",
  "Jordan",
  "Latvia",
  "Lebanon",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Morocco",
  "Netherlands",
  "North Macedonia",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Switzerland",
  "Tunisia",
  "Türkiye",
  "Ukraine",
  "United Kingdom",
  "United States",
] as const;

/* ---------- Limits and validators shared by the Settings page, the server action and Sanity Studio ---------- */

export const SETTINGS_LIMITS = {
  organizationName: 100,
  tagLength: 60,
  tagsPerList: 60,
  templates: 20,
  templateLabel: 60,
  templateText: 1000,
  templateKey: 40,
  email: 200,
  phone: 30,
  url: 300,
} as const;

/** Placeholders understood by fillTemplate() in WhatsApp templates. */
export const TEMPLATE_PLACEHOLDERS = [
  { key: "firstName", description: "Volunteer's first name" },
  { key: "project", description: "Project or activity name" },
  { key: "date", description: "Date (pickup or activity)" },
  { key: "time", description: "Time (pickup or activity)" },
  { key: "org", description: "Organisation name" },
] as const;

/** Show a renewal warning when the ESC Quality Label expires within this many days. */
export const ESC_LABEL_WARNING_DAYS = 180;

export const TEMPLATE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SocialNetwork = "instagram" | "facebook";

const SOCIAL_HOSTS: Record<SocialNetwork, { label: string; hosts: string[] }> = {
  instagram: { label: "Instagram", hosts: ["instagram.com", "instagr.am"] },
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"] },
};

/** Adds https:// when the scheme is missing, so "instagram.com/name" is accepted. */
export function normalizeSocialUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
}

/** Error message for an invalid social profile URL, or null when it is valid. Expects a normalized URL. */
export function socialUrlError(value: string, network: SocialNetwork): string | null {
  const { label, hosts } = SOCIAL_HOSTS[network];
  if (value.length > SETTINGS_LIMITS.url) {
    return `Use ${SETTINGS_LIMITS.url} characters or fewer.`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `Enter a valid ${label} link, for example https://${hosts[0]}/yourpage.`;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "The link must start with https://.";
  }
  const host = url.hostname.toLowerCase();
  if (!hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    return `This does not look like ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label} link (${hosts[0]}).`;
  }
  if (url.username || url.password) {
    return `Enter a plain ${label} profile link.`;
  }
  return null;
}

export function contactEmailError(value: string): string | null {
  if (value.length > SETTINGS_LIMITS.email) {
    return `Use ${SETTINGS_LIMITS.email} characters or fewer.`;
  }
  return EMAIL_PATTERN.test(value) ? null : "Enter a valid email address, for example info@example.org.";
}

export function contactPhoneError(value: string): string | null {
  if (value.length > SETTINGS_LIMITS.phone) {
    return `Use ${SETTINGS_LIMITS.phone} characters or fewer.`;
  }
  const digits = value.replace(/\D/g, "").length;
  if (!PHONE_PATTERN.test(value) || digits < 8 || digits > 15) {
    return "Enter a phone number with country code, for example +212 6 12 34 56 78.";
  }
  if (!/^(\+|00)/.test(value)) {
    return "Start with the country code (+212 for Morocco) so international volunteers can reach you.";
  }
  return null;
}

/** PIC: 9-digit Participant Identification Code. Spaces are ignored. */
export function normalizeEscPic(value: string): string {
  return value.replace(/\s+/g, "");
}

export function escPicError(value: string): string | null {
  return /^\d{9}$/.test(value) ? null : "The PIC is a 9-digit number.";
}

/** OID: Erasmus+/ESC Organisation ID, "E" followed by 8 digits. */
export function normalizeEscOid(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function escOidError(value: string): string | null {
  return /^E\d{8}$/.test(value) ? null : "The OID is an E followed by 8 digits, for example E10123456.";
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Whole days from `today` to `date` (both YYYY-MM-DD); negative when `date` is in the past. */
export function daysBetween(today: string, date: string): number | null {
  if (!isIsoDate(today) || !isIsoDate(date)) {
    return null;
  }
  const toUtc = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(date) - toUtc(today)) / 86_400_000);
}

/** Placeholders in a template that fillTemplate() would replace with an empty string. */
export function unknownPlaceholders(text: string): string[] {
  const known = new Set<string>(TEMPLATE_PLACEHOLDERS.map((placeholder) => placeholder.key));
  const unknown = new Set<string>();
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    if (!known.has(match[1])) {
      unknown.add(match[1]);
    }
  }
  return [...unknown];
}

/** Stable key for a new WhatsApp template, derived from its label and unique among `taken`. */
export function templateKeyFromLabel(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    label
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, SETTINGS_LIMITS.templateKey - 4) || "template";
  let key = base;
  for (let suffix = 2; used.has(key); suffix += 1) {
    key = `${base}_${suffix}`;
  }
  return key;
}

/* ---------- Sanity schema ---------- */

function isPortalSettingsDocument(value: unknown): boolean {
  const id = (value as { _id?: unknown } | undefined)?._id;
  return typeof id !== "string" || id === PORTAL_SETTINGS_ID || id.endsWith(`.${PORTAL_SETTINGS_ID}`);
}

/** Runs `check` only for non-empty strings (Sanity Studio validation for optional fields). */
function optionalString(check: (value: string) => string | null) {
  return (value: unknown): true | string => {
    if (typeof value !== "string" || !value.trim()) {
      return true;
    }
    return check(value.trim()) ?? true;
  };
}

function tagListField(name: string, title: string, description: string, defaults: readonly string[]) {
  return {
    name,
    title,
    description,
    type: "array",
    of: [{ type: "string" }],
    options: { layout: "tags" },
    initialValue: [...defaults],
    validation: (Rule: SettingsValidationRule) =>
      Rule.unique()
        .max(SETTINGS_LIMITS.tagsPerList)
        .custom((value) =>
          Array.isArray(value) &&
          value.some((tag) => typeof tag === "string" && tag.trim().length > SETTINGS_LIMITS.tagLength)
            ? `Each entry must be ${SETTINGS_LIMITS.tagLength} characters or fewer.`
            : true
        ),
  };
}

export const portalSettingsSchema = {
  name: "portalSettings",
  title: "Portal Settings",
  type: "document",
  validation: (Rule: SettingsValidationRule) =>
    Rule.custom((document) =>
      isPortalSettingsDocument(document)
        ? true
        : `The portal only uses the settings document with ID "${PORTAL_SETTINGS_ID}". Edit that document instead, or save Settings once in the portal to create it.`
    ),
  groups: [
    { name: "organization", title: "Organisation & contact", default: true },
    { name: "esc", title: "ESC accreditation" },
    { name: "presets", title: "Presets" },
    { name: "whatsapp", title: "WhatsApp templates" },
    { name: "notifications", title: "Notifications" },
  ],
  fields: [
    {
      name: "organizationName",
      title: "Organization Name",
      type: "string",
      group: "organization",
      initialValue: "Volunteer in Morocco",
      validation: (Rule: SettingsValidationRule) => Rule.required().max(SETTINGS_LIMITS.organizationName),
    },
    {
      name: "attendanceTarget",
      title: "Attendance Rate Target (%)",
      type: "number",
      group: "organization",
      initialValue: 85,
      validation: (Rule: SettingsValidationRule) => Rule.required().integer().min(0).max(100),
    },
    {
      name: "defaultCountry",
      title: "Default Country",
      type: "string",
      group: "organization",
      initialValue: "Morocco",
      options: {
        list: PORTAL_COUNTRIES.map((country) => ({ title: country, value: country })),
      },
      validation: (Rule: SettingsValidationRule) => Rule.required(),
    },
    {
      name: "contactEmail",
      title: "Contact Email",
      type: "string",
      group: "organization",
      validation: (Rule: SettingsValidationRule) => Rule.custom(optionalString(contactEmailError)),
    },
    {
      name: "contactPhone",
      title: "Contact Phone / WhatsApp",
      type: "string",
      group: "organization",
      validation: (Rule: SettingsValidationRule) => Rule.custom(optionalString(contactPhoneError)),
    },
    {
      name: "instagramUrl",
      title: "Instagram URL",
      type: "url",
      group: "organization",
      validation: (Rule: SettingsValidationRule) =>
        Rule.custom(optionalString((value) => socialUrlError(value, "instagram"))),
    },
    {
      name: "facebookUrl",
      title: "Facebook URL",
      type: "url",
      group: "organization",
      validation: (Rule: SettingsValidationRule) =>
        Rule.custom(optionalString((value) => socialUrlError(value, "facebook"))),
    },
    {
      name: "escPic",
      title: "PIC (Participant Identification Code)",
      type: "string",
      group: "esc",
      validation: (Rule: SettingsValidationRule) =>
        Rule.custom(optionalString((value) => escPicError(normalizeEscPic(value)))),
    },
    {
      name: "escOid",
      title: "OID (Organisation ID)",
      type: "string",
      group: "esc",
      validation: (Rule: SettingsValidationRule) =>
        Rule.custom(optionalString((value) => escOidError(normalizeEscOid(value)))),
    },
    {
      name: "escLabelExpiry",
      title: "ESC Quality Label Expiry",
      description: `The portal warns ${ESC_LABEL_WARNING_DAYS} days before this date.`,
      type: "date",
      group: "esc",
    },
    {
      ...tagListField("locations", "Locations", "Offered when planning activities and projects.", DEFAULT_LOCATIONS),
      group: "presets",
    },
    {
      ...tagListField("languages", "Languages", "Offered on volunteer profiles.", DEFAULT_LANGUAGES),
      group: "presets",
    },
    {
      ...tagListField("skills", "Skills", "Offered on volunteer profiles.", DEFAULT_SKILLS),
      group: "presets",
    },
    {
      ...tagListField(
        "activityCategories",
        "Activity Categories",
        "Offered when creating activities.",
        DEFAULT_ACTIVITY_CATEGORIES
      ),
      group: "presets",
    },
    {
      name: "whatsappTemplates",
      title: "WhatsApp Templates",
      description: `Placeholders: ${TEMPLATE_PLACEHOLDERS.map((placeholder) => `{${placeholder.key}}`).join(" ")}`,
      type: "array",
      group: "whatsapp",
      initialValue: DEFAULT_WHATSAPP_TEMPLATES.map((template) => ({
        _key: template.key,
        _type: "whatsappTemplate",
        ...template,
      })),
      validation: (Rule: SettingsValidationRule) => Rule.max(SETTINGS_LIMITS.templates),
      of: [
        {
          name: "whatsappTemplate",
          title: "Template",
          type: "object",
          fields: [
            {
              name: "key",
              title: "Key",
              description: "Stable identifier used by the portal. Lowercase letters, numbers, - and _.",
              type: "string",
              validation: (Rule: SettingsValidationRule) =>
                Rule.required().custom((value) =>
                  typeof value !== "string" || TEMPLATE_KEY_PATTERN.test(value)
                    ? true
                    : "Use lowercase letters, numbers, - and _ (max 40 characters)."
                ),
            },
            {
              name: "label",
              title: "Label",
              type: "string",
              validation: (Rule: SettingsValidationRule) => Rule.required().max(SETTINGS_LIMITS.templateLabel),
            },
            {
              name: "text",
              title: "Message",
              type: "text",
              rows: 4,
              validation: (Rule: SettingsValidationRule) =>
                Rule.required()
                  .max(SETTINGS_LIMITS.templateText)
                  .custom((value) => {
                    const unknown = typeof value === "string" ? unknownPlaceholders(value) : [];
                    return unknown.length
                      ? `Unknown placeholder: ${unknown.map((key) => `{${key}}`).join(", ")}`
                      : true;
                  }),
            },
          ],
          preview: { select: { title: "label", subtitle: "text" } },
        },
      ],
    },
    {
      name: "weeklyDigest",
      title: "Weekly Digest Emails",
      type: "boolean",
      group: "notifications",
      initialValue: false,
    },
    {
      name: "registrationAlerts",
      title: "New Registration Alerts",
      type: "boolean",
      group: "notifications",
      initialValue: false,
    },
    {
      name: "updatedAt",
      title: "Updated At",
      type: "datetime",
      readOnly: true,
    },
    {
      name: "updatedBy",
      title: "Updated By",
      type: "string",
      readOnly: true,
    },
    {
      name: "portalRevision",
      title: "Portal Revision",
      type: "string",
      readOnly: true,
      hidden: true,
    },
  ],
};
