"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, Info, LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { submitApplicationAction } from "@/app/actions/applications";
import {
  APPLICATION_FIELD_ORDER,
  APPLICATION_LIMITS,
  COUNTRY_SUGGESTIONS,
  DIET_LABELS,
  GENDER_LABELS,
  GENDER_OPTIONS,
  OCCUPATION_LABELS,
  OCCUPATION_OPTIONS,
  JOIN_SOURCES,
  JOIN_SOURCE_LABELS,
  JOIN_VOLUNTEER_TYPES,
  JOIN_VOLUNTEER_TYPE_OPTIONS,
  NATIONALITY_SUGGESTIONS,
  cleanLine,
  eligibilityHints,
  emptyApplication,
  formatAgeRange,
  formatDateRange,
  validateApplication,
  type ApplicationField,
  type ApplicationFieldErrors,
  type ApplicationInput,
  type Gender,
  type JoinPresets,
  type Occupation,
  type JoinSource,
  type PublicProject,
} from "../joinShared";
import ChipInput from "./ChipInput";
import { DIET_OPTIONS, type DietOption } from "@/lib/domain";

/* ---------- Styles (match the staff portal's dark slate + emerald inputs) ---------- */

const LABEL_CLASS = "block text-xs font-semibold uppercase tracking-wider text-slate-600";

function inputClass(error?: string) {
  return `w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-none disabled:opacity-60 ${
    error ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-brand-red"
  }`;
}

const fieldId = (field: ApplicationField) => `join-${field}`;

/** aria-describedby for a field: its error when shown, otherwise its hint. */
function describedBy(field: ApplicationField, error: string | undefined, hasHint = false) {
  if (error) return `${fieldId(field)}-error`;
  return hasHint ? `${fieldId(field)}-hint` : undefined;
}

function FieldMessage({ field, error, hint }: { field: ApplicationField; error?: string; hint?: ReactNode }) {
  if (error) {
    return (
      <p id={`${fieldId(field)}-error`} className="flex items-start gap-1.5 text-xs text-rose-600">
        <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    );
  }
  if (!hint) return null;
  return (
    <p id={`${fieldId(field)}-hint`} className="text-xs text-slate-500">
      {hint}
    </p>
  );
}

function LabelText({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <>
      {children}
      {required ? (
        <span className="text-brand-red" aria-hidden="true">
          {" "}
          *
        </span>
      ) : (
        <span className="font-normal normal-case tracking-normal text-slate-500"> (optional)</span>
      )}
    </>
  );
}

function Field({
  field,
  label,
  required,
  error,
  hint,
  children,
}: {
  field: ApplicationField;
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId(field)} className={LABEL_CLASS}>
        <LabelText required={required}>{label}</LabelText>
      </label>
      {children}
      <FieldMessage field={field} error={error} hint={hint} />
    </div>
  );
}

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const titleId = `join-step-${step}-title`;
  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <div className="flex items-start gap-3 border-b border-slate-200 pb-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-xs font-bold text-brand-red"
          aria-hidden="true"
        >
          {step}
        </span>
        <div className="min-w-0">
          <h3 id={titleId} className="text-sm font-bold uppercase tracking-wider text-slate-900">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

type TextField = Exclude<
  ApplicationField,
  "languages" | "skills" | "volunteerType" | "projectId" | "consent" | "photoConsent" | "gender" | "occupation" | "diet" | "source"
>;

function TextInput({
  field,
  label,
  required,
  error,
  hint,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
  maxLength,
  autoComplete,
  min,
  max,
}: {
  field: TextField;
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: "text" | "tel" | "date";
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  min?: string;
  max?: string;
}) {
  return (
    <Field field={field} label={label} required={required} error={error} hint={hint}>
      <input
        id={fieldId(field)}
        type={type}
        inputMode={type === "tel" ? "tel" : undefined}
        autoComplete={autoComplete ?? "off"}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(field, error, !!hint)}
        disabled={disabled}
        className={`${inputClass(error)}${type === "date" ? " [color-scheme:light]" : ""}`}
      />
    </Field>
  );
}

function TextArea({
  field,
  label,
  error,
  hint,
  value,
  onChange,
  disabled,
  placeholder,
  maxLength,
}: {
  field: TextField;
  label: string;
  error?: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder?: string;
  maxLength: number;
}) {
  return (
    <Field field={field} label={label} error={error} hint={hint}>
      <textarea
        id={fieldId(field)}
        rows={3}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(field, error, !!hint)}
        disabled={disabled}
        className={`${inputClass(error)} resize-y leading-relaxed`}
      />
    </Field>
  );
}

function SelectInput<T extends string>({
  field,
  label,
  error,
  value,
  options,
  labels,
  onChange,
  disabled,
}: {
  field: "gender" | "occupation" | "diet";
  label: string;
  error?: string;
  value: T | "";
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T | "") => void;
  disabled: boolean;
}) {
  return (
    <Field field={field} label={label} error={error}>
      <select
        id={fieldId(field)}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T | "")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(field, error)}
        className={inputClass(error)}
      >
        <option value="">Choose an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </Field>
  );
}

/* ---------- Form ---------- */

interface ApplicationFormProps {
  orgName: string;
  /** Open projects that accept applications (the select only offers these). */
  projects: PublicProject[];
  presets: JoinPresets;
  today: string;
  formToken: string;
  projectId: string;
  onProjectChange: (projectId: string) => void;
  onSubmitted: (firstName: string) => void;
}

function focusField(field: ApplicationField) {
  const element = document.getElementById(fieldId(field));
  if (!element) return;
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  element.focus({ preventScroll: true });
}

function firstErrorField(errors: ApplicationFieldErrors): ApplicationField | undefined {
  return APPLICATION_FIELD_ORDER.find((field) => errors[field]);
}

export default function ApplicationForm({
  orgName,
  projects,
  presets,
  today,
  formToken,
  projectId,
  onProjectChange,
  onSubmitted,
}: ApplicationFormProps) {
  const [values, setValues] = useState<ApplicationInput>(() => emptyApplication(formToken));
  const [token, setToken] = useState(formToken);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<ApplicationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // Focus runs after React re-renders, so fields disabled while sending are enabled again first.
  const [focusRequest, setFocusRequest] = useState<{ field: ApplicationField; id: number } | null>(null);

  useEffect(() => {
    if (focusRequest) focusField(focusRequest.field);
  }, [focusRequest]);

  const requestFocus = (errorsToFocus: ApplicationFieldErrors) => {
    const field = firstErrorField(errorsToFocus);
    if (field) setFocusRequest((previous) => ({ field, id: (previous?.id ?? 0) + 1 }));
  };

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const effectiveProjectId = selectedProject ? selectedProject.id : "";
  const current: ApplicationInput = { ...values, projectId: effectiveProjectId, formToken: token };

  // Live validation starts after the first submit attempt; server errors stay until the field changes.
  const errors: ApplicationFieldErrors = {
    ...(showErrors ? validateApplication(current, today).errors : {}),
    ...serverErrors,
  };
  const hints = eligibilityHints(values, selectedProject, today);

  const clearServerError = (field: ApplicationField) => {
    if (!serverErrors[field]) return;
    setServerErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const update = <K extends Exclude<keyof ApplicationInput, "projectId" | "formToken">>(
    key: K,
    value: ApplicationInput[K],
  ) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    if (key !== "website") clearServerError(key as ApplicationField);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setFormError(null);
    setServerErrors({});

    const { errors: clientErrors } = validateApplication(current, today);
    if (Object.keys(clientErrors).length > 0) {
      setShowErrors(true);
      setFormError("Please check the highlighted fields.");
      requestFocus(clientErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitApplicationAction(current);
      if (result.ok) {
        onSubmitted(cleanLine(current.firstName));
        return;
      }
      if ("formToken" in result && result.formToken) setToken(result.formToken);
      if ("fieldErrors" in result && result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setServerErrors(result.fieldErrors);
        setShowErrors(true);
        requestFocus(result.fieldErrors);
      }
      setFormError(result.error);
    } catch {
      setFormError("We couldn't reach our server. Check your internet connection and try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const motivationLength = values.motivation.length;
  const minBirthDate = `${Number(today.slice(0, 4)) - APPLICATION_LIMITS.maxAge - 1}${today.slice(4)}`;

  return (
    <form noValidate onSubmit={handleSubmit} aria-describedby="join-form-required-note" className="relative space-y-8">
      <p id="join-form-required-note" className="text-xs text-slate-500">
        Fields marked <span className="text-brand-red">*</span> are required. It takes about 10 minutes.
      </p>

      {/* Honeypot: hidden from people and assistive technology; bots that fill it are ignored. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-0 h-px w-px overflow-hidden">
        <label htmlFor="join-website">Website (leave this empty)</label>
        <input
          id="join-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => update("website", event.target.value)}
        />
      </div>

      <FormSection step={1} title="About you">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field field="firstName" label="First name" required error={errors.firstName}>
            <input
              id={fieldId("firstName")}
              type="text"
              autoComplete="given-name"
              required
              maxLength={APPLICATION_LIMITS.name}
              value={values.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              aria-invalid={errors.firstName ? true : undefined}
              aria-describedby={describedBy("firstName", errors.firstName)}
              disabled={submitting}
              className={inputClass(errors.firstName)}
            />
          </Field>
          <Field field="lastName" label="Last name" required error={errors.lastName}>
            <input
              id={fieldId("lastName")}
              type="text"
              autoComplete="family-name"
              required
              maxLength={APPLICATION_LIMITS.name}
              value={values.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              aria-invalid={errors.lastName ? true : undefined}
              aria-describedby={describedBy("lastName", errors.lastName)}
              disabled={submitting}
              className={inputClass(errors.lastName)}
            />
          </Field>
          <Field
            field="dateOfBirth"
            label="Date of birth"
            required
            error={errors.dateOfBirth}
            hint="Some projects have age limits (ESC: 18–30)."
          >
            <input
              id={fieldId("dateOfBirth")}
              type="date"
              autoComplete="bday"
              required
              min={minBirthDate}
              max={today}
              value={values.dateOfBirth}
              onChange={(event) => update("dateOfBirth", event.target.value)}
              aria-invalid={errors.dateOfBirth ? true : undefined}
              aria-describedby={describedBy("dateOfBirth", errors.dateOfBirth, true)}
              disabled={submitting}
              className={`${inputClass(errors.dateOfBirth)} [color-scheme:light]`}
            />
          </Field>
          <Field field="nationality" label="Nationality" required error={errors.nationality}>
            <input
              id={fieldId("nationality")}
              type="text"
              list="join-nationality-options"
              autoComplete="off"
              required
              maxLength={APPLICATION_LIMITS.place}
              placeholder="e.g. Moroccan, Dutch, Spanish"
              value={values.nationality}
              onChange={(event) => update("nationality", event.target.value)}
              aria-invalid={errors.nationality ? true : undefined}
              aria-describedby={describedBy("nationality", errors.nationality)}
              disabled={submitting}
              className={inputClass(errors.nationality)}
            />
            <datalist id="join-nationality-options">
              {NATIONALITY_SUGGESTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </Field>
          <SelectInput<Gender>
            field="gender"
            label="Gender"
            error={errors.gender}
            value={values.gender}
            options={GENDER_OPTIONS}
            labels={GENDER_LABELS}
            onChange={(value) => update("gender", value)}
            disabled={submitting}
          />
        </div>
      </FormSection>

      <FormSection
        step={2}
        title="How we can reach you"
        description="We usually reply on WhatsApp, sometimes by email."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field field="email" label="Email" required error={errors.email}>
            <input
              id={fieldId("email")}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={APPLICATION_LIMITS.email}
              placeholder="name@example.com"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy("email", errors.email)}
              disabled={submitting}
              className={inputClass(errors.email)}
            />
          </Field>
          <Field
            field="phone"
            label="Phone (WhatsApp)"
            required
            error={errors.phone}
            hint="Include your country code, e.g. +212 or +31."
          >
            <input
              id={fieldId("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={APPLICATION_LIMITS.phone}
              placeholder="+212 6 12 34 56 78"
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={describedBy("phone", errors.phone, true)}
              disabled={submitting}
              className={inputClass(errors.phone)}
            />
          </Field>
          <Field field="city" label="City you live in" required error={errors.city}>
            <input
              id={fieldId("city")}
              type="text"
              autoComplete="address-level2"
              required
              maxLength={APPLICATION_LIMITS.place}
              placeholder="e.g. Martil, Tetouan, Utrecht"
              value={values.city}
              onChange={(event) => update("city", event.target.value)}
              aria-invalid={errors.city ? true : undefined}
              aria-describedby={describedBy("city", errors.city)}
              disabled={submitting}
              className={inputClass(errors.city)}
            />
          </Field>
          <Field field="country" label="Country you live in" required error={errors.country}>
            <input
              id={fieldId("country")}
              type="text"
              list="join-country-options"
              autoComplete="country-name"
              required
              maxLength={APPLICATION_LIMITS.place}
              placeholder="e.g. Morocco, Netherlands"
              value={values.country}
              onChange={(event) => update("country", event.target.value)}
              aria-invalid={errors.country ? true : undefined}
              aria-describedby={describedBy("country", errors.country)}
              disabled={submitting}
              className={inputClass(errors.country)}
            />
            <datalist id="join-country-options">
              {COUNTRY_SUGGESTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </Field>
          <div className="sm:col-span-2">
            <TextInput
              field="address"
              label="Address (street and number, postcode)"
              error={errors.address}
              value={values.address}
              onChange={(value) => update("address", value)}
              disabled={submitting}
              maxLength={APPLICATION_LIMITS.address}
              autoComplete="street-address"
            />
          </div>
        </div>
      </FormSection>

      <FormSection step={3} title="Emergency contact" description="Someone we can call if something happens to you.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextInput
            field="emergencyName"
            label="Name"
            required
            error={errors.emergencyName}
            value={values.emergencyName}
            onChange={(value) => update("emergencyName", value)}
            disabled={submitting}
            maxLength={APPLICATION_LIMITS.name}
          />
          <TextInput
            field="emergencyPhone"
            label="Phone"
            required
            type="tel"
            error={errors.emergencyPhone}
            value={values.emergencyPhone}
            onChange={(value) => update("emergencyPhone", value)}
            disabled={submitting}
            maxLength={APPLICATION_LIMITS.phone}
            placeholder="+31 6 12 34 56 78"
          />
          <TextInput
            field="emergencyRelation"
            label="Relation to you"
            error={errors.emergencyRelation}
            value={values.emergencyRelation}
            onChange={(value) => update("emergencyRelation", value)}
            disabled={submitting}
            maxLength={APPLICATION_LIMITS.relation}
            placeholder="e.g. mother, partner"
          />
        </div>
      </FormSection>

      <FormSection step={4} title="How you'd like to help">
        <fieldset
          className="space-y-2"
          aria-describedby={errors.volunteerType ? `${fieldId("volunteerType")}-error` : undefined}
        >
          <legend className={`${LABEL_CLASS} mb-2`}>
            <LabelText required>I want to volunteer as</LabelText>
          </legend>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {JOIN_VOLUNTEER_TYPES.map((type, index) => {
              const option = JOIN_VOLUNTEER_TYPE_OPTIONS[type];
              const checked = values.volunteerType === type;
              return (
                <label
                  key={type}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    checked
                      ? "border-red-300 bg-red-50"
                      : errors.volunteerType
                        ? "border-rose-300 bg-white hover:border-rose-400"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    id={index === 0 ? fieldId("volunteerType") : undefined}
                    type="radio"
                    name="volunteerType"
                    value={type}
                    checked={checked}
                    required
                    disabled={submitting}
                    onChange={() => update("volunteerType", type)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#C1272D]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <FieldMessage field="volunteerType" error={errors.volunteerType} />
          {values.volunteerType === "incoming_esc" && (
            <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-800">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ESC placements are funded by the European Solidarity Corps. If you already have a sending organisation,
              mention it below. We help with your arrival via Tangier or Tetouan airport.
            </p>
          )}
        </fieldset>

        {projects.length > 0 ? (
          <Field
            field="projectId"
            label="Project"
            error={errors.projectId}
            hint="Not sure yet? Choose a general application and we'll suggest a project."
          >
            <select
              id={fieldId("projectId")}
              value={effectiveProjectId}
              disabled={submitting}
              onChange={(event) => {
                onProjectChange(event.target.value);
                clearServerError("projectId");
              }}
              aria-invalid={errors.projectId ? true : undefined}
              aria-describedby={describedBy("projectId", errors.projectId, true)}
              className={inputClass(errors.projectId)}
            >
              <option value="">General application — match me with a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({formatDateRange(project.startDate, project.endDate)})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
            <Info className="mt-px h-3.5 w-3.5 shrink-0 text-brand-red" aria-hidden="true" />
            This is a general application — we&apos;ll match you with an activity or project that fits you.
          </p>
        )}

        {selectedProject && (
          <p className="rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5 text-xs leading-relaxed text-red-800">
            <span className="font-semibold text-brand-red">{selectedProject.name}</span>
            {" · "}
            {formatDateRange(selectedProject.startDate, selectedProject.endDate)}
            {selectedProject.location && ` · ${selectedProject.location}`}
            {formatAgeRange(selectedProject.ageMin, selectedProject.ageMax) &&
              ` · ${formatAgeRange(selectedProject.ageMin, selectedProject.ageMax)}`}
          </p>
        )}

        <div role="status" aria-live="polite" className="space-y-2 empty:hidden">
          {hints.map((hint) => (
            <p
              key={hint.message}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${
                hint.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-sky-200 bg-sky-50 text-sky-800"
              }`}
            >
              {hint.tone === "warning" ? (
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              {hint.message}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            field="escPortalId"
            label="European Youth Portal registration number"
            error={errors.escPortalId}
            hint="If you applied through the European Solidarity Corps portal."
            value={values.escPortalId}
            onChange={(value) => update("escPortalId", value)}
            disabled={submitting}
            maxLength={APPLICATION_LIMITS.code}
          />
          <TextInput
            field="sendingOrganisation"
            label="Sending organisation"
            error={errors.sendingOrganisation}
            hint="The organisation in your country that supports you (ESC)."
            value={values.sendingOrganisation}
            onChange={(value) => update("sendingOrganisation", value)}
            disabled={submitting}
            maxLength={APPLICATION_LIMITS.name}
          />
          <TextInput
            field="travelFrom"
            label="City you will travel from"
            error={errors.travelFrom}
            value={values.travelFrom}
            onChange={(value) => update("travelFrom", value)}
            disabled={submitting}
            maxLength={APPLICATION_LIMITS.place}
            placeholder="e.g. Amsterdam, Istanbul"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              field="availableFrom"
              label="Available from"
              type="date"
              error={errors.availableFrom}
              value={values.availableFrom}
              onChange={(value) => update("availableFrom", value)}
              disabled={submitting}
              min={today}
            />
            <TextInput
              field="availableTo"
              label="Available until"
              type="date"
              error={errors.availableTo}
              value={values.availableTo}
              onChange={(value) => update("availableTo", value)}
              disabled={submitting}
              min={values.availableFrom || today}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={fieldId("languages")} className={LABEL_CLASS}>
            <LabelText>Languages you speak</LabelText>
          </label>
          <ChipInput
            id={fieldId("languages")}
            noun="languages"
            presets={presets.languages}
            value={values.languages}
            onChange={(next) => update("languages", next)}
            max={APPLICATION_LIMITS.listItems}
            maxLength={APPLICATION_LIMITS.listItemLength}
            placeholder="Another language…"
            invalid={!!errors.languages}
            describedBy={describedBy("languages", errors.languages)}
            disabled={submitting}
          />
          <FieldMessage field="languages" error={errors.languages} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={fieldId("skills")} className={LABEL_CLASS}>
            <LabelText>Skills you&apos;d like to share</LabelText>
          </label>
          <ChipInput
            id={fieldId("skills")}
            noun="skills"
            presets={presets.skills}
            value={values.skills}
            onChange={(next) => update("skills", next)}
            max={APPLICATION_LIMITS.listItems}
            maxLength={APPLICATION_LIMITS.listItemLength}
            placeholder="Another skill, e.g. Music, Cooking…"
            invalid={!!errors.skills}
            describedBy={describedBy("skills", errors.skills)}
            disabled={submitting}
          />
          <FieldMessage field="skills" error={errors.skills} />
        </div>
      </FormSection>

      <FormSection step={5} title="Your background">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectInput<Occupation>
            field="occupation"
            label="What do you do now?"
            error={errors.occupation}
            value={values.occupation}
            options={OCCUPATION_OPTIONS}
            labels={OCCUPATION_LABELS}
            onChange={(value) => update("occupation", value)}
            disabled={submitting}
          />
          <TextInput
            field="education"
            label="Education / field of study"
            error={errors.education}
            value={values.education}
            onChange={(value) => update("education", value)}
            disabled={submitting}
            maxLength={APPLICATION_LIMITS.name}
            placeholder="e.g. Social work, high school"
          />
        </div>
        <TextArea
          field="previousVolunteering"
          label="Have you volunteered before? Where and what did you do?"
          error={errors.previousVolunteering}
          value={values.previousVolunteering}
          onChange={(value) => update("previousVolunteering", value)}
          disabled={submitting}
          maxLength={APPLICATION_LIMITS.longText}
        />
        <TextArea
          field="expectations"
          label="What would you like to learn or experience?"
          error={errors.expectations}
          value={values.expectations}
          onChange={(value) => update("expectations", value)}
          disabled={submitting}
          maxLength={APPLICATION_LIMITS.longText}
        />
      </FormSection>

      <FormSection
        step={6}
        title="Health & practical"
        description="Only shared with the people organising your project, so we can take care of you."
      >
        <SelectInput<DietOption>
          field="diet"
          label="Diet"
          error={errors.diet}
          value={values.diet}
          options={DIET_OPTIONS}
          labels={DIET_LABELS}
          onChange={(value) => update("diet", value)}
          disabled={submitting}
        />
        <TextArea
          field="healthNotes"
          label="Allergies, medication or health information we should know"
          error={errors.healthNotes}
          value={values.healthNotes}
          onChange={(value) => update("healthNotes", value)}
          disabled={submitting}
          maxLength={APPLICATION_LIMITS.longText}
        />
        <TextArea
          field="supportNeeds"
          label="Is there anything that makes it harder for you to take part, or support you need?"
          error={errors.supportNeeds}
          hint="For example financial, social or health reasons. This helps us include everyone."
          value={values.supportNeeds}
          onChange={(value) => update("supportNeeds", value)}
          disabled={submitting}
          maxLength={APPLICATION_LIMITS.longText}
        />
      </FormSection>

      <FormSection step={7} title="A few words from you">
        <div className="space-y-1.5">
          <label htmlFor={fieldId("motivation")} className={LABEL_CLASS}>
            <LabelText required>Why would you like to volunteer with us?</LabelText>
          </label>
          <textarea
            id={fieldId("motivation")}
            rows={6}
            required
            maxLength={APPLICATION_LIMITS.motivation}
            placeholder="Tell us about yourself, what you'd like to do and when you are available."
            value={values.motivation}
            onChange={(event) => update("motivation", event.target.value)}
            aria-invalid={errors.motivation ? true : undefined}
            aria-describedby={[describedBy("motivation", errors.motivation), "join-motivation-count"]
              .filter(Boolean)
              .join(" ")}
            disabled={submitting}
            className={`${inputClass(errors.motivation)} resize-y leading-relaxed`}
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <FieldMessage field="motivation" error={errors.motivation} />
            </div>
            <span
              id="join-motivation-count"
              className={`shrink-0 text-xs tabular-nums ${
                motivationLength > APPLICATION_LIMITS.motivation * 0.9 ? "text-amber-700" : "text-slate-500"
              }`}
            >
              {motivationLength}/{APPLICATION_LIMITS.motivation}
              <span className="sr-only"> characters</span>
            </span>
          </div>
        </div>

        <Field field="source" label="How did you hear about us?" error={errors.source}>
          <select
            id={fieldId("source")}
            value={values.source}
            disabled={submitting}
            onChange={(event) => update("source", event.target.value as JoinSource | "")}
            aria-invalid={errors.source ? true : undefined}
            aria-describedby={describedBy("source", errors.source)}
            className={inputClass(errors.source)}
          >
            <option value="">Choose an option</option>
            {JOIN_SOURCES.map((source) => (
              <option key={source} value={source}>
                {JOIN_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
          <input
            id={fieldId("photoConsent")}
            type="checkbox"
            checked={values.photoConsent}
            disabled={submitting}
            onChange={(event) => update("photoConsent", event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#C1272D]"
          />
          <span className="text-sm leading-relaxed text-slate-700">
            {orgName} may use photos and videos of me taken during activities on social media.
            <span className="font-normal text-slate-500"> (optional)</span>
          </span>
        </label>

        <div className="space-y-1.5">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
              errors.consent
                ? "border-rose-300 bg-rose-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <input
              id={fieldId("consent")}
              type="checkbox"
              required
              checked={values.consent}
              disabled={submitting}
              onChange={(event) => update("consent", event.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={describedBy("consent", errors.consent)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#C1272D]"
            />
            <span className="text-sm leading-relaxed text-slate-700">
              I agree that {orgName} stores the details in this form, uses them to process my application and to
              contact me about volunteering, and shares them with its partner organisation Stichting Cultined and the
              organisers of the project I apply for.
              <span className="text-brand-red" aria-hidden="true">
                {" "}
                *
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Contact us at any time if you want your details changed or removed.
              </span>
            </span>
          </label>
          <FieldMessage field="consent" error={errors.consent} />
        </div>
      </FormSection>

      <div className="space-y-3 border-t border-slate-200 pt-6">
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          aria-disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-[#a51f24] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        >
          {submitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send application
            </>
          )}
        </button>
        <p className="text-xs text-slate-500">We usually reply within a few days on WhatsApp or by email.</p>
      </div>
    </form>
  );
}
