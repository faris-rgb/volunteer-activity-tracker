"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type HTMLInputTypeAttribute,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  BadgeCheck,
  Bell,
  Building2,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  Tags,
  TriangleAlert,
  Undo,
  User,
  UserCog,
  X,
} from "lucide-react";
import {
  getEditablePortalSettingsAction,
  updatePortalSettingsAction,
  type EditablePortalSettings,
  type PortalSettingsInput,
} from "@/app/actions/settings";
import {
  DEFAULT_ACTIVITY_CATEGORIES,
  DEFAULT_LANGUAGES,
  DEFAULT_LOCATIONS,
  DEFAULT_SKILLS,
  whatsappLink,
  type WhatsAppTemplate,
} from "@/lib/domain";
import {
  ESC_LABEL_WARNING_DAYS,
  PORTAL_COUNTRIES,
  SETTINGS_LIMITS,
  contactEmailError,
  contactPhoneError,
  daysBetween,
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
import TagListEditor from "./TagListEditor";
import WhatsAppTemplatesEditor, {
  defaultTemplateDrafts,
  templateFieldErrorKey,
  type TemplateDraft,
} from "./WhatsAppTemplatesEditor";

export interface SettingsProfile {
  name: string;
  email: string;
  roleLabel: string;
}

interface SettingsClientProps {
  initialSettings: EditablePortalSettings | null;
  profile: SettingsProfile;
  /** Today's date (YYYY-MM-DD) in Morocco, computed on the server so the ESC warning renders identically. */
  today: string;
}

type TagListField = "locations" | "languages" | "skills" | "activityCategories";

interface SettingsForm {
  organizationName: string;
  attendanceTarget: string;
  defaultCountry: string;
  contactEmail: string;
  contactPhone: string;
  instagramUrl: string;
  facebookUrl: string;
  escPic: string;
  escOid: string;
  escLabelExpiry: string;
  locations: string[];
  languages: string[];
  skills: string[];
  activityCategories: string[];
  whatsappTemplates: TemplateDraft[];
  weeklyDigest: boolean;
  registrationAlerts: boolean;
}

/** Errors keyed by form field, tag list field, "whatsappTemplates" or templateFieldErrorKey(). */
type FieldErrors = Record<string, string | undefined>;
type TagDrafts = Record<TagListField, string>;

type Notice = {
  type: "success" | "error";
  text: string;
  source?: "validation" | "conflict";
} | null;

type LabelStatus =
  | { tone: "expired" | "warning" | "ok"; days: number; date: string }
  | null;

const FORM_ID = "portal-settings-form";
const EMPTY_TAG_DRAFTS: TagDrafts = { locations: "", languages: "", skills: "", activityCategories: "" };

const inputClassName =
  "w-full bg-slate-900/60 border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-60";

const TAG_LISTS: {
  field: TagListField;
  title: string;
  description: string;
  placeholder: string;
  defaults: readonly string[];
}[] = [
  {
    field: "locations",
    title: "Locations",
    description: "Places where activities and projects take place.",
    placeholder: "e.g. Cabo Negro",
    defaults: DEFAULT_LOCATIONS,
  },
  {
    field: "languages",
    title: "Languages",
    description: "Languages volunteers can choose on their profile.",
    placeholder: "e.g. Italian",
    defaults: DEFAULT_LANGUAGES,
  },
  {
    field: "skills",
    title: "Skills",
    description: "Skills volunteers can choose on their profile.",
    placeholder: "e.g. Graphic design",
    defaults: DEFAULT_SKILLS,
  },
  {
    field: "activityCategories",
    title: "Activity categories",
    description: "Categories offered when creating activities.",
    placeholder: "e.g. Arts & crafts",
    defaults: DEFAULT_ACTIVITY_CATEGORIES,
  },
];

const sectionLinks = [
  {
    href: "#profile",
    formSection: false,
    icon: User,
    title: "Personal Profile",
    description: "Your name, email address and portal role.",
  },
  {
    href: "#organization",
    formSection: true,
    icon: Building2,
    title: "Organisation & contact",
    description: "Name, attendance goal, country and public contact details.",
  },
  {
    href: "#esc",
    formSection: true,
    icon: BadgeCheck,
    title: "ESC accreditation",
    description: "PIC, OID and Quality Label expiry.",
  },
  {
    href: "#presets",
    formSection: true,
    icon: Tags,
    title: "Presets",
    description: "Locations, languages, skills and activity categories.",
  },
  {
    href: "#whatsapp",
    formSection: true,
    icon: MessageSquareText,
    title: "WhatsApp templates",
    description: "Ready-made messages for volunteers.",
  },
  {
    href: "#notifications",
    formSection: true,
    icon: Bell,
    title: "Notifications",
    description: "Weekly digest and new registration alerts.",
  },
];

function toTemplateDrafts(templates: WhatsAppTemplate[]): TemplateDraft[] {
  return templates.map((template) => ({
    id: `saved:${template.key}`,
    key: template.key,
    label: template.label,
    text: template.text,
  }));
}

function toForm(settings: EditablePortalSettings): SettingsForm {
  return {
    organizationName: settings.organizationName,
    attendanceTarget: String(settings.attendanceTarget),
    defaultCountry: settings.defaultCountry,
    contactEmail: settings.contactEmail ?? "",
    contactPhone: settings.contactPhone ?? "",
    instagramUrl: settings.instagramUrl ?? "",
    facebookUrl: settings.facebookUrl ?? "",
    escPic: settings.escPic ?? "",
    escOid: settings.escOid ?? "",
    escLabelExpiry: settings.escLabelExpiry ?? "",
    locations: [...settings.locations],
    languages: [...settings.languages],
    skills: [...settings.skills],
    activityCategories: [...settings.activityCategories],
    whatsappTemplates: toTemplateDrafts(settings.whatsappTemplates),
    weeklyDigest: settings.weeklyDigest,
    registrationAlerts: settings.registrationAlerts,
  };
}

/** Serialised form without the local template ids, for change detection. */
function formSnapshot(form: SettingsForm): string {
  return JSON.stringify({
    ...form,
    whatsappTemplates: form.whatsappTemplates.map(({ key, label, text }) => ({ key, label, text })),
  });
}

function hasPendingDrafts(drafts: TagDrafts): boolean {
  return Object.values(drafts).some((draft) => draft.trim() !== "");
}

/** Runs `check` on a trimmed, normalised optional value; empty values are valid. */
function optionalError(
  value: string,
  check: (value: string) => string | null,
  normalize: (value: string) => string = (input) => input
): string | undefined {
  const normalized = normalize(value.trim());
  return normalized ? (check(normalized) ?? undefined) : undefined;
}

function validateForm(form: SettingsForm, drafts: TagDrafts): FieldErrors {
  const errors: FieldErrors = {};
  const organizationName = form.organizationName.trim();
  if (!organizationName) {
    errors.organizationName = "Organization name is required.";
  } else if (organizationName.length > SETTINGS_LIMITS.organizationName) {
    errors.organizationName = `Use ${SETTINGS_LIMITS.organizationName} characters or fewer.`;
  }
  const target = form.attendanceTarget.trim();
  if (!/^\d+$/.test(target) || Number(target) > 100) {
    errors.attendanceTarget = "Enter a whole number from 0 to 100.";
  }
  if (!(PORTAL_COUNTRIES as readonly string[]).includes(form.defaultCountry)) {
    errors.defaultCountry = "Choose a country from the list.";
  }

  errors.contactEmail = optionalError(form.contactEmail, contactEmailError);
  errors.contactPhone = optionalError(form.contactPhone, contactPhoneError);
  errors.instagramUrl = optionalError(
    form.instagramUrl,
    (value) => socialUrlError(value, "instagram"),
    normalizeSocialUrl
  );
  errors.facebookUrl = optionalError(form.facebookUrl, (value) => socialUrlError(value, "facebook"), normalizeSocialUrl);
  errors.escPic = optionalError(form.escPic, escPicError, normalizeEscPic);
  errors.escOid = optionalError(form.escOid, escOidError, normalizeEscOid);
  errors.escLabelExpiry = optionalError(form.escLabelExpiry, (value) =>
    isIsoDate(value) ? null : "Enter a valid date."
  );

  for (const { field } of TAG_LISTS) {
    const draft = drafts[field].trim();
    if (draft) {
      errors[field] = `Press Enter or Add to add "${draft.slice(0, 30)}", or clear the field.`;
    } else if (form[field].length === 0) {
      errors[field] = "Add at least one entry.";
    }
  }

  if (form.whatsappTemplates.length === 0) {
    errors.whatsappTemplates = "Add at least one template.";
  }
  const labels = new Set<string>();
  for (const template of form.whatsappTemplates) {
    const label = template.label.trim();
    const labelKey = templateFieldErrorKey(template.id, "label");
    const textKey = templateFieldErrorKey(template.id, "text");
    if (!label) {
      errors[labelKey] = "Give this template a name.";
    } else if (labels.has(label.toLocaleLowerCase())) {
      errors[labelKey] = "Another template already uses this name.";
    }
    labels.add(label.toLocaleLowerCase());

    const text = template.text.trim();
    const unknown = unknownPlaceholders(text);
    if (!text) {
      errors[textKey] = "Write the message.";
    } else if (unknown.length) {
      errors[textKey] = `Unknown placeholder ${unknown.map((key) => `{${key}}`).join(", ")}.`;
    }
  }

  for (const key of Object.keys(errors)) {
    if (!errors[key]) {
      delete errors[key];
    }
  }
  return errors;
}

function toInput(form: SettingsForm): PortalSettingsInput {
  const taken = new Set(form.whatsappTemplates.flatMap((template) => (template.key ? [template.key] : [])));
  const whatsappTemplates = form.whatsappTemplates.map((template) => {
    let key = template.key;
    if (!key) {
      key = templateKeyFromLabel(template.label, taken);
      taken.add(key);
    }
    return { key, label: template.label.trim(), text: template.text.trim() };
  });
  const optional = (value: string, normalize: (value: string) => string = (input) => input) =>
    normalize(value.trim()) || undefined;

  return {
    organizationName: form.organizationName.trim(),
    attendanceTarget: Number(form.attendanceTarget.trim()),
    defaultCountry: form.defaultCountry,
    contactEmail: optional(form.contactEmail),
    contactPhone: optional(form.contactPhone),
    instagramUrl: optional(form.instagramUrl, normalizeSocialUrl),
    facebookUrl: optional(form.facebookUrl, normalizeSocialUrl),
    escPic: optional(form.escPic, normalizeEscPic),
    escOid: optional(form.escOid, normalizeEscOid),
    escLabelExpiry: optional(form.escLabelExpiry),
    locations: form.locations,
    languages: form.languages,
    skills: form.skills,
    activityCategories: form.activityCategories,
    whatsappTemplates,
    weeklyDigest: form.weeklyDigest,
    registrationAlerts: form.registrationAlerts,
  };
}

function getLabelStatus(expiry: string | undefined, today: string): LabelStatus {
  if (!expiry) {
    return null;
  }
  const days = daysBetween(today, expiry);
  if (days === null) {
    return null;
  }
  return {
    tone: days < 0 ? "expired" : days <= ESC_LABEL_WARNING_DAYS ? "warning" : "ok",
    days,
    date: formatDate(expiry),
  };
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function labelStatusText(status: NonNullable<LabelStatus>): string {
  if (status.tone === "expired") {
    return `The ESC Quality Label expired on ${status.date} (${plural(-status.days, "day")} ago).`;
  }
  if (status.days === 0) {
    return `The ESC Quality Label expires today (${status.date}).`;
  }
  return `The ESC Quality Label expires in ${plural(status.days, "day")}, on ${status.date}.`;
}

/** URL to open for a social link field, or null while the value is empty or invalid. */
function socialHref(value: string, network: "instagram" | "facebook"): string | null {
  const url = normalizeSocialUrl(value);
  return url && socialUrlError(url, network) === null ? url : null;
}

const subscribeToNothing = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}

function formatTimestamp(value: string, timeZone?: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
}

export default function SettingsClient({ initialSettings, profile, today }: SettingsClientProps) {
  return initialSettings ? (
    <SettingsEditor initialSettings={initialSettings} profile={profile} today={today} />
  ) : (
    <SettingsLoadError profile={profile} />
  );
}

function SettingsEditor({
  initialSettings,
  profile,
  today,
}: {
  initialSettings: EditablePortalSettings;
  profile: SettingsProfile;
  today: string;
}) {
  const [isSaving, startSave] = useTransition();
  const [isLoadingLatest, startLoadLatest] = useTransition();
  const [saved, setSaved] = useState(initialSettings);
  const [form, setForm] = useState(() => toForm(initialSettings));
  const [tagDrafts, setTagDrafts] = useState<TagDrafts>(EMPTY_TAG_DRAFTS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [focusTemplateId, setFocusTemplateId] = useState<string | null>(null);
  // Bumped whenever the form is replaced (reset, save, load latest) so the tag editors drop local errors.
  const [editorVersion, setEditorVersion] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const draftCounter = useRef(0);

  const isBusy = isSaving || isLoadingLatest;
  const isDirty = formSnapshot(form) !== formSnapshot(toForm(saved)) || hasPendingDrafts(tagDrafts);
  const savedLabelStatus = getLabelStatus(saved.escLabelExpiry, today);
  const formLabelStatus = isIsoDate(form.escLabelExpiry) ? getLabelStatus(form.escLabelExpiry, today) : null;
  const escAlert = savedLabelStatus && savedLabelStatus.tone !== "ok" ? savedLabelStatus : null;

  useEffect(() => {
    if (notice?.type !== "success") {
      return;
    }
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  /** Applies form changes and clears the errors of the edited fields. */
  const applyChanges = (changes: Partial<SettingsForm>, staleErrorKeys: string[]) => {
    setForm((current) => ({ ...current, ...changes }));
    let remainingErrors = fieldErrors;
    if (staleErrorKeys.some((key) => key in fieldErrors)) {
      remainingErrors = { ...fieldErrors };
      for (const key of staleErrorKeys) {
        delete remainingErrors[key];
      }
      setFieldErrors(remainingErrors);
    }
    const hasRemainingErrors = Object.keys(remainingErrors).length > 0;
    // Keep a conflict notice (it offers "Load latest settings") and validation notices while errors remain.
    setNotice((current) =>
      current?.source === "conflict" || (current?.source === "validation" && hasRemainingErrors) ? current : null
    );
  };

  const updateField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    applyChanges({ [key]: value } as Partial<SettingsForm>, [key]);
  };

  const updateTagDraft = (field: TagListField, draft: string) => {
    setTagDrafts((current) => ({ ...current, [field]: draft }));
    if (fieldErrors[field] && !draft.trim()) {
      applyChanges({}, [field]);
    }
  };

  const handleTemplatesChange = (next: TemplateDraft[]) => {
    const previous = new Map(form.whatsappTemplates.map((template) => [template.id, template]));
    const nextIds = new Set(next.map((template) => template.id));
    const stale = ["whatsappTemplates"];
    for (const template of next) {
      const old = previous.get(template.id);
      if (!old || old.label !== template.label) {
        stale.push(templateFieldErrorKey(template.id, "label"));
      }
      if (!old || old.text !== template.text) {
        stale.push(templateFieldErrorKey(template.id, "text"));
      }
    }
    for (const template of form.whatsappTemplates) {
      if (!nextIds.has(template.id)) {
        stale.push(templateFieldErrorKey(template.id, "label"), templateFieldErrorKey(template.id, "text"));
      }
    }
    applyChanges({ whatsappTemplates: next }, stale);
  };

  const handleAddTemplate = () => {
    if (form.whatsappTemplates.length >= SETTINGS_LIMITS.templates) {
      return;
    }
    draftCounter.current += 1;
    const id = `draft:${draftCounter.current}`;
    setFocusTemplateId(id);
    handleTemplatesChange([...form.whatsappTemplates, { id, key: null, label: "", text: "" }]);
  };

  const handleRestoreTemplates = () => {
    setFocusTemplateId(null);
    handleTemplatesChange(defaultTemplateDrafts());
  };

  const resetEditorState = (settings: EditablePortalSettings) => {
    setForm(toForm(settings));
    setTagDrafts(EMPTY_TAG_DRAFTS);
    setFieldErrors({});
    setFocusTemplateId(null);
    setEditorVersion((version) => version + 1);
  };

  const handleReset = () => {
    resetEditorState(saved);
    setNotice(null);
  };

  const handleLoadLatest = () => {
    startLoadLatest(async () => {
      try {
        const latest = await getEditablePortalSettingsAction();
        setSaved(latest);
        resetEditorState(latest);
        setNotice({
          type: "success",
          text: "Loaded the latest saved settings. Make your changes again, then save.",
        });
      } catch {
        setNotice({
          type: "error",
          text: "Could not load the latest settings. Please try again.",
          source: "conflict",
        });
      }
    });
  };

  const focusFirstInvalidField = () => {
    requestAnimationFrame(() => {
      const element = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      if (element) {
        element.focus({ preventScroll: true });
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || isBusy) {
      return;
    }

    const errors = validateForm(form, tagDrafts);
    setFieldErrors(errors);
    const errorCount = Object.keys(errors).length;
    if (errorCount > 0) {
      setNotice({
        type: "error",
        text:
          errorCount === 1
            ? "Please fix the highlighted field before saving."
            : `Please fix the ${errorCount} highlighted fields before saving.`,
        source: "validation",
      });
      focusFirstInvalidField();
      return;
    }

    setNotice(null);
    startSave(async () => {
      try {
        const result = await updatePortalSettingsAction(toInput(form), saved.revision);
        if (!result.ok) {
          setNotice({
            type: "error",
            text: result.error,
            source: "conflict" in result ? "conflict" : undefined,
          });
          return;
        }
        setSaved(result.data);
        resetEditorState(result.data);
        setNotice({ type: "success", text: "Settings saved." });
      } catch {
        setNotice({ type: "error", text: "Could not reach the server. Check your connection and try again." });
      }
    });
  };

  const saveButtons = (
    <>
      <button
        type="button"
        onClick={handleReset}
        disabled={!isDirty || isBusy}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
      >
        <Undo className="h-4 w-4" />
        Reset
      </button>
      <button
        type="submit"
        form={FORM_ID}
        disabled={!isDirty || isBusy}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
      >
        {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isSaving ? "Saving..." : "Save Changes"}
      </button>
    </>
  );

  const whatsappHref = whatsappLink(
    contactPhoneError(form.contactPhone.trim()) === null ? form.contactPhone.trim() : undefined
  );
  const instagramHref = socialHref(form.instagramUrl, "instagram");
  const facebookHref = socialHref(form.facebookUrl, "facebook");

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      <SettingsHeader
        status={
          isDirty ? (
            <span className="text-amber-300">You have unsaved changes.</span>
          ) : saved.updatedAt ? (
            <LastSaved
              updatedAt={saved.updatedAt}
              updatedBy={saved.updatedBy}
              updatedOutsidePortal={saved.updatedOutsidePortal}
            />
          ) : (
            "Using default settings. Nothing has been saved yet."
          )
        }
        actions={saveButtons}
      />

      {escAlert && (
        <div
          role="status"
          className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            escAlert.tone === "expired"
              ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
              : "border-amber-500/20 bg-amber-500/10 text-amber-200"
          }`}
        >
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span className="flex-1">
            {labelStatusText(escAlert)} Renew it with your National Agency to keep hosting ESC volunteers.
          </span>
          <a
            href="#esc"
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline"
          >
            Review accreditation
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <SectionNav
          includeFormSections
          escAlert={escAlert ? (escAlert.tone === "expired" ? "expired" : "warning") : null}
        />

        <div className="md:col-span-2 space-y-6 min-w-0">
          <ProfileSection profile={profile} />

          <form id={FORM_ID} ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">
            <fieldset disabled={isBusy} className="min-w-0 space-y-6">
              <SettingsSection id="organization" icon={Building2} title="Organisation & contact">
                <div className="space-y-4">
                  <TextField
                    id="organizationName"
                    label="Organization Name"
                    value={form.organizationName}
                    onChange={(value) => updateField("organizationName", value)}
                    error={fieldErrors.organizationName}
                    hint="Used for {org} in WhatsApp templates."
                    maxLength={SETTINGS_LIMITS.organizationName}
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TextField
                      id="attendanceTarget"
                      label="Attendance Rate Target (%)"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={form.attendanceTarget}
                      onChange={(value) => updateField("attendanceTarget", value)}
                      error={fieldErrors.attendanceTarget}
                      hint="Your goal for the attendance rate across activities (0-100%)."
                      required
                    />

                    <div className="space-y-2">
                      <label
                        htmlFor="defaultCountry"
                        className="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
                      >
                        Portal Default Country
                      </label>
                      <select
                        id="defaultCountry"
                        value={form.defaultCountry}
                        onChange={(event) => updateField("defaultCountry", event.target.value)}
                        aria-invalid={!!fieldErrors.defaultCountry}
                        aria-describedby={
                          fieldErrors.defaultCountry ? "defaultCountry-error" : "defaultCountry-hint"
                        }
                        className={`${inputClassName} text-slate-300 ${
                          fieldErrors.defaultCountry ? "border-rose-500/60" : "border-slate-800"
                        }`}
                      >
                        {PORTAL_COUNTRIES.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.defaultCountry ? (
                        <FieldError id="defaultCountry-error" message={fieldErrors.defaultCountry} />
                      ) : (
                        <p id="defaultCountry-hint" className="text-xs text-slate-500">
                          Prefilled as the country when adding a new volunteer.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-900/60 pt-5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Contact details</h3>
                    <p className="text-xs text-slate-500">
                      How volunteers and partners reach the organisation. Visible to everyone signed in to the
                      portal.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TextField
                      id="contactEmail"
                      label="Contact Email"
                      type="email"
                      autoComplete="email"
                      placeholder="info@example.org"
                      value={form.contactEmail}
                      onChange={(value) => updateField("contactEmail", value)}
                      error={fieldErrors.contactEmail}
                      maxLength={SETTINGS_LIMITS.email}
                    />
                    <TextField
                      id="contactPhone"
                      label="Phone / WhatsApp"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+212 6 12 34 56 78"
                      value={form.contactPhone}
                      onChange={(value) => updateField("contactPhone", value)}
                      error={fieldErrors.contactPhone}
                      hint="Include the country code."
                      maxLength={SETTINGS_LIMITS.phone}
                      action={
                        whatsappHref ? <ExternalAction href={whatsappHref} label="Test in WhatsApp" /> : undefined
                      }
                    />
                  </div>

                  <TextField
                    id="instagramUrl"
                    label="Instagram"
                    type="url"
                    inputMode="url"
                    placeholder="https://instagram.com/yourpage"
                    value={form.instagramUrl}
                    onChange={(value) => updateField("instagramUrl", value)}
                    error={fieldErrors.instagramUrl}
                    hint="Your main channel for recruiting volunteers."
                    maxLength={SETTINGS_LIMITS.url}
                    action={instagramHref ? <ExternalAction href={instagramHref} label="Open Instagram" /> : undefined}
                  />
                  <TextField
                    id="facebookUrl"
                    label="Facebook"
                    type="url"
                    inputMode="url"
                    placeholder="https://facebook.com/yourpage"
                    value={form.facebookUrl}
                    onChange={(value) => updateField("facebookUrl", value)}
                    error={fieldErrors.facebookUrl}
                    maxLength={SETTINGS_LIMITS.url}
                    action={facebookHref ? <ExternalAction href={facebookHref} label="Open Facebook" /> : undefined}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                id="esc"
                icon={BadgeCheck}
                title="ESC accreditation"
                description="European Solidarity Corps identifiers and Quality Label. Visible to everyone signed in to the portal."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="escPic"
                    label="PIC"
                    inputMode="numeric"
                    placeholder="9 digits"
                    value={form.escPic}
                    onChange={(value) => updateField("escPic", value)}
                    error={fieldErrors.escPic}
                    hint="Participant Identification Code."
                    maxLength={15}
                  />
                  <TextField
                    id="escOid"
                    label="OID"
                    placeholder="E10123456"
                    autoCapitalize="characters"
                    value={form.escOid}
                    onChange={(value) => updateField("escOid", value)}
                    error={fieldErrors.escOid}
                    hint="Organisation ID (E + 8 digits)."
                    maxLength={15}
                  />
                </div>

                <TextField
                  id="escLabelExpiry"
                  label="Quality Label expiry date"
                  type="date"
                  value={form.escLabelExpiry}
                  onChange={(value) => updateField("escLabelExpiry", value)}
                  error={fieldErrors.escLabelExpiry}
                  hint={`The portal warns ${ESC_LABEL_WARNING_DAYS} days before this date.`}
                  className="sm:max-w-xs"
                />

                <LabelStatusPanel status={formLabelStatus} />
              </SettingsSection>

              <SettingsSection
                id="presets"
                icon={Tags}
                title="Presets"
                description="Suggestions offered in forms across the portal. Removing an entry does not change existing records."
              >
                <div className="space-y-4">
                  {TAG_LISTS.map(({ field, title, description, placeholder, defaults }) => (
                    <TagListEditor
                      key={`${field}:${editorVersion}`}
                      id={`preset-${field}`}
                      title={title}
                      description={description}
                      placeholder={placeholder}
                      tags={form[field]}
                      defaults={defaults}
                      draft={tagDrafts[field]}
                      error={fieldErrors[field]}
                      onChange={(tags) => updateField(field, tags)}
                      onDraftChange={(draft) => updateTagDraft(field, draft)}
                    />
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection
                id="whatsapp"
                icon={MessageSquareText}
                title="WhatsApp templates"
                description="Ready-made messages for contacting volunteers on WhatsApp."
              >
                <WhatsAppTemplatesEditor
                  templates={form.whatsappTemplates}
                  organizationName={form.organizationName}
                  errors={fieldErrors}
                  focusTemplateId={focusTemplateId}
                  onChange={handleTemplatesChange}
                  onAdd={handleAddTemplate}
                  onRestoreDefaults={handleRestoreTemplates}
                />
              </SettingsSection>

              <SettingsSection id="notifications" icon={Bell} title="Notifications">
                <div className="space-y-3">
                  <NotificationToggle
                    id="weeklyDigest"
                    title="Email Weekly Digest"
                    description="Weekly summary of activities and attendance."
                    checked={form.weeklyDigest}
                    onChange={(checked) => updateField("weeklyDigest", checked)}
                  />
                  <NotificationToggle
                    id="registrationAlerts"
                    title="New Registration Alerts"
                    description="An email whenever a new volunteer signs up."
                    checked={form.registrationAlerts}
                    onChange={(checked) => updateField("registrationAlerts", checked)}
                  />
                </div>

                <p className="text-xs text-slate-500">
                  These preferences are saved now, but no emails are sent until email delivery is configured.
                </p>
              </SettingsSection>
            </fieldset>
          </form>

          {isDirty && (
            <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur">
              <p className="text-sm text-amber-300">You have unsaved changes.</p>
              <div className="flex items-center gap-3 [&>button]:flex-1 sm:[&>button]:flex-none">{saveButtons}</div>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={`fixed right-4 left-4 sm:left-auto sm:right-6 z-[60] sm:max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
            isDirty ? "bottom-40 sm:bottom-24" : "bottom-6"
          } ${
            notice.type === "success"
              ? "border-emerald-500/30 bg-slate-900/95 text-emerald-300"
              : "border-rose-500/30 bg-slate-900/95 text-rose-300"
          }`}
        >
          {notice.type === "success" ? (
            <CircleCheck className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <p>{notice.text}</p>
            {notice.source === "conflict" && (
              <button
                type="button"
                onClick={handleLoadLatest}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isLoadingLatest ? "animate-spin" : ""}`} />
                {isLoadingLatest ? "Loading..." : "Load latest settings"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsLoadError({ profile }: { profile: SettingsProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    startTransition(() => {
      setRetryCount((count) => count + 1);
      router.refresh();
    });
  };

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      <SettingsHeader />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <SectionNav />

        <div className="md:col-span-2 space-y-6 min-w-0">
          <ProfileSection profile={profile} />

          <div
            role="alert"
            className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 space-y-4 text-center"
          >
            <CircleAlert className="mx-auto h-10 w-10 text-rose-300" />
            <div>
              <h2 className="text-lg font-bold text-white">Could not load portal settings</h2>
              <p className="text-sm text-rose-200/80 mt-1">
                The settings could not be read from the database, so editing is disabled to avoid overwriting
                them.
              </p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={handleRetry}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-all duration-200"
            >
              <RotateCcw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Retrying..." : "Try again"}
            </button>
            {retryCount > 0 && !isPending && (
              <p className="text-xs text-rose-200/70">
                Still unavailable. Check the Sanity connection or try again in a moment.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsHeader({ status, actions }: { status?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Settings className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" />
          Portal Settings
        </h1>
        <p className="text-slate-400 mt-1">
          Manage your organisation details, ESC accreditation, presets and WhatsApp templates.
        </p>
        {status && <p className="text-xs text-slate-500 mt-2">{status}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

function SectionNav({
  includeFormSections = false,
  escAlert = null,
}: {
  includeFormSections?: boolean;
  escAlert?: "expired" | "warning" | null;
}) {
  const links = includeFormSections ? sectionLinks : sectionLinks.filter((link) => !link.formSection);
  const cardClassName =
    "group block bg-slate-950/40 border border-slate-900 rounded-xl p-3 md:p-4 space-y-1 hover:border-emerald-500/30 hover:bg-slate-900/60 transition-all duration-200";

  return (
    <nav
      aria-label="Settings sections"
      className="grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-3 md:sticky md:top-6 md:self-start"
    >
      {links.map(({ href, icon: Icon, title, description }) => {
        const alert = href === "#esc" ? escAlert : null;
        return (
          <a key={href} href={href} className={cardClassName}>
            <span className="text-sm font-bold text-slate-200 group-hover:text-white flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="min-w-0 leading-snug">{title}</span>
              {alert && (
                <span
                  className={`ml-auto h-2 w-2 shrink-0 rounded-full ${alert === "expired" ? "bg-rose-400" : "bg-amber-400"}`}
                  aria-hidden="true"
                />
              )}
              {alert && (
                <span className="sr-only">
                  {alert === "expired" ? "(Quality Label expired)" : "(Quality Label expires soon)"}
                </span>
              )}
            </span>
            <span className="text-xs text-slate-500 hidden md:block">{description}</span>
          </a>
        );
      })}

      <Link href="/admin/assign-roles" className={`${cardClassName} col-span-2 md:col-span-1`}>
        <span className="text-sm font-bold text-slate-200 group-hover:text-white flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          Access Controls
          <ChevronRight className="h-4 w-4 ml-auto text-slate-500 group-hover:text-emerald-400 transition-colors" />
        </span>
        <span className="text-xs text-slate-500 hidden md:block">
          Assign roles to new sign-ins on the Assign Roles page.
        </span>
      </Link>
    </nav>
  );
}

function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: typeof Bell;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 focus:outline-none bg-slate-950/40 border border-slate-900 rounded-2xl p-4 sm:p-6 space-y-5"
    >
      <div className="border-b border-slate-900/60 pb-3">
        <h2 id={`${id}-heading`} className="text-lg font-bold text-white flex items-center gap-2">
          <Icon className="h-5 w-5 text-emerald-400" />
          {title}
        </h2>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  action,
  className = "",
  type = "text",
  ...inputProps
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  required?: boolean;
  autoComplete?: string;
  autoCapitalize?: string;
  inputMode?: "text" | "numeric" | "url" | "email" | "tel";
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`space-y-2 min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
          {label}
        </label>
        {action}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`${inputClassName} ${type === "date" ? "[color-scheme:dark]" : ""} ${
          error ? "border-rose-500/60" : "border-slate-800"
        }`}
        {...inputProps}
      />
      {error ? (
        <FieldError id={`${id}-error`} message={error} />
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function ExternalAction({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
    >
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function LabelStatusPanel({ status }: { status: LabelStatus }) {
  if (!status) {
    return (
      <p className="rounded-xl border border-slate-900 bg-slate-900/20 px-4 py-3 text-xs text-slate-500">
        Add the Quality Label expiry date and the portal will warn you {ESC_LABEL_WARNING_DAYS} days before it
        ends.
      </p>
    );
  }

  const styles = {
    expired: "border-rose-500/20 bg-rose-500/10 text-rose-200",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    ok: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  }[status.tone];
  const Icon = status.tone === "ok" ? CircleCheck : TriangleAlert;

  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <p>
        {status.tone === "ok"
          ? `The ESC Quality Label is valid until ${status.date} (${plural(status.days, "day")} left).`
          : `${labelStatusText(status)} Start the renewal with your National Agency.`}
      </p>
    </div>
  );
}

function LastSaved({
  updatedAt,
  updatedBy,
  updatedOutsidePortal,
}: {
  updatedAt: string;
  updatedBy: string | null;
  updatedOutsidePortal: boolean;
}) {
  const isClient = useIsClient();
  const source = updatedBy
    ? ` by ${updatedBy}`
    : updatedOutsidePortal
      ? " outside the portal (for example in Sanity Studio)"
      : "";

  return (
    <span>
      Last saved <time dateTime={updatedAt}>{formatTimestamp(updatedAt, isClient ? undefined : "UTC")}</time>
      {source}.
    </span>
  );
}

function ProfileSection({ profile }: { profile: SettingsProfile }) {
  const { openUserProfile } = useClerk();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? profile.email;
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || email || "User" : profile.name;

  return (
    <section
      id="profile"
      tabIndex={-1}
      className="scroll-mt-24 focus:outline-none bg-slate-950/40 border border-slate-900 rounded-2xl p-4 sm:p-6 space-y-6"
    >
      <h2 className="text-lg font-bold text-white border-b border-slate-900/60 pb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-emerald-400" />
        Personal Profile
      </h2>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</dt>
          <dd className="bg-slate-900/30 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 truncate">
            {name}
          </dd>
        </div>
        <div className="space-y-2 min-w-0">
          <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact Email</dt>
          <dd className="bg-slate-900/30 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 truncate">
            {email || "No email on file"}
          </dd>
        </div>
        <div className="space-y-2">
          <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Portal Role</dt>
          <dd>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <UserCog className="h-3.5 w-3.5" />
              {profile.roleLabel}
            </span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-900 bg-slate-900/20 p-3">
        <p className="text-xs text-slate-500">
          Your name, email address and password are managed through your account menu (the avatar in the
          sidebar). Roles are assigned by an owner or admin.
        </p>
        <button
          type="button"
          onClick={() => openUserProfile()}
          className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
        >
          <User className="h-4 w-4" />
          Manage Account
        </button>
      </div>
    </section>
  );
}

function NotificationToggle({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-4 p-3 bg-slate-900/20 border border-slate-900 rounded-xl cursor-pointer hover:border-slate-800 transition-colors"
    >
      <span>
        <span className="text-sm font-semibold text-white block">
          {title} <span className="text-xs font-normal text-slate-500">(email delivery not yet configured)</span>
        </span>
        <span className="text-xs text-slate-500 block">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 rounded accent-emerald-500 cursor-pointer"
      />
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-xs text-rose-400">
      {message}
    </p>
  );
}
