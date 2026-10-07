// Shared domain contract for Volunteer in Morocco features. Plain module (no server-only),
// safe to import from client and server code. Feature modules must use these names.

/* ---------- Presets (seeded from the organisation's real work in Martil/Tetouan) ---------- */

export const VOLUNTEER_TYPES = ["local", "incoming_esc", "outgoing", "domestic"] as const;
export type VolunteerType = (typeof VOLUNTEER_TYPES)[number];
export const VOLUNTEER_TYPE_LABELS: Record<VolunteerType, string> = {
  local: "Local volunteer",
  incoming_esc: "International (ESC) volunteer",
  outgoing: "Moroccan volunteer abroad",
  domestic: "Volunteer from another Moroccan city",
};

export const PIPELINE_STAGES = ["lead", "meeting", "accepted", "arrived", "completed", "withdrawn"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  lead: "Applied",
  meeting: "Exploratory meeting",
  accepted: "Accepted",
  arrived: "Arrived / active",
  completed: "Completed",
  withdrawn: "Withdrawn",
};

export const APPLICATION_SOURCES = [
  "instagram",
  "facebook",
  "esc_portal",
  "join_page",
  "partner",
  "referral",
  "other",
] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];
export const APPLICATION_SOURCE_LABELS: Record<ApplicationSource, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  esc_portal: "European Youth Portal (ESC)",
  join_page: "ServeTrack join page",
  partner: "Partner organisation",
  referral: "Friend / referral",
  other: "Other",
};

export const DEFAULT_LOCATIONS = ["Martil", "Tetouan", "Amsa Beach", "Tangier"] as const;
export const DEFAULT_LANGUAGES = [
  "Darija",
  "Arabic",
  "Tamazight",
  "French",
  "English",
  "Spanish",
  "Dutch",
  "Turkish",
  "German",
] as const;
export const DEFAULT_SKILLS = [
  "English teaching",
  "Sports coaching",
  "Web design",
  "Online marketing",
  "Social media",
  "Photography",
  "Filming",
  "Video editing",
  "Workshops",
  "First aid",
] as const;
export const DEFAULT_ACTIVITY_CATEGORIES = [
  "Environment & clean-up",
  "Sports & inclusion",
  "Community care visits",
  "Clothing bank & upcycling",
  "English lessons",
  "Language café",
  "Digital skills & media",
  "Training & orientation",
] as const;

/** Impact counters that can be logged per activity and are totalled on the dashboard. */
export const IMPACT_METRICS = [
  { key: "participants", label: "Local participants", unit: "people" },
  { key: "families", label: "Families helped", unit: "families" },
  { key: "clothes", label: "Clothes distributed", unit: "items" },
  { key: "waste_kg", label: "Waste collected", unit: "kg" },
  { key: "bikes", label: "Bikes repaired", unit: "bikes" },
  { key: "lessons", label: "Lessons given", unit: "lessons" },
  { key: "institutions", label: "Institutions visited", unit: "visits" },
] as const;
export type ImpactMetricKey = (typeof IMPACT_METRICS)[number]["key"];
export interface ImpactEntry {
  metric: ImpactMetricKey;
  value: number;
}

export const ARRIVAL_AIRPORTS = [
  { code: "TTU", label: "Tetouan Sania Ramel (TTU)" },
  { code: "TNG", label: "Tangier Ibn Battuta (TNG)" },
  { code: "RBA", label: "Rabat-Salé (RBA)" },
  { code: "CMN", label: "Casablanca Mohammed V (CMN)" },
  { code: "OTHER", label: "Other / overland" },
] as const;
export type ArrivalAirportCode = (typeof ARRIVAL_AIRPORTS)[number]["code"];

export const PICKUP_STATUSES = ["not_needed", "scheduled", "picked_up", "no_show", "changed"] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const STAY_STATUSES = ["planned", "confirmed", "arrived", "completed", "cancelled"] as const;
export type StayStatus = (typeof STAY_STATUSES)[number];

export const YOUTHPASS_STATUSES = ["not_applicable", "requested", "issued"] as const;
export type YouthpassStatus = (typeof YOUTHPASS_STATUSES)[number];

export const ALLOWANCE_TYPES = ["pocket_money", "food", "travel"] as const;
export type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

export const DIET_OPTIONS = ["none", "vegetarian", "vegan", "halal", "other"] as const;
export type DietOption = (typeof DIET_OPTIONS)[number];

export const FUNDING_TYPES = ["esc", "self_funded", "partner", "other"] as const;
export type FundingType = (typeof FUNDING_TYPES)[number];

export const PROJECT_STATUSES = ["planned", "open", "running", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** ESC rules used for warnings. */
export const ESC_RULES = {
  minAge: 18,
  maxAge: 30,
  minWeeklyHours: 30,
  maxWeeklyHours: 38,
  visaFreeDays: 90,
  visaWarningDay: 80,
} as const;

/* ---------- Portal settings presets (stored on the portalSettings document) ---------- */

export interface WhatsAppTemplate {
  key: string;
  label: string;
  text: string; // may contain {firstName}, {project}, {date}, {time}, {org}
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  { key: "welcome", label: "Welcome", text: "Hi {firstName}, welcome to {org}! We're happy to have you. Reply here if you have any questions." },
  { key: "pickup", label: "Pickup confirmed", text: "Hi {firstName}, your airport pickup is confirmed for {date} at {time}. Look for our team at arrivals." },
  { key: "reminder", label: "Activity reminder", text: "Hi {firstName}, reminder: {project} on {date} at {time}. See you there!" },
  { key: "documents", label: "Missing documents", text: "Hi {firstName}, we still need a few documents from you (passport copy / insurance). Could you send them?" },
];

/**
 * Extra fields on PortalSettings (src/app/actions/settings.ts) readable by every signed-in role.
 * Defaults come from the DEFAULT_* presets above.
 */
export interface PortalPresets {
  locations: string[];
  languages: string[];
  skills: string[];
  activityCategories: string[];
  whatsappTemplates: WhatsAppTemplate[];
  contactEmail?: string;
  contactPhone?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  escPic?: string;
  escOid?: string;
  escLabelExpiry?: string; // YYYY-MM-DD
}

/** Fills {placeholders} in a WhatsApp template. Unknown placeholders are left empty. */
export function fillTemplate(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

/* ---------- Entities (Sanity documents, as returned by the actions) ---------- */

export interface Membership {
  isMember: boolean;
  memberSince?: string; // YYYY-MM-DD
  paidUntil?: string; // YYYY-MM-DD
  lastPaymentAmount?: number;
  lastPaymentCurrency?: "MAD" | "EUR";
}

export interface EmergencyContact {
  name?: string;
  phone?: string;
  relation?: string;
}

/** Extra volunteer profile fields (added to the existing volunteer document). */
export interface VolunteerProfileExtras {
  volunteerType?: VolunteerType;
  dateOfBirth?: string; // YYYY-MM-DD
  nationality?: string;
  pipelineStage?: PipelineStage;
  source?: ApplicationSource;
  intakeNotes?: string;
  membership?: Membership;
  emergencyContact?: EmergencyContact; // managers only
  medicalNotes?: string; // owner/admin only
  diet?: DietOption;
  appliedProjectId?: string; // project chosen on the public /join form
  motivation?: string; // from the public /join form
}

export interface Partner {
  _id: string;
  name: string;
  country?: string;
  type?: "ngo" | "school" | "care_home" | "orphanage" | "municipality" | "sending_org" | "other";
  website?: string;
  notes?: string;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  location?: string;
  maxParticipants?: number;
  ageMin?: number;
  ageMax?: number;
  eligibleCountries?: string[];
  applicationDeadline?: string; // YYYY-MM-DD
  funding?: FundingType;
  escProjectCode?: string;
  partnerIds?: string[];
  isPublic: boolean; // shown on the public /join page
  createdAt?: string;
}

export interface Room {
  _id: string;
  name: string;
  location?: string;
  beds: number;
  notes?: string;
}

export interface AllowancePayment {
  _key: string;
  type: AllowanceType;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: "MAD" | "EUR";
  note?: string;
}

export interface StayDocuments {
  passportChecked?: boolean;
  passportExpiry?: string; // YYYY-MM-DD
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  criminalRecordDate?: string; // YYYY-MM-DD
  agreementSigned?: boolean;
  photoConsent?: boolean;
}

/** One volunteer's stay/placement (period in Morocco, optionally tied to a project). */
export interface Stay {
  _id: string;
  volunteerId: string;
  projectId?: string;
  status: StayStatus;
  arrivalDate?: string; // YYYY-MM-DD
  departureDate?: string; // YYYY-MM-DD
  arrivalTime?: string; // HH:mm
  arrivalAirport?: ArrivalAirportCode;
  flightNumber?: string;
  pickupBy?: string;
  pickupStatus?: PickupStatus;
  roomId?: string;
  documents?: StayDocuments;
  youthpassStatus?: YouthpassStatus;
  allowances?: AllowancePayment[];
  notes?: string;
  createdAt?: string;
}

/* ---------- Helpers ---------- */

/** Whole years between dateOfBirth (YYYY-MM-DD) and `on` (default today). */
export function ageOn(dateOfBirth: string | undefined, on: Date = new Date()): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age -= 1;
  return age;
}

/** wa.me click-to-chat link. Returns null when the phone has too few digits. */
export function whatsappLink(phone: string | undefined, text?: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
