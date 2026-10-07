"use client";

import React, { useMemo, useState } from "react";
import { Info, LoaderCircle, Plus, Search, TriangleAlert } from "lucide-react";
import {
  createPartnerAction,
  createProjectAction,
  updateProjectAction,
  type ProjectInput,
  type ProjectWithStats,
} from "@/app/actions/projects";
import {
  ESC_RULES,
  FUNDING_TYPES,
  PROJECT_STATUSES,
  type FundingType,
  type Partner,
  type ProjectStatus,
} from "@/lib/domain";
import { ESC_PROJECT_CODE_PATTERN, FUNDING_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/sanity/schemas/project";
import { PARTNER_TYPE_LABELS } from "@/sanity/schemas/partner";
import {
  COUNTRY_SUGGESTIONS,
  INPUT_CLASS,
  LABEL_CLASS,
  Modal,
  NETWORK_ERROR,
  SECONDARY_BUTTON,
  Switch,
  TagInput,
  pluralize,
} from "./ui";

interface ProjectFormModalProps {
  /** The project being edited, or null to create one. */
  project: ProjectWithStats | null;
  partners: Partner[];
  locations: string[];
  onClose: () => void;
  onSaved: (project: ProjectWithStats, created: boolean) => void;
  onNotFound: (projectId: string, message: string) => void;
  onPartnerCreated: (partner: Partner) => void;
  onResync: () => void;
}

interface FormState {
  name: string;
  description: string;
  status: ProjectStatus;
  funding: FundingType | "";
  escProjectCode: string;
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  location: string;
  maxParticipants: string;
  ageMin: string;
  ageMax: string;
  eligibleCountries: string[];
  partnerIds: string[];
  isPublic: boolean;
}

type FieldKey = keyof FormState;

interface FormError {
  field: FieldKey | null;
  message: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  status: "planned",
  funding: "",
  escProjectCode: "",
  startDate: "",
  endDate: "",
  applicationDeadline: "",
  location: "",
  maxParticipants: "",
  ageMin: "",
  ageMax: "",
  eligibleCountries: [],
  partnerIds: [],
  isPublic: false,
};

function toFormState(project: ProjectWithStats): FormState {
  return {
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    funding: project.funding ?? "",
    escProjectCode: project.escProjectCode ?? "",
    startDate: project.startDate,
    endDate: project.endDate,
    applicationDeadline: project.applicationDeadline ?? "",
    location: project.location ?? "",
    maxParticipants: project.maxParticipants !== undefined ? String(project.maxParticipants) : "",
    ageMin: project.ageMin !== undefined ? String(project.ageMin) : "",
    ageMax: project.ageMax !== undefined ? String(project.ageMax) : "",
    eligibleCountries: project.eligibleCountries ?? [],
    partnerIds: project.partnerIds ?? [],
    isPublic: project.isPublic,
  };
}

function parseOptionalInteger(value: string): number | undefined | null {
  const text = value.trim();
  if (!text) return undefined;
  const number = Number(text);
  return Number.isInteger(number) ? number : null;
}

function validateForm(form: FormState): FormError | null {
  if (!form.name.trim()) return { field: "name", message: "Project name is required." };
  if (!form.startDate) return { field: "startDate", message: "Start date is required." };
  if (!form.endDate) return { field: "endDate", message: "End date is required." };
  if (form.endDate < form.startDate) return { field: "endDate", message: "End date can't be before the start date." };

  const maxParticipants = parseOptionalInteger(form.maxParticipants);
  if (maxParticipants === null || (maxParticipants !== undefined && (maxParticipants < 1 || maxParticipants > 10000))) {
    return { field: "maxParticipants", message: "Maximum participants must be a whole number between 1 and 10,000." };
  }

  const ageMin = parseOptionalInteger(form.ageMin);
  if (ageMin === null || (ageMin !== undefined && (ageMin < 0 || ageMin > 120))) {
    return { field: "ageMin", message: "Minimum age must be a whole number between 0 and 120." };
  }
  const ageMax = parseOptionalInteger(form.ageMax);
  if (ageMax === null || (ageMax !== undefined && (ageMax < 0 || ageMax > 120))) {
    return { field: "ageMax", message: "Maximum age must be a whole number between 0 and 120." };
  }
  if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
    return { field: "ageMax", message: "Maximum age can't be lower than the minimum age." };
  }

  const code = form.escProjectCode.trim();
  if (code && !ESC_PROJECT_CODE_PATTERN.test(code)) {
    return { field: "escProjectCode", message: "ESC project code can only contain letters, digits and dashes." };
  }
  return null;
}

function getWarnings(form: FormState, project: ProjectWithStats | null): { field: FieldKey; message: string }[] {
  const warnings: { field: FieldKey; message: string }[] = [];
  if (form.applicationDeadline && form.startDate && form.applicationDeadline > form.startDate) {
    warnings.push({
      field: "applicationDeadline",
      message: "The application deadline is after the start date, so applications stay open once the project has started.",
    });
  }
  if (form.funding === "esc") {
    const ageMin = parseOptionalInteger(form.ageMin);
    const ageMax = parseOptionalInteger(form.ageMax);
    if ((typeof ageMin === "number" && ageMin < ESC_RULES.minAge) || (typeof ageMax === "number" && ageMax > ESC_RULES.maxAge)) {
      warnings.push({
        field: "ageMin",
        message: `ESC volunteering projects are for ages ${ESC_RULES.minAge}–${ESC_RULES.maxAge}.`,
      });
    }
  }
  const maxParticipants = parseOptionalInteger(form.maxParticipants);
  if (project && typeof maxParticipants === "number" && maxParticipants < project.participantCount) {
    warnings.push({
      field: "maxParticipants",
      message: `${pluralize(project.participantCount, "participant is", "participants are")} already linked to this project, more than the new maximum.`,
    });
  }
  return warnings;
}

export default function ProjectFormModal({
  project,
  partners,
  locations,
  onClose,
  onSaved,
  onNotFound,
  onPartnerCreated,
  onResync,
}: ProjectFormModalProps) {
  const [form, setForm] = useState<FormState>(() => (project ? toFormState(project) : EMPTY_FORM));
  const [formError, setFormError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);

  const [partnerQuery, setPartnerQuery] = useState("");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [addingPartner, setAddingPartner] = useState(false);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  const warnings = getWarnings(form, project);
  const warningFor = (field: FieldKey) => warnings.filter((warning) => warning.field === field);

  const visiblePartners = useMemo(() => {
    const query = partnerQuery.trim().toLowerCase();
    if (!query) return partners;
    return partners.filter((partner) =>
      [partner.name, partner.country].some((value) => value?.toLowerCase().includes(query))
    );
  }, [partners, partnerQuery]);

  // Linked partners missing from the list (it failed to load, or a partner was removed elsewhere) are kept
  // unless the user unticks them, so saving never silently drops a link.
  const knownPartnerIds = new Set(partners.map((partner) => partner._id));
  const unknownPartnerIds = form.partnerIds.filter((id) => !knownPartnerIds.has(id));

  const updateField = <K extends FieldKey>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError?.field === field) setFormError(null);
  };

  const handleFundingChange = (funding: FormState["funding"]) => {
    setForm((prev) => {
      const next = { ...prev, funding };
      // ESC projects default to the ESC age range when no range was entered yet.
      if (funding === "esc" && !prev.ageMin.trim() && !prev.ageMax.trim()) {
        next.ageMin = String(ESC_RULES.minAge);
        next.ageMax = String(ESC_RULES.maxAge);
      }
      return next;
    });
    if (formError?.field === "funding") setFormError(null);
  };

  const togglePartner = (partnerId: string) => {
    setForm((prev) => ({
      ...prev,
      partnerIds: prev.partnerIds.includes(partnerId)
        ? prev.partnerIds.filter((id) => id !== partnerId)
        : [...prev.partnerIds, partnerId],
    }));
  };

  const handleQuickAddPartner = async () => {
    const name = newPartnerName.trim();
    if (!name || addingPartner) {
      if (!name) setPartnerError("Enter the partner's name.");
      return;
    }
    setAddingPartner(true);
    setPartnerError(null);
    try {
      const result = await createPartnerAction({ name });
      if (!result.ok) {
        setPartnerError(result.error);
        return;
      }
      onPartnerCreated(result.data);
      setForm((prev) => ({ ...prev, partnerIds: [...prev.partnerIds, result.data._id] }));
      setNewPartnerName("");
      setPartnerQuery("");
    } catch (error) {
      console.error(error);
      setPartnerError(NETWORK_ERROR);
    } finally {
      setAddingPartner(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const validationError = validateForm(form);
    if (validationError) {
      setFormError(validationError);
      if (validationError.field) {
        document.getElementById(`project-${validationError.field}`)?.focus();
      }
      return;
    }

    const payload: ProjectInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      startDate: form.startDate,
      endDate: form.endDate,
      applicationDeadline: form.applicationDeadline || undefined,
      location: form.location.trim() || undefined,
      maxParticipants: parseOptionalInteger(form.maxParticipants) ?? undefined,
      ageMin: parseOptionalInteger(form.ageMin) ?? undefined,
      ageMax: parseOptionalInteger(form.ageMax) ?? undefined,
      eligibleCountries: form.eligibleCountries,
      funding: form.funding || undefined,
      escProjectCode: form.escProjectCode.trim() || undefined,
      partnerIds: form.partnerIds,
      isPublic: form.isPublic,
    };

    setSaving(true);
    setFormError(null);
    try {
      const result = project
        ? await updateProjectAction(project._id, payload)
        : await createProjectAction(payload);
      if (!result.ok) {
        if (result.notFound && project) {
          onNotFound(project._id, result.error);
          return;
        }
        setFormError({ field: null, message: result.error });
        onResync();
        return;
      }
      onSaved(result.data, !project);
    } catch (error) {
      console.error(error);
      setFormError({ field: null, message: NETWORK_ERROR });
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (field: FieldKey, extra = "py-2 text-white") =>
    `${INPUT_CLASS} ${extra} ${formError?.field === field ? "border-rose-500/60" : "border-slate-800"}`;

  const renderWarnings = (field: FieldKey) =>
    warningFor(field).map((warning) => (
      <p key={warning.message} className="flex items-start gap-1.5 text-xs text-amber-300">
        <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>{warning.message}</span>
      </p>
    ));

  const showEscCode = form.funding === "esc" || form.escProjectCode.trim() !== "";

  return (
    <Modal title={project ? "Edit Project" : "New Project"} onClose={onClose} busy={saving} size="xl">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0">
        <div className="p-6 space-y-6 overflow-y-auto">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl px-4 py-3 text-sm"
            >
              <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError.message}</span>
            </div>
          )}

          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-white mb-3">Basics</legend>
            <div className="space-y-1.5">
              <label htmlFor="project-name" className={LABEL_CLASS}>
                Project name *
              </label>
              <input
                id="project-name"
                type="text"
                required
                autoFocus
                maxLength={120}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="e.g. Malabis Share clothing bank"
                className={fieldClass("name")}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-description" className={LABEL_CLASS}>
                Description
              </label>
              <textarea
                id="project-description"
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="What will volunteers do, and who benefits?"
                className={fieldClass("description", "py-3 text-white resize-y")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="project-status" className={LABEL_CLASS}>
                  Status *
                </label>
                <select
                  id="project-status"
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value as ProjectStatus)}
                  className={fieldClass("status", "py-2.5 text-slate-200")}
                >
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PROJECT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="project-location" className={LABEL_CLASS}>
                  Location
                </label>
                <input
                  id="project-location"
                  type="text"
                  maxLength={120}
                  list="project-location-options"
                  value={form.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  placeholder="e.g. Martil"
                  className={fieldClass("location")}
                />
                <datalist id="project-location-options">
                  {locations.map((location) => (
                    <option key={location} value={location} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="project-funding" className={LABEL_CLASS}>
                  Funding
                </label>
                <select
                  id="project-funding"
                  value={form.funding}
                  onChange={(event) => handleFundingChange(event.target.value as FormState["funding"])}
                  className={fieldClass("funding", "py-2.5 text-slate-200")}
                >
                  <option value="">Not set</option>
                  {FUNDING_TYPES.map((funding) => (
                    <option key={funding} value={funding}>
                      {FUNDING_TYPE_LABELS[funding]}
                    </option>
                  ))}
                </select>
              </div>
              {showEscCode && (
                <div className="space-y-1.5">
                  <label htmlFor="project-escProjectCode" className={LABEL_CLASS}>
                    ESC project code
                  </label>
                  <input
                    id="project-escProjectCode"
                    type="text"
                    maxLength={60}
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={form.escProjectCode}
                    onChange={(event) => updateField("escProjectCode", event.target.value)}
                    placeholder="e.g. 2026-1-NL02-ESC51-000123"
                    className={fieldClass("escProjectCode", "py-2 text-white font-mono uppercase")}
                  />
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-slate-800/80 pt-5">
            <legend className="sr-only">Dates and capacity</legend>
            <p className="text-sm font-bold text-white" aria-hidden="true">
              Dates & capacity
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="project-startDate" className={LABEL_CLASS}>
                  Start date *
                </label>
                <input
                  id="project-startDate"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(event) => updateField("startDate", event.target.value)}
                  className={fieldClass("startDate")}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="project-endDate" className={LABEL_CLASS}>
                  End date *
                </label>
                <input
                  id="project-endDate"
                  type="date"
                  required
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(event) => updateField("endDate", event.target.value)}
                  className={fieldClass("endDate")}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="project-applicationDeadline" className={LABEL_CLASS}>
                  Application deadline
                </label>
                <input
                  id="project-applicationDeadline"
                  type="date"
                  value={form.applicationDeadline}
                  onChange={(event) => updateField("applicationDeadline", event.target.value)}
                  className={fieldClass("applicationDeadline")}
                />
              </div>
            </div>
            {renderWarnings("applicationDeadline")}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="project-maxParticipants" className={LABEL_CLASS}>
                  Max participants
                </label>
                <input
                  id="project-maxParticipants"
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  inputMode="numeric"
                  value={form.maxParticipants}
                  onChange={(event) => updateField("maxParticipants", event.target.value)}
                  placeholder="No limit"
                  className={fieldClass("maxParticipants")}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="project-ageMin" className={LABEL_CLASS}>
                  Minimum age
                </label>
                <input
                  id="project-ageMin"
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  inputMode="numeric"
                  value={form.ageMin}
                  onChange={(event) => updateField("ageMin", event.target.value)}
                  placeholder={form.funding === "esc" ? String(ESC_RULES.minAge) : "Any"}
                  className={fieldClass("ageMin")}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="project-ageMax" className={LABEL_CLASS}>
                  Maximum age
                </label>
                <input
                  id="project-ageMax"
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  inputMode="numeric"
                  value={form.ageMax}
                  onChange={(event) => updateField("ageMax", event.target.value)}
                  placeholder={form.funding === "esc" ? String(ESC_RULES.maxAge) : "Any"}
                  className={fieldClass("ageMax")}
                />
              </div>
            </div>
            {renderWarnings("maxParticipants")}
            {renderWarnings("ageMin")}
          </fieldset>

          <fieldset className="space-y-4 border-t border-slate-800/80 pt-5">
            <legend className="sr-only">Eligibility and partners</legend>
            <p className="text-sm font-bold text-white" aria-hidden="true">
              Eligibility & partners
            </p>
            <div className="space-y-1.5">
              <label htmlFor="project-eligibleCountries" className={LABEL_CLASS}>
                Eligible countries
              </label>
              <TagInput
                id="project-eligibleCountries"
                values={form.eligibleCountries}
                onChange={(values) => updateField("eligibleCountries", values)}
                suggestions={COUNTRY_SUGGESTIONS}
                placeholder="Type a country and press Enter"
                itemLabel="country"
                invalid={formError?.field === "eligibleCountries"}
              />
              <p className="text-xs text-slate-500">Leave empty when volunteers from any country can apply.</p>
            </div>

            <div className="space-y-2">
              <span id="project-partners-label" className={LABEL_CLASS}>
                Partners
              </span>
              {partners.length > 6 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  <input
                    type="search"
                    value={partnerQuery}
                    onChange={(event) => setPartnerQuery(event.target.value)}
                    placeholder="Filter partners..."
                    aria-label="Filter partners"
                    className={`${INPUT_CLASS} border-slate-800 py-2 pl-9 text-white`}
                  />
                </div>
              )}
              {partners.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl px-4 py-3">
                  No partners yet. Add one below, e.g. a sending organisation like Stichting Cultined.
                </p>
              ) : (
                <div
                  role="group"
                  aria-labelledby="project-partners-label"
                  className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-900"
                >
                  {visiblePartners.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-500">No partners match “{partnerQuery}”.</p>
                  ) : (
                    visiblePartners.map((partner) => {
                      const checked = form.partnerIds.includes(partner._id);
                      return (
                        <label
                          key={partner._id}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-900/60 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePartner(partner._id)}
                            className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-emerald-500"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-white truncate">{partner.name}</span>
                            {(partner.type || partner.country) && (
                              <span className="block text-xs text-slate-500 truncate">
                                {[partner.type ? PARTNER_TYPE_LABELS[partner.type] : null, partner.country]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
              {unknownPartnerIds.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl divide-y divide-amber-500/10">
                  {unknownPartnerIds.map((partnerId) => (
                    <div key={partnerId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-xs text-amber-200/90">
                        A linked partner isn&apos;t in the list (it may have been removed or failed to load).
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePartner(partnerId)}
                        className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border border-amber-500/30 text-amber-200 hover:bg-amber-500/10 transition-colors"
                      >
                        Unlink
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {form.partnerIds.length > 0 && (
                <p className="text-xs text-slate-500">{pluralize(form.partnerIds.length, "partner")} selected</p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <label htmlFor="project-new-partner" className="sr-only">
                  New partner name
                </label>
                <input
                  id="project-new-partner"
                  type="text"
                  maxLength={120}
                  value={newPartnerName}
                  onChange={(event) => {
                    setNewPartnerName(event.target.value);
                    setPartnerError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleQuickAddPartner();
                    }
                  }}
                  placeholder="Quick add a partner by name"
                  className={`${INPUT_CLASS} py-2 text-white ${partnerError ? "border-rose-500/60" : "border-slate-800"}`}
                />
                <button
                  type="button"
                  onClick={() => void handleQuickAddPartner()}
                  disabled={addingPartner}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors shrink-0"
                >
                  {addingPartner ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {addingPartner ? "Adding..." : "Add partner"}
                </button>
              </div>
              {partnerError && (
                <p role="alert" className="text-xs text-rose-300">
                  {partnerError}
                </p>
              )}
            </div>
          </fieldset>

          <div className="border-t border-slate-800/80 pt-5 flex items-start justify-between gap-4">
            <div>
              <label htmlFor="project-isPublic" className="text-sm font-bold text-white block">
                Public project
              </label>
              <p id="project-isPublic-hint" className="text-xs text-slate-500 mt-0.5 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Shown on the public Join page, so applicants can choose it.
              </p>
            </div>
            <Switch
              id="project-isPublic"
              checked={form.isPublic}
              onChange={(checked) => updateField("isPublic", checked)}
              label="Show on the public Join page"
              describedBy="project-isPublic-hint"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800/80 bg-slate-950/30 shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : project ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
