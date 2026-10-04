"use client";

import { useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Bell,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Globe,
  LoaderCircle,
  RotateCcw,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  Undo,
  User,
  UserCog,
} from "lucide-react";
import {
  getEditablePortalSettingsAction,
  updatePortalSettingsAction,
  type EditablePortalSettings,
} from "@/app/actions/settings";
import { PORTAL_COUNTRIES } from "@/sanity/schemas/settings";

export interface SettingsProfile {
  name: string;
  email: string;
  roleLabel: string;
}

interface SettingsClientProps {
  initialSettings: EditablePortalSettings | null;
  profile: SettingsProfile;
}

interface SettingsForm {
  organizationName: string;
  attendanceTarget: string;
  defaultCountry: string;
  weeklyDigest: boolean;
  registrationAlerts: boolean;
}

type FieldErrors = Partial<Record<"organizationName" | "attendanceTarget" | "defaultCountry", string>>;

type Notice = {
  type: "success" | "error";
  text: string;
  source?: "validation" | "conflict";
} | null;

const FORM_ID = "portal-settings-form";
const ORGANIZATION_NAME_MAX_LENGTH = 100;

const inputClassName =
  "w-full bg-slate-900/60 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 disabled:opacity-60";

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
    icon: Globe,
    title: "Organization Preferences",
    description: "Portal name, attendance target and default country.",
  },
  {
    href: "#notifications",
    formSection: true,
    icon: Bell,
    title: "Notifications",
    description: "Weekly digest and new registration alert preferences.",
  },
];

function toForm(settings: EditablePortalSettings): SettingsForm {
  return {
    organizationName: settings.organizationName,
    attendanceTarget: String(settings.attendanceTarget),
    defaultCountry: settings.defaultCountry,
    weeklyDigest: settings.weeklyDigest,
    registrationAlerts: settings.registrationAlerts,
  };
}

function isFormChanged(form: SettingsForm, saved: SettingsForm): boolean {
  return (Object.keys(form) as (keyof SettingsForm)[]).some((key) => form[key] !== saved[key]);
}

function validateForm(form: SettingsForm): FieldErrors {
  const errors: FieldErrors = {};
  const organizationName = form.organizationName.trim();
  if (!organizationName) {
    errors.organizationName = "Organization name is required.";
  } else if (organizationName.length > ORGANIZATION_NAME_MAX_LENGTH) {
    errors.organizationName = `Use ${ORGANIZATION_NAME_MAX_LENGTH} characters or fewer.`;
  }
  const target = form.attendanceTarget.trim();
  if (!/^\d+$/.test(target) || Number(target) > 100) {
    errors.attendanceTarget = "Enter a whole number from 0 to 100.";
  }
  if (!(PORTAL_COUNTRIES as readonly string[]).includes(form.defaultCountry)) {
    errors.defaultCountry = "Choose a country from the list.";
  }
  return errors;
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

export default function SettingsClient({ initialSettings, profile }: SettingsClientProps) {
  return initialSettings ? (
    <SettingsEditor initialSettings={initialSettings} profile={profile} />
  ) : (
    <SettingsLoadError profile={profile} />
  );
}

function SettingsEditor({
  initialSettings,
  profile,
}: {
  initialSettings: EditablePortalSettings;
  profile: SettingsProfile;
}) {
  const [isSaving, startSave] = useTransition();
  const [isLoadingLatest, startLoadLatest] = useTransition();
  const [saved, setSaved] = useState(initialSettings);
  const [form, setForm] = useState(() => toForm(initialSettings));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice>(null);

  const isBusy = isSaving || isLoadingLatest;
  const isDirty = isFormChanged(form, toForm(saved));

  const updateField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    let remainingErrors = fieldErrors;
    if (key in fieldErrors) {
      remainingErrors = { ...fieldErrors };
      delete remainingErrors[key as keyof FieldErrors];
      setFieldErrors(remainingErrors);
    }
    const hasRemainingErrors = Object.keys(remainingErrors).length > 0;
    setNotice((current) => (current?.source === "validation" && hasRemainingErrors ? current : null));
  };

  const handleReset = () => {
    setForm(toForm(saved));
    setFieldErrors({});
    setNotice(null);
  };

  const handleLoadLatest = () => {
    startLoadLatest(async () => {
      try {
        const latest = await getEditablePortalSettingsAction();
        setSaved(latest);
        setForm(toForm(latest));
        setFieldErrors({});
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || isBusy) {
      return;
    }

    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setNotice({ type: "error", text: "Please fix the highlighted fields before saving.", source: "validation" });
      return;
    }

    setNotice(null);
    startSave(async () => {
      try {
        const result = await updatePortalSettingsAction(
          {
            organizationName: form.organizationName.trim(),
            attendanceTarget: Number(form.attendanceTarget.trim()),
            defaultCountry: form.defaultCountry,
            weeklyDigest: form.weeklyDigest,
            registrationAlerts: form.registrationAlerts,
          },
          saved.revision
        );
        if (!result.ok) {
          setNotice({
            type: "error",
            text: result.error,
            source: "conflict" in result ? "conflict" : undefined,
          });
          return;
        }
        setSaved(result.data);
        setForm(toForm(result.data));
        setNotice({ type: "success", text: "Settings saved." });
      } catch {
        setNotice({ type: "error", text: "Could not reach the server. Check your connection and try again." });
      }
    });
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
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
        actions={
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
        }
      />

      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.type === "error"
              ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {notice.type === "error" ? (
            <CircleAlert className="h-5 w-5 shrink-0" />
          ) : (
            <CircleCheck className="h-5 w-5 shrink-0" />
          )}
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>{notice.text}</span>
            {notice.source === "conflict" && (
              <button
                type="button"
                onClick={handleLoadLatest}
                disabled={isBusy}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isLoadingLatest ? "animate-spin" : ""}`} />
                {isLoadingLatest ? "Loading..." : "Load latest settings"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <SectionNav includeFormSections />

        <div className="md:col-span-2 space-y-6">
          <ProfileSection profile={profile} />

          <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-6">
            <fieldset disabled={isBusy} className="min-w-0 space-y-6">
              <section
                id="organization"
                tabIndex={-1}
                className="scroll-mt-24 focus:outline-none bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-6"
              >
                <h2 className="text-lg font-bold text-white border-b border-slate-900/60 pb-3 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-emerald-400" />
                  Organization Preferences
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="organizationName"
                      className="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
                    >
                      Organization Name
                    </label>
                    <input
                      id="organizationName"
                      type="text"
                      required
                      maxLength={ORGANIZATION_NAME_MAX_LENGTH}
                      value={form.organizationName}
                      onChange={(event) => updateField("organizationName", event.target.value)}
                      aria-invalid={!!fieldErrors.organizationName}
                      aria-describedby={
                        fieldErrors.organizationName ? "organizationName-error" : "organizationName-hint"
                      }
                      className={`${inputClassName} ${
                        fieldErrors.organizationName ? "border-rose-500/60" : "border-slate-800"
                      }`}
                    />
                    {fieldErrors.organizationName ? (
                      <FieldError id="organizationName-error" message={fieldErrors.organizationName} />
                    ) : (
                      <p id="organizationName-hint" className="text-xs text-slate-500">
                        Saved with your portal settings. Not shown in the sidebar or page titles yet.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="attendanceTarget"
                        className="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
                      >
                        Attendance Rate Target (%)
                      </label>
                      <input
                        id="attendanceTarget"
                        type="number"
                        inputMode="numeric"
                        required
                        min={0}
                        max={100}
                        step={1}
                        value={form.attendanceTarget}
                        onChange={(event) => updateField("attendanceTarget", event.target.value)}
                        aria-invalid={!!fieldErrors.attendanceTarget}
                        aria-describedby={
                          fieldErrors.attendanceTarget ? "attendanceTarget-error" : "attendanceTarget-hint"
                        }
                        className={`${inputClassName} ${
                          fieldErrors.attendanceTarget ? "border-rose-500/60" : "border-slate-800"
                        }`}
                      />
                      {fieldErrors.attendanceTarget ? (
                        <FieldError id="attendanceTarget-error" message={fieldErrors.attendanceTarget} />
                      ) : (
                        <p id="attendanceTarget-hint" className="text-xs text-slate-500">
                          Your goal for the attendance rate across activities (0-100%).
                        </p>
                      )}
                    </div>

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
              </section>

              <section
                id="notifications"
                tabIndex={-1}
                className="scroll-mt-24 focus:outline-none bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-4"
              >
                <h2 className="text-lg font-bold text-white border-b border-slate-900/60 pb-3 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-emerald-400" />
                  Notifications
                </h2>

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
              </section>
            </fieldset>
          </form>
        </div>
      </div>
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
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      <SettingsHeader />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <SectionNav />

        <div className="md:col-span-2 space-y-6">
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Settings className="h-8 w-8 text-emerald-400" />
          Portal Settings
        </h1>
        <p className="text-slate-400 mt-1">
          Manage your organization details, attendance goal and notification preferences.
        </p>
        {status && <p className="text-xs text-slate-500 mt-2">{status}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

function SectionNav({ includeFormSections = false }: { includeFormSections?: boolean }) {
  const links = includeFormSections ? sectionLinks : sectionLinks.filter((link) => !link.formSection);

  return (
    <nav aria-label="Settings sections" className="space-y-4">
      {links.map(({ href, icon: Icon, title, description }) => (
        <a
          key={href}
          href={href}
          className="group block bg-slate-950/40 border border-slate-900 rounded-xl p-4 space-y-1 hover:border-emerald-500/30 hover:bg-slate-900/60 transition-all duration-200"
        >
          <span className="text-sm font-bold text-slate-200 group-hover:text-white flex items-center gap-2">
            <Icon className="h-4 w-4 text-emerald-400" />
            {title}
          </span>
          <span className="text-xs text-slate-500 block">{description}</span>
        </a>
      ))}

      <Link
        href="/admin/assign-roles"
        className="group block bg-slate-950/40 border border-slate-900 rounded-xl p-4 space-y-1 hover:border-emerald-500/30 hover:bg-slate-900/60 transition-all duration-200"
      >
        <span className="text-sm font-bold text-slate-200 group-hover:text-white flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          Access Controls
          <ChevronRight className="h-4 w-4 ml-auto text-slate-500 group-hover:text-emerald-400 transition-colors" />
        </span>
        <span className="text-xs text-slate-500 block">Assign roles to new sign-ins on the Assign Roles page.</span>
      </Link>
    </nav>
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
      className="scroll-mt-24 focus:outline-none bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-6"
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
