// Shared by the public /join page (client) and the submitApplicationAction (server).
// Plain module: no "server-only", no "use client". Never put secrets or volunteer data here.

import {
  APPLICATION_SOURCE_LABELS,
  APPLICATION_SOURCES,
  DIET_OPTIONS,
  ESC_RULES,
  ageOn,
  type ApplicationSource,
  type DietOption,
  type VolunteerType,
} from "@/lib/domain";

/* ---------- Public data shapes (only safe fields ever reach the browser) ---------- */

/** A project as shown on the public join page. Built server-side from a public, open project. */
export interface PublicProject {
  id: string;
  name: string;
  description?: string;
  status: "planned" | "open" | "running";
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  location?: string;
  ageMin?: number;
  ageMax?: number;
  eligibleCountries?: string[];
  applicationDeadline?: string; // YYYY-MM-DD
  /** Remaining places (never negative), or null when the project has no participant limit. */
  spotsLeft: number | null;
  /** False once the application deadline has passed. */
  acceptingApplications: boolean;
}

export interface PublicOrgInfo {
  organizationName: string;
  contactEmail?: string;
  contactPhone?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}

export interface JoinPresets {
  languages: string[];
  skills: string[];
}

export interface PublicJoinData {
  org: PublicOrgInfo;
  projects: PublicProject[];
  presets: JoinPresets;
  /** True when projects could not be loaded (the general application still works). */
  projectsUnavailable: boolean;
}

/* ---------- Form options ---------- */

export const JOIN_VOLUNTEER_TYPES = ["local", "incoming_esc", "domestic"] as const satisfies readonly VolunteerType[];
export type JoinVolunteerType = (typeof JOIN_VOLUNTEER_TYPES)[number];

export const JOIN_VOLUNTEER_TYPE_OPTIONS: Record<JoinVolunteerType, { label: string; description: string }> = {
  local: {
    label: "Local volunteer",
    description: "I live in Martil, Tetouan or nearby.",
  },
  incoming_esc: {
    label: "International (ESC) volunteer",
    description: `I'm coming from abroad with the European Solidarity Corps (ages ${ESC_RULES.minAge}–${ESC_RULES.maxAge}).`,
  },
  domestic: {
    label: "From another Moroccan city",
    description: "I live elsewhere in Morocco and want to join for a while.",
  },
};

export type JoinSource = Exclude<ApplicationSource, "join_page">;
export const JOIN_SOURCES = APPLICATION_SOURCES.filter((source): source is JoinSource => source !== "join_page");
export const JOIN_SOURCE_LABELS: Record<JoinSource, string> = Object.fromEntries(
  JOIN_SOURCES.map((source) => [source, APPLICATION_SOURCE_LABELS[source]])
) as Record<JoinSource, string>;

export const COUNTRY_SUGGESTIONS = [
  "Morocco",
  "Netherlands",
  "Belgium",
  "France",
  "Spain",
  "Portugal",
  "Italy",
  "Germany",
  "Austria",
  "Poland",
  "Czechia",
  "Hungary",
  "Romania",
  "Bulgaria",
  "Greece",
  "Croatia",
  "Slovenia",
  "Slovakia",
  "Lithuania",
  "Latvia",
  "Estonia",
  "Finland",
  "Sweden",
  "Denmark",
  "Ireland",
  "Türkiye",
  "Tunisia",
  "Algeria",
  "Egypt",
  "Jordan",
];

export const NATIONALITY_SUGGESTIONS = [
  "Moroccan",
  "Dutch",
  "Belgian",
  "French",
  "Spanish",
  "Portuguese",
  "Italian",
  "German",
  "Austrian",
  "Polish",
  "Czech",
  "Hungarian",
  "Romanian",
  "Bulgarian",
  "Greek",
  "Croatian",
  "Lithuanian",
  "Finnish",
  "Swedish",
  "Irish",
  "Turkish",
  "Tunisian",
  "Algerian",
];

/* ---------- Limits ---------- */

export const APPLICATION_LIMITS = {
  name: 80,
  email: 254,
  phone: 30,
  place: 80,
  listItems: 15,
  listItemLength: 40,
  motivationMin: 15,
  motivation: 2000,
  longText: 1000,
  code: 40,
  address: 160,
  minAge: 14,
  maxAge: 99,
  /** Raw string length accepted before trimming (rejects oversized payloads early). */
  rawText: 4000,
} as const;

/* ---------- Extra answer options ---------- */

export const GENDER_OPTIONS = ["female", "male", "other", "prefer_not"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  female: "Female",
  male: "Male",
  other: "Other",
  prefer_not: "Prefer not to say",
};

export const OCCUPATION_OPTIONS = ["student", "working", "looking", "other"] as const;
export type Occupation = (typeof OCCUPATION_OPTIONS)[number];
export const OCCUPATION_LABELS: Record<Occupation, string> = {
  student: "Student",
  working: "Working",
  looking: "Looking for work",
  other: "Other",
};

export const DIET_LABELS: Record<DietOption, string> = {
  none: "No special diet",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  halal: "Halal",
  other: "Other (explain under health)",
};

/* ---------- Input / output ---------- */

export interface ApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  nationality: string;
  city: string;
  country: string;
  languages: string[];
  skills: string[];
  volunteerType: JoinVolunteerType | "";
  projectId: string;
  source: JoinSource | "";
  motivation: string;
  gender: Gender | "";
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  escPortalId: string;
  sendingOrganisation: string;
  travelFrom: string;
  availableFrom: string;
  availableTo: string;
  occupation: Occupation | "";
  education: string;
  previousVolunteering: string;
  expectations: string;
  diet: DietOption | "";
  healthNotes: string;
  supportNeeds: string;
  photoConsent: boolean;
  consent: boolean;
  /** Honeypot: hidden from people, must stay empty. */
  website: string;
  /** Signed render timestamp issued by the page (minimum fill time). */
  formToken: string;
}

export type ApplicationField = Exclude<keyof ApplicationInput, "website" | "formToken">;
export type ApplicationFieldErrors = Partial<Record<ApplicationField, string>>;

/** Field order used to focus the first invalid field. */
export const APPLICATION_FIELD_ORDER: ApplicationField[] = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
  "email",
  "phone",
  "address",
  "city",
  "country",
  "emergencyName",
  "emergencyPhone",
  "emergencyRelation",
  "volunteerType",
  "projectId",
  "escPortalId",
  "sendingOrganisation",
  "travelFrom",
  "availableFrom",
  "availableTo",
  "languages",
  "skills",
  "occupation",
  "education",
  "previousVolunteering",
  "expectations",
  "diet",
  "healthNotes",
  "supportNeeds",
  "motivation",
  "source",
  "photoConsent",
  "consent",
];

export interface ParsedApplication {
  firstName: string;
  lastName: string;
  email: string; // lower-case
  phone: string;
  dateOfBirth: string;
  nationality: string;
  city: string;
  country: string;
  languages: string[];
  skills: string[];
  volunteerType: JoinVolunteerType;
  projectId?: string;
  source: ApplicationSource;
  motivation: string;
  gender?: Gender;
  address?: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation?: string;
  escPortalId?: string;
  sendingOrganisation?: string;
  travelFrom?: string;
  availableFrom?: string;
  availableTo?: string;
  occupation?: Occupation;
  education?: string;
  previousVolunteering?: string;
  expectations?: string;
  diet?: DietOption;
  healthNotes?: string;
  supportNeeds?: string;
  photoConsent: boolean;
}

export function emptyApplication(formToken: string, projectId = ""): ApplicationInput {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    nationality: "",
    city: "",
    country: "",
    languages: [],
    skills: [],
    volunteerType: "",
    projectId,
    source: "",
    motivation: "",
    gender: "",
    address: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    escPortalId: "",
    sendingOrganisation: "",
    travelFrom: "",
    availableFrom: "",
    availableTo: "",
    occupation: "",
    education: "",
    previousVolunteering: "",
    expectations: "",
    diet: "",
    healthNotes: "",
    supportNeeds: "",
    photoConsent: false,
    consent: false,
    website: "",
    formToken,
  };
}

/* ---------- Normalisation helpers ---------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
/** Characters that never belong in a name or place (digits, markup, URL and code symbols). */
const NAME_FORBIDDEN = /[0-9<>{}[\]\\/@#$%^&*_=+|~`"!?;:]/;
const LINK_PATTERN = /https?:|www\.|:\/\//i;

/** Removes control characters and bidi overrides; keeps tabs/newlines only when `multiline`. */
function stripControlChars(value: string, multiline: boolean): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32) {
      if (multiline && (code === 9 || code === 10)) {
        out += char;
      } else if (code === 9 || code === 10 || code === 13) {
        out += " ";
      }
      continue;
    }
    if (code === 127 || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) {
      continue;
    }
    out += char;
  }
  return out;
}

export function cleanLine(value: string): string {
  return stripControlChars(value, false).replace(/\s+/g, " ").trim();
}

export function cleanMultiline(value: string): string {
  return stripControlChars(value.replace(/\r\n?/g, "\n"), true)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Local Date for a YYYY-MM-DD key (what ageOn() expects). */
export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Today's date (YYYY-MM-DD) in Martil/Tetouan. */
export function moroccoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysUntil(from: string, to: string): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** "5 Oct 2026" — formatted in UTC so server and browser render the same text. */
export function formatDay(key: string, withYear = true): string {
  if (!isRealDate(key)) {
    return key;
  }
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return formatDay(start);
  }
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDay(start, !sameYear)} – ${formatDay(end)}`;
}

export function formatAgeRange(ageMin?: number, ageMax?: number): string | null {
  if (ageMin !== undefined && ageMax !== undefined) return `Ages ${ageMin}–${ageMax}`;
  if (ageMin !== undefined) return `Ages ${ageMin}+`;
  if (ageMax !== undefined) return `Up to age ${ageMax}`;
  return null;
}

/**
 * Accepts international numbers (+ or 00 prefix). A Moroccan mobile written locally
 * ("06 12 34 56 78") is rewritten to +212 so the WhatsApp link works.
 */
export function normalizePhone(value: string): string {
  const phone = cleanLine(value);
  const digits = phone.replace(/\D/g, "");
  if (!phone.startsWith("+") && !phone.startsWith("00") && /^0[5-7]\d{8}$/.test(digits)) {
    return `+212 ${digits.slice(1)}`;
  }
  return phone;
}

/* ---------- Validation (client and server) ---------- */

function readString(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > APPLICATION_LIMITS.rawText) return null;
  return value;
}

function nameError(value: string, label: string, required: boolean): string | undefined {
  if (!value) return required ? `Please enter your ${label}.` : undefined;
  if (value.length > APPLICATION_LIMITS.name) return `Use ${APPLICATION_LIMITS.name} characters or fewer.`;
  if (NAME_FORBIDDEN.test(value) || LINK_PATTERN.test(value)) return `Please enter a real ${label}.`;
  if (!/[^\s'’.-]/.test(value)) return `Please enter your ${label}.`;
  return undefined;
}

function readList(value: unknown, noun: string): { items: string[]; error?: string } {
  if (value === undefined || value === null) return { items: [] };
  if (!Array.isArray(value) || value.length > APPLICATION_LIMITS.listItems * 4) {
    return { items: [], error: `Your ${noun} could not be read. Please choose them again.` };
  }
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string" || raw.length > APPLICATION_LIMITS.rawText) {
      return { items: [], error: `Your ${noun} could not be read. Please choose them again.` };
    }
    const item = cleanLine(raw);
    if (!item || seen.has(item.toLowerCase())) continue;
    if (item.length > APPLICATION_LIMITS.listItemLength) {
      return { items: [], error: `Each entry must be ${APPLICATION_LIMITS.listItemLength} characters or fewer.` };
    }
    if (/[<>{}\\]/.test(item) || LINK_PATTERN.test(item)) {
      return { items: [], error: `Please remove links and special characters from your ${noun}.` };
    }
    seen.add(item.toLowerCase());
    items.push(item);
  }
  if (items.length > APPLICATION_LIMITS.listItems) {
    return { items: [], error: `Choose at most ${APPLICATION_LIMITS.listItems} ${noun}.` };
  }
  return { items };
}

const MULTILINE_FIELDS = new Set<ApplicationField>([
  "motivation",
  "previousVolunteering",
  "expectations",
  "healthNotes",
  "supportNeeds",
]);

/** Optional single-line free text: length limit, no links or markup. */
function optionalLineError(value: string, max: number): string | undefined {
  if (!value) return undefined;
  if (value.length > max) return `Use ${max} characters or fewer.`;
  if (/[<>{}\\]/.test(value) || LINK_PATTERN.test(value)) return "Please remove links and special characters.";
  return undefined;
}

/** Optional multi-line free text: length limit only. */
function optionalTextError(value: string, max: number): string | undefined {
  if (value.length > max) return `Use ${max} characters or fewer.`;
  return undefined;
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | "" | null {
  if (value === undefined || value === null || value === "") return "";
  return (options as readonly unknown[]).includes(value) ? (value as T) : null;
}

/**
 * Validates an application. Used by the form (for instant feedback) and again by the server action,
 * which never trusts the browser. `today` is YYYY-MM-DD.
 */
export function validateApplication(
  input: unknown,
  today: string
): { data: ParsedApplication | null; errors: ApplicationFieldErrors } {
  const errors: ApplicationFieldErrors = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { data: null, errors: { firstName: "Your application could not be read. Please reload the page." } };
  }
  const data = input as Record<string, unknown>;
  const text = (key: ApplicationField): string => {
    const raw = readString(data[key]);
    if (raw === null) {
      errors[key] = "This answer is too long or invalid.";
      return "";
    }
    return MULTILINE_FIELDS.has(key) ? cleanMultiline(raw) : cleanLine(raw);
  };

  const firstName = text("firstName");
  const lastName = text("lastName");
  errors.firstName ??= nameError(firstName, "first name", true);
  errors.lastName ??= nameError(lastName, "last name", true);

  const email = text("email").toLowerCase();
  if (!errors.email) {
    if (!email) errors.email = "Please enter your email address.";
    else if (email.length > APPLICATION_LIMITS.email || !EMAIL_PATTERN.test(email)) {
      errors.email = "Enter a valid email address, for example name@example.com.";
    }
  }

  const phone = normalizePhone(text("phone"));
  if (!errors.phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (!phone) errors.phone = "Please enter your phone number so we can reach you on WhatsApp.";
    else if (phone.length > APPLICATION_LIMITS.phone || !PHONE_PATTERN.test(phone) || digits < 8 || digits > 15) {
      errors.phone = "Enter a valid phone number, for example +212 6 12 34 56 78.";
    } else if (!/^(\+|00)/.test(phone)) {
      errors.phone = "Start with your country code (for example +212 for Morocco or +31 for the Netherlands).";
    }
  }

  const dateOfBirth = text("dateOfBirth");
  if (!errors.dateOfBirth) {
    if (!dateOfBirth) errors.dateOfBirth = "Please enter your date of birth.";
    else if (!isRealDate(dateOfBirth) || dateOfBirth > today) errors.dateOfBirth = "Enter a valid date of birth.";
    else {
      const age = ageOn(dateOfBirth, dateFromKey(today));
      if (age === null || age > APPLICATION_LIMITS.maxAge) errors.dateOfBirth = "Enter a valid date of birth.";
      else if (age < APPLICATION_LIMITS.minAge) {
        errors.dateOfBirth = `Volunteers must be at least ${APPLICATION_LIMITS.minAge} years old.`;
      }
    }
  }

  const nationality = text("nationality");
  errors.nationality ??= placeError(nationality, "nationality");
  const city = text("city");
  errors.city ??= placeError(city, "city");
  const country = text("country");
  errors.country ??= placeError(country, "country");

  const languages = readList(data.languages, "languages");
  if (languages.error) errors.languages = languages.error;
  const skills = readList(data.skills, "skills");
  if (skills.error) errors.skills = skills.error;

  const volunteerType = data.volunteerType;
  if (!(JOIN_VOLUNTEER_TYPES as readonly unknown[]).includes(volunteerType)) {
    errors.volunteerType = "Choose how you would like to volunteer.";
  }

  const projectId = text("projectId");
  if (projectId && !ID_PATTERN.test(projectId)) {
    errors.projectId = "This project is not available. Choose another one or apply generally.";
  }

  const source = data.source;
  if (source !== undefined && source !== null && source !== "" && !(JOIN_SOURCES as readonly unknown[]).includes(source)) {
    errors.source = "Choose one of the options.";
  }

  const motivation = text("motivation");
  if (!errors.motivation) {
    if (motivation.length < APPLICATION_LIMITS.motivationMin) {
      errors.motivation = motivation
        ? `Tell us a little more (at least ${APPLICATION_LIMITS.motivationMin} characters).`
        : "Tell us briefly why you would like to volunteer with us.";
    } else if (motivation.length > APPLICATION_LIMITS.motivation) {
      errors.motivation = `Use ${APPLICATION_LIMITS.motivation} characters or fewer.`;
    }
  }

  const gender = oneOf(data.gender, GENDER_OPTIONS);
  if (gender === null) errors.gender = "Choose one of the options.";
  const address = text("address");
  errors.address ??= optionalLineError(address, APPLICATION_LIMITS.address);

  const emergencyName = text("emergencyName");
  if (!errors.emergencyName) {
    errors.emergencyName = emergencyName
      ? nameError(emergencyName, "emergency contact's name", true)
      : "Please enter someone we can contact in an emergency.";
  }
  const emergencyPhone = normalizePhone(text("emergencyPhone"));
  if (!errors.emergencyPhone) {
    const digits = emergencyPhone.replace(/\D/g, "").length;
    if (!emergencyPhone) errors.emergencyPhone = "Please enter your emergency contact's phone number.";
    else if (
      emergencyPhone.length > APPLICATION_LIMITS.phone ||
      !PHONE_PATTERN.test(emergencyPhone) ||
      digits < 8 ||
      digits > 15 ||
      !/^(\+|00)/.test(emergencyPhone)
    ) {
      errors.emergencyPhone = "Enter a valid number with country code, for example +31 6 12 34 56 78.";
    }
  }
  const emergencyRelation = text("emergencyRelation");
  errors.emergencyRelation ??= optionalLineError(emergencyRelation, APPLICATION_LIMITS.place);

  const escPortalId = text("escPortalId");
  if (!errors.escPortalId && escPortalId) {
    if (escPortalId.length > APPLICATION_LIMITS.code || !/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(escPortalId)) {
      errors.escPortalId = "Use only letters, numbers and dashes (as shown on the European Youth Portal).";
    }
  }
  const sendingOrganisation = text("sendingOrganisation");
  errors.sendingOrganisation ??= optionalLineError(sendingOrganisation, APPLICATION_LIMITS.name);
  const travelFrom = text("travelFrom");
  errors.travelFrom ??= optionalLineError(travelFrom, APPLICATION_LIMITS.place);

  const availableFrom = text("availableFrom");
  if (!errors.availableFrom && availableFrom && !isRealDate(availableFrom)) errors.availableFrom = "Enter a valid date.";
  const availableTo = text("availableTo");
  if (!errors.availableTo && availableTo) {
    if (!isRealDate(availableTo)) errors.availableTo = "Enter a valid date.";
    else if (availableFrom && isRealDate(availableFrom) && availableTo < availableFrom) {
      errors.availableTo = "The end date must be after the start date.";
    }
  }

  const occupation = oneOf(data.occupation, OCCUPATION_OPTIONS);
  if (occupation === null) errors.occupation = "Choose one of the options.";
  const education = text("education");
  errors.education ??= optionalLineError(education, APPLICATION_LIMITS.name);
  const previousVolunteering = text("previousVolunteering");
  errors.previousVolunteering ??= optionalTextError(previousVolunteering, APPLICATION_LIMITS.longText);
  const expectations = text("expectations");
  errors.expectations ??= optionalTextError(expectations, APPLICATION_LIMITS.longText);

  const diet = oneOf(data.diet, DIET_OPTIONS);
  if (diet === null) errors.diet = "Choose one of the options.";
  const healthNotes = text("healthNotes");
  errors.healthNotes ??= optionalTextError(healthNotes, APPLICATION_LIMITS.longText);
  const supportNeeds = text("supportNeeds");
  errors.supportNeeds ??= optionalTextError(supportNeeds, APPLICATION_LIMITS.longText);

  if (data.photoConsent !== undefined && typeof data.photoConsent !== "boolean") {
    errors.photoConsent = "Please choose yes or no.";
  }

  if (data.consent !== true) {
    errors.consent = "Please agree so we can process your application.";
  }

  for (const key of Object.keys(errors) as ApplicationField[]) {
    if (!errors[key]) delete errors[key];
  }
  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      nationality,
      city,
      country,
      languages: languages.items,
      skills: skills.items,
      volunteerType: volunteerType as JoinVolunteerType,
      projectId: projectId || undefined,
      source: (source || "join_page") as ApplicationSource,
      motivation,
      gender: gender || undefined,
      address: address || undefined,
      emergencyName,
      emergencyPhone,
      emergencyRelation: emergencyRelation || undefined,
      escPortalId: escPortalId || undefined,
      sendingOrganisation: sendingOrganisation || undefined,
      travelFrom: travelFrom || undefined,
      availableFrom: availableFrom || undefined,
      availableTo: availableTo || undefined,
      occupation: occupation || undefined,
      education: education || undefined,
      previousVolunteering: previousVolunteering || undefined,
      expectations: expectations || undefined,
      diet: diet || undefined,
      healthNotes: healthNotes || undefined,
      supportNeeds: supportNeeds || undefined,
      photoConsent: data.photoConsent === true,
    },
    errors: {},
  };
}

function placeError(value: string, label: string): string | undefined {
  if (!value) return `Please enter your ${label}.`;
  if (value.length > APPLICATION_LIMITS.place) return `Use ${APPLICATION_LIMITS.place} characters or fewer.`;
  if (NAME_FORBIDDEN.test(value) || LINK_PATTERN.test(value)) return `Please enter a valid ${label}.`;
  return undefined;
}

/* ---------- Eligibility hints (advice only; staff make the final decision) ---------- */

export interface EligibilityHint {
  tone: "info" | "warning";
  message: string;
}

export function eligibilityHints(
  applicant: { dateOfBirth: string; volunteerType: JoinVolunteerType | ""; country: string },
  project: PublicProject | null,
  today: string
): EligibilityHint[] {
  const hints: EligibilityHint[] = [];
  const validDob = isRealDate(applicant.dateOfBirth) && applicant.dateOfBirth <= today;
  // Age limits apply on the project's start date (or today when it has already started).
  const reference = project && project.startDate > today ? project.startDate : today;
  const age = validDob ? ageOn(applicant.dateOfBirth, dateFromKey(reference)) : null;
  const onStart = reference === today ? "" : " on the start date";

  if (age !== null && project && (project.ageMin !== undefined || project.ageMax !== undefined)) {
    const tooYoung = project.ageMin !== undefined && age < project.ageMin;
    const tooOld = project.ageMax !== undefined && age > project.ageMax;
    if (tooYoung || tooOld) {
      hints.push({
        tone: "warning",
        message: `${project.name} is for ${formatAgeRange(project.ageMin, project.ageMax)?.toLowerCase()}, and you will be ${age}${onStart}. You can still apply and we'll suggest something that fits.`,
      });
    }
  }

  if (age !== null && applicant.volunteerType === "incoming_esc" && (age < ESC_RULES.minAge || age > ESC_RULES.maxAge)) {
    hints.push({
      tone: "warning",
      message: `ESC volunteering is for people aged ${ESC_RULES.minAge}–${ESC_RULES.maxAge}. You can still apply as a self-funded or local volunteer.`,
    });
  }

  if (age !== null && age >= APPLICATION_LIMITS.minAge && age < 18) {
    hints.push({ tone: "info", message: "You're under 18, so we'll ask a parent or guardian to agree before you start." });
  }

  const countries = project?.eligibleCountries ?? [];
  const country = cleanLine(applicant.country).toLowerCase();
  if (countries.length > 0 && country && !countries.some((entry) => entry.toLowerCase() === country)) {
    hints.push({
      tone: "info",
      message: `${project?.name} is open to residents of ${countries.join(", ")}. Not on the list? Apply anyway and we'll look at other options with you.`,
    });
  }

  if (project && project.spotsLeft === 0) {
    hints.push({ tone: "info", message: `${project.name} is full right now. We'll add you to the waiting list.` });
  }

  return hints;
}
