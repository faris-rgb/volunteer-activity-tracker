"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarPlus,
  ClipboardList,
  HeartPulse,
  IdCard,
  LoaderCircle,
  Lock,
  TriangleAlert,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createVolunteerAction,
  updateVolunteerAction,
  type ApplicationDetails,
  type VolunteerData,
  type VolunteerInput,
} from "@/app/actions/volunteers";
import { GENDER_LABELS, OCCUPATION_LABELS } from "@/app/join/joinShared";
import { formatDateLabel } from "@/lib/dates";
import {
  APPLICATION_SOURCE_LABELS,
  APPLICATION_SOURCES,
  DIET_OPTIONS,
  ESC_RULES,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  VOLUNTEER_TYPE_LABELS,
  VOLUNTEER_TYPES,
  type ApplicationSource,
  type DietOption,
  type PipelineStage,
  type VolunteerType,
} from "@/lib/domain";
import { MembershipBadge } from "./VolunteerBadges";
import ChipPicker from "./ChipPicker";
import {
  DIET_LABELS,
  addYears,
  callAction,
  fullName,
  getAge,
  isOutsideEscAge,
  type VolunteerPresets,
} from "./volunteerUtils";

type Currency = "MAD" | "EUR";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  city: string;
  country: string;
  notes: string;
  active: boolean;
  volunteerType: VolunteerType | "";
  dateOfBirth: string;
  nationality: string;
  diet: DietOption | "";
  skills: string[];
  languages: string[];
  pipelineStage: PipelineStage | "";
  source: ApplicationSource | "";
  intakeNotes: string;
  isMember: boolean;
  memberSince: string;
  paidUntil: string;
  lastPaymentAmount: string;
  lastPaymentCurrency: Currency;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  medicalNotes: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

type SectionId = "basics" | "profile" | "application" | "membership" | "care";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "basics", label: "Basics", icon: UserRound },
  { id: "profile", label: "Profile", icon: IdCard },
  { id: "application", label: "Application", icon: ClipboardList },
  { id: "membership", label: "Membership", icon: Wallet },
  { id: "care", label: "Emergency & health", icon: HeartPulse },
];

/** Field order for focusing the first invalid field, with the section each field lives in. */
const FIELD_SECTIONS: [keyof FormState, SectionId][] = [
  ["firstName", "basics"],
  ["lastName", "basics"],
  ["email", "basics"],
  ["phoneNumber", "basics"],
  ["notes", "basics"],
  ["dateOfBirth", "profile"],
  ["nationality", "profile"],
  ["skills", "profile"],
  ["languages", "profile"],
  ["intakeNotes", "application"],
  ["memberSince", "membership"],
  ["paidUntil", "membership"],
  ["lastPaymentAmount", "membership"],
  ["emergencyName", "care"],
  ["emergencyPhone", "care"],
  ["emergencyRelation", "care"],
  ["medicalNotes", "care"],
];

const NATIONALITY_SUGGESTIONS = [
  "Moroccan",
  "Dutch",
  "Belgian",
  "French",
  "Spanish",
  "Portuguese",
  "Italian",
  "German",
  "Polish",
  "Turkish",
  "Romanian",
  "Greek",
  "Hungarian",
  "Czech",
  "Austrian",
  "Irish",
  "Finnish",
  "Swedish",
];

const MAX_TEXT = 2000;
const MAX_LIST_ITEMS = 30;
const MAX_PAYMENT_AMOUNT = 100_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;

function inputClassName(error?: string) {
  return `w-full bg-slate-950 border rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors disabled:opacity-60 ${
    error ? "border-rose-500/60 focus:border-rose-400" : "border-slate-800 focus:border-emerald-500/50"
  }`;
}

const SELECT_CLASS =
  "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors";

function isValidPhone(phone: string) {
  return PHONE_PATTERN.test(phone) && phone.replace(/\D/g, "").length >= 6;
}

function emptyForm(defaultCountry: string): FormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    city: "",
    country: defaultCountry,
    notes: "",
    active: true,
    volunteerType: "local",
    dateOfBirth: "",
    nationality: "",
    diet: "",
    skills: [],
    languages: [],
    pipelineStage: "lead",
    source: "",
    intakeNotes: "",
    isMember: false,
    memberSince: "",
    paidUntil: "",
    lastPaymentAmount: "",
    lastPaymentCurrency: "MAD",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    medicalNotes: "",
  };
}

function toFormState(vol: VolunteerData): FormState {
  const membership = vol.membership;
  return {
    firstName: vol.firstName,
    lastName: vol.lastName,
    email: vol.email,
    phoneNumber: vol.phoneNumber ?? "",
    city: vol.city ?? "",
    country: vol.country ?? "",
    notes: vol.notes ?? "",
    active: vol.active,
    volunteerType: vol.volunteerType ?? "",
    dateOfBirth: vol.dateOfBirth ?? "",
    nationality: vol.nationality ?? "",
    diet: vol.diet ?? "",
    skills: vol.skills ?? [],
    languages: vol.languages ?? [],
    pipelineStage: vol.pipelineStage ?? "",
    source: vol.source ?? "",
    intakeNotes: vol.intakeNotes ?? "",
    isMember: membership?.isMember ?? false,
    memberSince: membership?.memberSince ?? "",
    paidUntil: membership?.paidUntil ?? "",
    lastPaymentAmount: membership?.lastPaymentAmount !== undefined ? String(membership.lastPaymentAmount) : "",
    lastPaymentCurrency: membership?.lastPaymentCurrency ?? "MAD",
    emergencyName: vol.emergencyContact?.name ?? "",
    emergencyPhone: vol.emergencyContact?.phone ?? "",
    emergencyRelation: vol.emergencyContact?.relation ?? "",
    medicalNotes: vol.medicalNotes ?? "",
  };
}

function validateForm(
  form: FormState,
  volunteers: VolunteerData[],
  editingId: string | null,
  today: string
): FormErrors {
  const errors: FormErrors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";

  const email = form.email.trim().toLowerCase();
  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  } else if (volunteers.some((vol) => vol._id !== editingId && vol.email.toLowerCase() === email)) {
    errors.email = "A volunteer with this email address already exists.";
  }

  const phone = form.phoneNumber.trim();
  if (phone && !isValidPhone(phone)) {
    errors.phoneNumber = "Enter a valid phone number (digits, spaces, +, -, parentheses).";
  }
  if (form.notes.trim().length > MAX_TEXT) errors.notes = `Notes must be at most ${MAX_TEXT} characters.`;

  if (form.dateOfBirth && form.dateOfBirth > today) errors.dateOfBirth = "Date of birth cannot be in the future.";
  if (form.dateOfBirth && form.dateOfBirth < "1900-01-01") errors.dateOfBirth = "Enter a valid date of birth.";
  if (form.nationality.trim().length > 80) errors.nationality = "Nationality must be at most 80 characters.";
  if (form.skills.length > MAX_LIST_ITEMS) errors.skills = `Add at most ${MAX_LIST_ITEMS} skills.`;
  if (form.languages.length > MAX_LIST_ITEMS) errors.languages = `Add at most ${MAX_LIST_ITEMS} languages.`;
  if (form.intakeNotes.trim().length > MAX_TEXT) {
    errors.intakeNotes = `Intake notes must be at most ${MAX_TEXT} characters.`;
  }

  if (form.memberSince && form.memberSince > today) errors.memberSince = "Member since cannot be in the future.";
  if (form.memberSince && form.paidUntil && form.paidUntil < form.memberSince) {
    errors.paidUntil = "Paid until cannot be before the member-since date.";
  }
  if (form.lastPaymentAmount.trim()) {
    const amount = Number(form.lastPaymentAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_PAYMENT_AMOUNT) {
      errors.lastPaymentAmount = `Enter an amount between 0 and ${MAX_PAYMENT_AMOUNT.toLocaleString("en-US")}.`;
    }
  }

  const emergencyPhone = form.emergencyPhone.trim();
  if (emergencyPhone && !isValidPhone(emergencyPhone)) {
    errors.emergencyPhone = "Enter a valid phone number (digits, spaces, +, -, parentheses).";
  }
  if (form.emergencyName.trim().length > 100) errors.emergencyName = "Name must be at most 100 characters.";
  if (form.emergencyRelation.trim().length > 60) errors.emergencyRelation = "Relation must be at most 60 characters.";
  if (form.medicalNotes.trim().length > MAX_TEXT) {
    errors.medicalNotes = `Medical notes must be at most ${MAX_TEXT} characters.`;
  }
  return errors;
}

function toPayload(form: FormState, { canViewMedical }: { canViewMedical: boolean }): VolunteerInput {
  const amount = form.lastPaymentAmount.trim();
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phoneNumber: form.phoneNumber.trim(),
    city: form.city.trim(),
    country: form.country.trim(),
    notes: form.notes.trim(),
    active: form.active,
    skills: form.skills,
    languages: form.languages,
    volunteerType: form.volunteerType || undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    nationality: form.nationality.trim() || undefined,
    diet: form.diet || undefined,
    pipelineStage: form.pipelineStage || undefined,
    source: form.source || undefined,
    intakeNotes: form.intakeNotes.trim() || undefined,
    membership: {
      isMember: form.isMember,
      memberSince: form.memberSince || undefined,
      paidUntil: form.paidUntil || undefined,
      lastPaymentAmount: amount ? Number(amount) : undefined,
      lastPaymentCurrency: amount ? form.lastPaymentCurrency : undefined,
    },
    emergencyContact: {
      name: form.emergencyName.trim() || undefined,
      phone: form.emergencyPhone.trim() || undefined,
      relation: form.emergencyRelation.trim() || undefined,
    },
    ...(canViewMedical ? { medicalNotes: form.medicalNotes.trim() || undefined } : {}),
  };
}

/** Label/value rows for the extra join-form answers (read-only), skipping empty ones. */
function applicationAnswers(details: ApplicationDetails | undefined): [string, string][] {
  if (!details) return [];
  const day = (value?: string) =>
    value ? formatDateLabel(value, { day: "numeric", month: "short", year: "numeric" }) : "?";
  const lookup = (labels: Record<string, string>, value?: string) => (value ? labels[value] ?? value : undefined);
  const rows: [string, string | undefined][] = [
    ["Gender", lookup(GENDER_LABELS, details.gender)],
    ["Address", details.address],
    [
      "Available",
      details.availableFrom || details.availableTo
        ? `${day(details.availableFrom)} – ${day(details.availableTo)}`
        : undefined,
    ],
    ["Travelling from", details.travelFrom],
    ["European Youth Portal ID", details.escPortalId],
    ["Sending organisation", details.sendingOrganisation],
    ["Occupation", lookup(OCCUPATION_LABELS, details.occupation)],
    ["Education", details.education],
    ["Previous volunteering", details.previousVolunteering],
    ["Hopes to learn", details.expectations],
    ["Support needs", details.supportNeeds],
    ["Photo consent", details.photoConsent === undefined ? undefined : details.photoConsent ? "Yes" : "No"],
  ];
  return rows.filter((row): row is [string, string] => !!row[1]);
}

function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <div className="text-xs text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  description,
  children,
}: {
  id: SectionId;
  title: string;
  icon: LucideIcon;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={`volunteer-section-${id}`} aria-labelledby={`volunteer-section-${id}-title`} className="space-y-4 scroll-mt-4">
      <div className="border-b border-slate-800 pb-2">
        <h4
          id={`volunteer-section-${id}-title`}
          className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider"
        >
          <Icon className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          {title}
        </h4>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

interface VolunteerFormDialogProps {
  /** The volunteer to edit, or null to register a new one. */
  volunteer: VolunteerData | null;
  defaultCountry: string;
  presets: VolunteerPresets;
  canViewEmergency: boolean;
  canViewMedical: boolean;
  volunteers: VolunteerData[];
  today: string;
  onClose: () => void;
  onSaved: (volunteer: VolunteerData, created: boolean) => void;
}

export default function VolunteerFormDialog({
  volunteer,
  defaultCountry,
  presets,
  canViewEmergency,
  canViewMedical,
  volunteers,
  today,
  onClose,
  onSaved,
}: VolunteerFormDialogProps) {
  const editingId = volunteer?._id ?? null;
  const [form, setForm] = useState<FormState>(() => (volunteer ? toFormState(volunteer) : emptyForm(defaultCountry)));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const fieldProps = (key: keyof FormState) => ({
    id: `volunteer-${key}`,
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `volunteer-${key}-error` : undefined,
  });

  const scrollToSection = (id: SectionId) => {
    document.getElementById(`volunteer-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renewOneYear = () => {
    const base = form.paidUntil && form.paidUntil >= today ? form.paidUntil : today;
    setForm((prev) => ({
      ...prev,
      isMember: true,
      paidUntil: addYears(base, 1),
      memberSince: prev.memberSince || today,
    }));
    setErrors((prev) => ({ ...prev, paidUntil: undefined, memberSince: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const nextErrors = validateForm(form, volunteers, editingId, today);
    setErrors(nextErrors);
    const firstInvalid = FIELD_SECTIONS.find(([key]) => nextErrors[key]);
    if (firstInvalid) {
      setFormError(null);
      document.getElementById(`volunteer-${firstInvalid[0]}`)?.focus();
      return;
    }

    setFormError(null);
    setIsSaving(true);
    const payload = toPayload(form, { canViewMedical });
    const result = await callAction(() =>
      editingId ? updateVolunteerAction(editingId, payload) : createVolunteerAction(payload)
    );
    setIsSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      formRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    onSaved(result.data, !editingId);
  };

  const sectionHasError = (id: SectionId) => FIELD_SECTIONS.some(([key, section]) => section === id && errors[key]);

  const age = getAge(form.dateOfBirth, today);
  const escAgeWarning = form.volunteerType === "incoming_esc" && isOutsideEscAge(age);
  const appliedProjectId = volunteer?.appliedProjectId;
  const motivation = volunteer?.motivation;
  const joinAnswers = applicationAnswers(volunteer?.applicationDetails);

  return (
    <div
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="volunteer-form-title"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex justify-between items-center gap-3 bg-slate-950/40">
          <div className="min-w-0">
            <h3 id="volunteer-form-title" className="text-lg font-bold text-white truncate">
              {volunteer ? `Edit ${fullName(volunteer) || "volunteer"}` : "Register New Volunteer"}
            </h3>
            <p className="text-xs text-slate-500">Fields marked * are required.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Form sections" className="px-4 sm:px-6 py-2.5 border-b border-slate-800 overflow-x-auto">
          <div className="flex gap-1.5 w-max">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
                {sectionHasError(id) && (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" aria-hidden="true" />
                    <span className="sr-only">(has errors)</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </nav>

        <form
          id="volunteer-form"
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-8"
        >
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              {formError}
            </div>
          )}

          {/* Basics */}
          <Section id="basics" title="Basics" icon={UserRound}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="volunteer-firstName" label="First Name *" error={errors.firstName}>
                <input
                  {...fieldProps("firstName")}
                  type="text"
                  autoFocus
                  autoComplete="given-name"
                  maxLength={80}
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  className={inputClassName(errors.firstName)}
                />
              </FormField>
              <FormField id="volunteer-lastName" label="Last Name *" error={errors.lastName}>
                <input
                  {...fieldProps("lastName")}
                  type="text"
                  autoComplete="family-name"
                  maxLength={80}
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  className={inputClassName(errors.lastName)}
                />
              </FormField>
              <FormField id="volunteer-email" label="Email Address *" error={errors.email}>
                <input
                  {...fieldProps("email")}
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={inputClassName(errors.email)}
                />
              </FormField>
              <FormField
                id="volunteer-phoneNumber"
                label="Phone / WhatsApp"
                error={errors.phoneNumber}
                hint="Include the country code, e.g. +212 6 12 34 56 78."
              >
                <input
                  {...fieldProps("phoneNumber")}
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  value={form.phoneNumber}
                  onChange={(e) => updateField("phoneNumber", e.target.value)}
                  placeholder="+212 6 12 34 56 78"
                  className={inputClassName(errors.phoneNumber)}
                />
              </FormField>
              <FormField id="volunteer-city" label="City">
                <input
                  id="volunteer-city"
                  type="text"
                  autoComplete="address-level2"
                  maxLength={80}
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="e.g. Martil"
                  className={inputClassName()}
                />
              </FormField>
              <FormField id="volunteer-country" label="Country of residence">
                <input
                  id="volunteer-country"
                  type="text"
                  autoComplete="country-name"
                  maxLength={80}
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  className={inputClassName()}
                />
              </FormField>
            </div>

            <FormField
              id="volunteer-notes"
              label="Notes"
              error={errors.notes}
              hint={`${form.notes.length}/${MAX_TEXT} characters`}
            >
              <textarea
                {...fieldProps("notes")}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
                maxLength={MAX_TEXT}
                className={`${inputClassName(errors.notes)} p-4 resize-none`}
              />
            </FormField>

            <label
              htmlFor="volunteer-active"
              className="flex items-center justify-between gap-4 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer"
            >
              <span>
                <span className="text-sm font-semibold text-white block">Active Status</span>
                <span className="text-xs text-slate-500 block">
                  Active volunteers can be assigned to activities and checked in.
                </span>
              </span>
              <input
                id="volunteer-active"
                type="checkbox"
                checked={form.active}
                onChange={(e) => updateField("active", e.target.checked)}
                className="h-4.5 w-4.5 shrink-0 rounded accent-emerald-500"
              />
            </label>
          </Section>

          {/* Profile */}
          <Section id="profile" title="Profile" icon={IdCard}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="volunteer-volunteerType" label="Volunteer type">
                <select
                  id="volunteer-volunteerType"
                  value={form.volunteerType}
                  onChange={(e) => updateField("volunteerType", e.target.value as FormState["volunteerType"])}
                  className={SELECT_CLASS}
                >
                  <option value="">Not specified</option>
                  {VOLUNTEER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {VOLUNTEER_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id="volunteer-dateOfBirth"
                label={
                  <span className="flex items-center justify-between gap-2">
                    Date of birth
                    {age !== null && !errors.dateOfBirth && (
                      <span className={`normal-case tracking-normal ${escAgeWarning ? "text-amber-300" : "text-emerald-300"}`}>
                        Age {age}
                      </span>
                    )}
                  </span>
                }
                error={errors.dateOfBirth}
                hint={
                  escAgeWarning ? (
                    <span role="status" className="flex items-start gap-1.5 text-amber-300">
                      <TriangleAlert className="h-3.5 w-3.5 mt-px shrink-0" />
                      Outside ESC age {ESC_RULES.minAge}-{ESC_RULES.maxAge}. Check eligibility before accepting.
                    </span>
                  ) : form.volunteerType === "incoming_esc" && age === null ? (
                    `Needed for the ESC age check (${ESC_RULES.minAge}-${ESC_RULES.maxAge}).`
                  ) : undefined
                }
              >
                <input
                  {...fieldProps("dateOfBirth")}
                  type="date"
                  min="1900-01-01"
                  max={today}
                  value={form.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  className={`${inputClassName(errors.dateOfBirth)} [color-scheme:dark]`}
                />
              </FormField>
              <FormField id="volunteer-nationality" label="Nationality" error={errors.nationality}>
                <input
                  {...fieldProps("nationality")}
                  type="text"
                  list="volunteer-nationality-options"
                  maxLength={80}
                  value={form.nationality}
                  onChange={(e) => updateField("nationality", e.target.value)}
                  placeholder="e.g. Moroccan, Dutch"
                  className={inputClassName(errors.nationality)}
                />
                <datalist id="volunteer-nationality-options">
                  {NATIONALITY_SUGGESTIONS.map((nationality) => (
                    <option key={nationality} value={nationality} />
                  ))}
                </datalist>
              </FormField>
              <FormField id="volunteer-diet" label="Diet">
                <select
                  id="volunteer-diet"
                  value={form.diet}
                  onChange={(e) => updateField("diet", e.target.value as FormState["diet"])}
                  className={SELECT_CLASS}
                >
                  <option value="">Not specified</option>
                  {DIET_OPTIONS.map((diet) => (
                    <option key={diet} value={diet}>
                      {DIET_LABELS[diet]}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField id="volunteer-skills" label="Skills" error={errors.skills}>
              <ChipPicker
                id="volunteer-skills"
                noun="skills"
                presets={presets.skills}
                value={form.skills}
                onChange={(next) => updateField("skills", next)}
                invalid={!!errors.skills}
                describedBy={errors.skills ? "volunteer-skills-error" : undefined}
              />
            </FormField>
            <FormField id="volunteer-languages" label="Languages" error={errors.languages}>
              <ChipPicker
                id="volunteer-languages"
                noun="languages"
                presets={presets.languages}
                value={form.languages}
                onChange={(next) => updateField("languages", next)}
                invalid={!!errors.languages}
                describedBy={errors.languages ? "volunteer-languages-error" : undefined}
              />
            </FormField>
          </Section>

          {/* Application */}
          <Section
            id="application"
            title="Application"
            icon={ClipboardList}
            description="Where this volunteer is in the intake process."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="volunteer-pipelineStage" label="Pipeline stage">
                <select
                  id="volunteer-pipelineStage"
                  value={form.pipelineStage}
                  onChange={(e) => updateField("pipelineStage", e.target.value as FormState["pipelineStage"])}
                  className={SELECT_CLASS}
                >
                  <option value="">Not in the pipeline</option>
                  {PIPELINE_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {PIPELINE_STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="volunteer-source" label="How did they find us?">
                <select
                  id="volunteer-source"
                  value={form.source}
                  onChange={(e) => updateField("source", e.target.value as FormState["source"])}
                  className={SELECT_CLASS}
                >
                  <option value="">Not specified</option>
                  {APPLICATION_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {APPLICATION_SOURCE_LABELS[source]}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {appliedProjectId && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Applied for project</span>
                <span className="text-sm text-white mt-1 block">
                  {volunteer?.appliedProjectName ?? "A project that is no longer available"}
                </span>
              </div>
            )}

            {motivation && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  Motivation
                  <span className="normal-case tracking-normal font-normal text-slate-600">(from the join form)</span>
                </span>
                <p className="text-sm text-slate-300 mt-1.5 whitespace-pre-wrap break-words">{motivation}</p>
              </div>
            )}

            {joinAnswers.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  Other answers
                  <span className="normal-case tracking-normal font-normal text-slate-600">(from the join form)</span>
                </span>
                <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {joinAnswers.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11px] text-slate-500">{label}</dt>
                      <dd className="text-sm text-slate-300 whitespace-pre-wrap break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <FormField
              id="volunteer-intakeNotes"
              label="Intake notes"
              error={errors.intakeNotes}
              hint={`Notes from the exploratory meeting · ${form.intakeNotes.length}/${MAX_TEXT}`}
            >
              <textarea
                {...fieldProps("intakeNotes")}
                value={form.intakeNotes}
                onChange={(e) => updateField("intakeNotes", e.target.value)}
                rows={3}
                maxLength={MAX_TEXT}
                className={`${inputClassName(errors.intakeNotes)} p-4 resize-none`}
              />
            </FormField>
          </Section>

          {/* Membership */}
          <Section
            id="membership"
            title="Membership"
            icon={Wallet}
            description="Members of the association (Vimians) pay a yearly membership fee."
          >
            <label
              htmlFor="volunteer-isMember"
              className="flex items-center justify-between gap-4 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer"
            >
              <span className="min-w-0">
                <span className="text-sm font-semibold text-white flex flex-wrap items-center gap-2">
                  Member of the association
                  <MembershipBadge
                    membership={{ isMember: form.isMember, paidUntil: form.paidUntil || undefined }}
                    today={today}
                  />
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Paid until today or later counts as active; an earlier date as expired.
                </span>
              </span>
              <input
                id="volunteer-isMember"
                type="checkbox"
                checked={form.isMember}
                onChange={(e) => updateField("isMember", e.target.checked)}
                className="h-4.5 w-4.5 shrink-0 rounded accent-emerald-500"
              />
            </label>

            {form.isMember && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="volunteer-memberSince" label="Member since" error={errors.memberSince}>
                    <input
                      {...fieldProps("memberSince")}
                      type="date"
                      max={today}
                      value={form.memberSince}
                      onChange={(e) => updateField("memberSince", e.target.value)}
                      className={`${inputClassName(errors.memberSince)} [color-scheme:dark]`}
                    />
                  </FormField>
                  <FormField id="volunteer-paidUntil" label="Paid until" error={errors.paidUntil}>
                    <div className="flex gap-2">
                      <input
                        {...fieldProps("paidUntil")}
                        type="date"
                        min={form.memberSince || undefined}
                        value={form.paidUntil}
                        onChange={(e) => updateField("paidUntil", e.target.value)}
                        className={`${inputClassName(errors.paidUntil)} [color-scheme:dark] min-w-0`}
                      />
                      <button
                        type="button"
                        onClick={renewOneYear}
                        title="Extend the membership by one year"
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        +1 year
                      </button>
                    </div>
                  </FormField>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2 sm:max-w-sm">
                  <FormField id="volunteer-lastPaymentAmount" label="Last payment" error={errors.lastPaymentAmount}>
                    <input
                      {...fieldProps("lastPaymentAmount")}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={MAX_PAYMENT_AMOUNT}
                      step="0.01"
                      value={form.lastPaymentAmount}
                      onChange={(e) => updateField("lastPaymentAmount", e.target.value)}
                      placeholder="e.g. 100"
                      className={inputClassName(errors.lastPaymentAmount)}
                    />
                  </FormField>
                  <FormField id="volunteer-lastPaymentCurrency" label="Currency">
                    <select
                      id="volunteer-lastPaymentCurrency"
                      value={form.lastPaymentCurrency}
                      onChange={(e) => updateField("lastPaymentCurrency", e.target.value as Currency)}
                      className={SELECT_CLASS}
                    >
                      <option value="MAD">MAD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </FormField>
                </div>
              </>
            )}
          </Section>

          {/* Emergency & health */}
          {(canViewEmergency || canViewMedical) && (
            <Section
              id="care"
              title="Emergency & health"
              icon={HeartPulse}
              description="Confidential. Only shown to the team members who need it."
            >
              {canViewEmergency && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField id="volunteer-emergencyName" label="Emergency contact" error={errors.emergencyName}>
                    <input
                      {...fieldProps("emergencyName")}
                      type="text"
                      maxLength={100}
                      value={form.emergencyName}
                      onChange={(e) => updateField("emergencyName", e.target.value)}
                      placeholder="Full name"
                      className={inputClassName(errors.emergencyName)}
                    />
                  </FormField>
                  <FormField id="volunteer-emergencyPhone" label="Contact phone" error={errors.emergencyPhone}>
                    <input
                      {...fieldProps("emergencyPhone")}
                      type="tel"
                      maxLength={30}
                      value={form.emergencyPhone}
                      onChange={(e) => updateField("emergencyPhone", e.target.value)}
                      placeholder="+31 6 1234 5678"
                      className={inputClassName(errors.emergencyPhone)}
                    />
                  </FormField>
                  <FormField id="volunteer-emergencyRelation" label="Relation" error={errors.emergencyRelation}>
                    <input
                      {...fieldProps("emergencyRelation")}
                      type="text"
                      maxLength={60}
                      value={form.emergencyRelation}
                      onChange={(e) => updateField("emergencyRelation", e.target.value)}
                      placeholder="e.g. Mother"
                      className={inputClassName(errors.emergencyRelation)}
                    />
                  </FormField>
                </div>
              )}

              {canViewMedical ? (
                <FormField
                  id="volunteer-medicalNotes"
                  label={
                    <span className="flex items-center gap-1.5">
                      Medical notes
                      <Lock className="h-3 w-3 text-slate-500" aria-hidden="true" />
                      <span className="normal-case tracking-normal font-normal text-slate-600">owners & admins only</span>
                    </span>
                  }
                  error={errors.medicalNotes}
                  hint={`Allergies, conditions, medication · ${form.medicalNotes.length}/${MAX_TEXT}`}
                >
                  <textarea
                    {...fieldProps("medicalNotes")}
                    value={form.medicalNotes}
                    onChange={(e) => updateField("medicalNotes", e.target.value)}
                    rows={3}
                    maxLength={MAX_TEXT}
                    className={`${inputClassName(errors.medicalNotes)} p-4 resize-none`}
                  />
                </FormField>
              ) : (
                <p className="flex items-center gap-2 text-xs text-slate-500 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Medical notes are only visible to owners and admins. Saving here keeps them unchanged.
                </p>
              )}
            </Section>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-800/80 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="volunteer-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : volunteer ? "Save Changes" : "Add Volunteer"}
          </button>
        </div>
      </div>
    </div>
  );
}
