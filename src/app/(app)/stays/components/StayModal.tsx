"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CalendarRange, FileCheck2, LoaderCircle, Plane, TriangleAlert, UserPlus, Utensils } from "lucide-react";
import {
  ARRIVAL_AIRPORTS,
  ESC_RULES,
  PICKUP_STATUSES,
  STAY_STATUSES,
  YOUTHPASS_STATUSES,
  ageOn,
  type ArrivalAirportCode,
  type PickupStatus,
  type Room,
  type Stay,
  type StayStatus,
  type YouthpassStatus,
} from "@/lib/domain";
import { createStayAction, updateStayAction, type StayInput } from "@/app/actions/stays";
import AllowancesLedger from "./AllowancesLedger";
import {
  DIET_LABELS,
  PICKUP_STATUS_LABELS,
  STAY_STATUS_LABELS,
  YOUTHPASS_STATUS_LABELS,
  ageWarning,
  criminalRecordWarning,
  documentsChecklist,
  documentsCompleteness,
  isMoroccan,
  passportWarning,
  peakOccupancy,
  projectParticipants,
  shortDate,
  stayLength,
  volunteerName,
  type StayProjectOption,
  type StayVolunteerOption,
} from "./stayUtils";
import { FormField, Modal, WarningBox, callAction, inputClassName, type Notice } from "./ui";

interface StayForm {
  volunteerId: string;
  projectId: string;
  status: StayStatus;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: string;
  arrivalAirport: string;
  flightNumber: string;
  pickupBy: string;
  pickupStatus: string;
  roomId: string;
  passportChecked: boolean;
  passportExpiry: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  criminalRecordDate: string;
  agreementSigned: boolean;
  photoConsent: boolean;
  youthpassStatus: string;
  notes: string;
}

type StayErrors = Partial<Record<keyof StayForm, string>>;

const FIELD_ORDER: (keyof StayForm)[] = [
  "volunteerId",
  "status",
  "arrivalDate",
  "departureDate",
  "arrivalTime",
  "flightNumber",
  "roomId",
  "notes",
];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const FLIGHT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]*$/;
const MAX_NOTES = 2000;

function toForm(stay: Stay | null, defaults: { volunteerId?: string; projectId?: string }): StayForm {
  const docs = stay?.documents ?? {};
  return {
    volunteerId: stay?.volunteerId ?? defaults.volunteerId ?? "",
    projectId: stay?.projectId ?? defaults.projectId ?? "",
    status: stay?.status ?? "planned",
    arrivalDate: stay?.arrivalDate ?? "",
    departureDate: stay?.departureDate ?? "",
    arrivalTime: stay?.arrivalTime ?? "",
    arrivalAirport: stay?.arrivalAirport ?? "",
    flightNumber: stay?.flightNumber ?? "",
    pickupBy: stay?.pickupBy ?? "",
    pickupStatus: stay?.pickupStatus ?? "",
    roomId: stay?.roomId ?? "",
    passportChecked: !!docs.passportChecked,
    passportExpiry: docs.passportExpiry ?? "",
    insuranceProvider: docs.insuranceProvider ?? "",
    insurancePolicyNumber: docs.insurancePolicyNumber ?? "",
    criminalRecordDate: docs.criminalRecordDate ?? "",
    agreementSigned: !!docs.agreementSigned,
    photoConsent: !!docs.photoConsent,
    youthpassStatus: stay?.youthpassStatus ?? (stay ? "" : "not_applicable"),
    notes: stay?.notes ?? "",
  };
}

function toInput(form: StayForm): StayInput {
  const text = (value: string) => value.trim() || undefined;
  return {
    volunteerId: form.volunteerId,
    projectId: text(form.projectId),
    status: form.status,
    arrivalDate: text(form.arrivalDate),
    departureDate: text(form.departureDate),
    arrivalTime: text(form.arrivalTime),
    arrivalAirport: (text(form.arrivalAirport) as ArrivalAirportCode | undefined) ?? undefined,
    flightNumber: text(form.flightNumber)?.toUpperCase(),
    pickupBy: text(form.pickupBy),
    pickupStatus: text(form.pickupStatus) as PickupStatus | undefined,
    roomId: text(form.roomId),
    documents: {
      passportChecked: form.passportChecked,
      passportExpiry: text(form.passportExpiry),
      insuranceProvider: text(form.insuranceProvider),
      insurancePolicyNumber: text(form.insurancePolicyNumber),
      criminalRecordDate: text(form.criminalRecordDate),
      agreementSigned: form.agreementSigned,
      photoConsent: form.photoConsent,
    },
    youthpassStatus: text(form.youthpassStatus) as YouthpassStatus | undefined,
    notes: text(form.notes),
  };
}

function validate(form: StayForm): StayErrors {
  const errors: StayErrors = {};
  if (!form.volunteerId) errors.volunteerId = "Choose a volunteer.";
  if (form.arrivalDate && form.departureDate && form.departureDate <= form.arrivalDate) {
    errors.departureDate = "Departure must be after the arrival date.";
  }
  if ((form.status === "arrived" || form.status === "completed") && !form.arrivalDate) {
    errors.arrivalDate = "Set the arrival date for an arrived or completed stay.";
  }
  if (form.roomId && (!form.arrivalDate || !form.departureDate)) {
    errors.roomId = "Set both arrival and departure dates to assign a room.";
  }
  if (form.arrivalTime && !TIME_PATTERN.test(form.arrivalTime)) errors.arrivalTime = "Use 24-hour time (HH:mm).";
  if (form.flightNumber.trim() && !FLIGHT_PATTERN.test(form.flightNumber.trim())) {
    errors.flightNumber = "Letters, digits, spaces and dashes only.";
  }
  if (form.notes.length > MAX_NOTES) errors.notes = `Notes must be at most ${MAX_NOTES} characters.`;
  return errors;
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-slate-800/80 pt-5 first:border-t-0 first:pt-0 min-w-0">
      <legend className="flex items-center gap-2 text-sm font-bold text-white mb-4 float-left w-full">
        {icon}
        {title}
      </legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer text-sm text-slate-200"
    >
      {label}
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4.5 w-4.5 shrink-0 rounded accent-emerald-500"
      />
    </label>
  );
}

export default function StayModal({
  stay,
  defaults,
  stays,
  volunteers,
  projects,
  rooms,
  today,
  onClose,
  onSaved,
  onStayChanged,
  onNotice,
}: {
  stay: Stay | null;
  defaults: { volunteerId?: string; projectId?: string };
  stays: Stay[];
  volunteers: StayVolunteerOption[];
  projects: StayProjectOption[];
  rooms: Room[];
  today: string;
  onClose: () => void;
  onSaved: (stay: Stay, created: boolean) => void;
  onStayChanged: (stay: Stay) => void;
  onNotice: (notice: Notice) => void;
}) {
  const [form, setForm] = useState<StayForm>(() => toForm(stay, defaults));
  const [errors, setErrors] = useState<StayErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stayId = stay?._id ?? null;
  const volunteer = volunteers.find((item) => item._id === form.volunteerId);
  const project = projects.find((item) => item._id === form.projectId);
  const sortedVolunteers = useMemo(
    () => [...volunteers].sort((a, b) => volunteerName(a).localeCompare(volunteerName(b), "en", { sensitivity: "base" })),
    [volunteers]
  );
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")),
    [projects]
  );

  const update = <K extends keyof StayForm>(key: K, value: StayForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const documents = toInput(form).documents;
  const completeness = documentsCompleteness(documents);
  const checklist = documentsChecklist(documents);
  const length = stayLength(form);
  const hasRange = !!form.arrivalDate && !!form.departureDate && form.departureDate > form.arrivalDate;

  /* ----- Live warnings ----- */
  const age = volunteer?.dateOfBirth ? ageOn(volunteer.dateOfBirth) : null;
  const eligibility = ageWarning(volunteer, project);
  const taken = project ? projectParticipants(stays, project._id, stayId) : 0;
  const projectFull =
    !!project && project.maxParticipants !== undefined && form.status !== "cancelled" && taken >= project.maxParticipants;
  const overlapping = form.volunteerId
    ? stays.filter(
        (item) =>
          item._id !== stayId &&
          item.volunteerId === form.volunteerId &&
          item.status !== "cancelled" &&
          form.status !== "cancelled" &&
          !!item.arrivalDate &&
          !!form.arrivalDate &&
          item.arrivalDate < (form.departureDate || "9999-12-31") &&
          form.arrivalDate < (item.departureDate || "9999-12-31")
      )
    : [];
  const tooLong =
    length !== null && length > ESC_RULES.visaFreeDays && !isMoroccan(volunteer) ? length : null;
  const passport = passportWarning(documents, form);
  const criminal = criminalRecordWarning(documents, form.arrivalDate || undefined);
  const selectedRoom = rooms.find((room) => room._id === form.roomId);
  const roomPeak = selectedRoom && hasRange ? peakOccupancy(selectedRoom._id, stays, form.arrivalDate, form.departureDate, stayId) : 0;
  const roomFull = !!selectedRoom && hasRange && form.status !== "cancelled" && roomPeak >= selectedRoom.beds;

  const applyProjectDates = () => {
    if (!project) return;
    setForm((prev) => ({ ...prev, arrivalDate: project.startDate, departureDate: project.endDate }));
    setErrors((prev) => ({ ...prev, arrivalDate: undefined, departureDate: undefined, roomId: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);
    if (firstInvalid) {
      setFormError(null);
      document.getElementById(`stay-${firstInvalid}`)?.focus();
      return;
    }
    const payload = toInput(form);
    setFormError(null);
    setSaving(true);
    const result = await callAction(() => (stayId ? updateStayAction(stayId, payload) : createStayAction(payload)));
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    onSaved(result.data, !stayId);
  };

  const title = stay ? `Edit stay — ${volunteerName(volunteers.find((item) => item._id === stay.volunteerId))}` : "Add stay";

  return (
    <Modal titleId="stay-form-title" title={title} onClose={onClose} busy={saving} size="xl">
      <div className="overflow-y-auto flex-1 min-h-0">
        <form id="stay-form" onSubmit={handleSubmit} noValidate className="p-5 sm:p-6 space-y-5">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              {formError}
            </div>
          )}

          <Section icon={<CalendarRange className="h-4 w-4 text-emerald-400" />} title="Volunteer & project">
            {volunteers.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-4 text-sm text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>Register a volunteer first — every stay belongs to a volunteer.</span>
                <Link
                  href="/volunteers?new=1"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  <UserPlus className="h-4 w-4" />
                  Add volunteer
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="stay-volunteerId" label="Volunteer *" error={errors.volunteerId}>
                  <select
                    id="stay-volunteerId"
                    value={form.volunteerId}
                    onChange={(event) => update("volunteerId", event.target.value)}
                    aria-invalid={!!errors.volunteerId}
                    aria-describedby={errors.volunteerId ? "stay-volunteerId-error" : undefined}
                    className={inputClassName(errors.volunteerId)}
                  >
                    <option value="">Choose a volunteer…</option>
                    {sortedVolunteers.map((item) => (
                      <option key={item._id} value={item._id}>
                        {volunteerName(item)}
                        {item.nationality ? ` — ${item.nationality}` : ""}
                        {item.active ? "" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  id="stay-projectId"
                  label="Project"
                  hint={
                    project ? (
                      <>
                        {shortDate(project.startDate)} – {shortDate(project.endDate)}
                        {project.maxParticipants !== undefined && ` · ${taken}/${project.maxParticipants} places taken`}{" "}
                        {(form.arrivalDate !== project.startDate || form.departureDate !== project.endDate) && (
                          <button
                            type="button"
                            onClick={applyProjectDates}
                            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                          >
                            Use project dates
                          </button>
                        )}
                      </>
                    ) : (
                      "Optional — leave empty for an individual placement."
                    )
                  }
                >
                  <select
                    id="stay-projectId"
                    value={form.projectId}
                    onChange={(event) => update("projectId", event.target.value)}
                    className={inputClassName()}
                  >
                    <option value="">No project (individual placement)</option>
                    {sortedProjects.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                        {item.status === "cancelled" || item.status === "completed" ? ` (${item.status})` : ""}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            )}

            {volunteer && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {volunteer.nationality && (
                  <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                    {volunteer.nationality}
                  </span>
                )}
                <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  {age !== null ? `Age ${age}` : "No date of birth"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  <Utensils className="h-3 w-3 text-slate-500" />
                  Diet: {volunteer.diet ? DIET_LABELS[volunteer.diet] : "not recorded"}
                </span>
              </div>
            )}

            {(eligibility || projectFull || overlapping.length > 0) && (
              <div className="space-y-2">
                {eligibility && <WarningBox>{eligibility}</WarningBox>}
                {projectFull && project && (
                  <WarningBox>
                    {project.name} is full: {taken} of {project.maxParticipants} places are already taken.
                  </WarningBox>
                )}
                {overlapping.length > 0 && (
                  <WarningBox>
                    This volunteer already has {overlapping.length === 1 ? "a stay" : `${overlapping.length} stays`} overlapping
                    these dates ({overlapping.map((item) => `${shortDate(item.arrivalDate)} – ${shortDate(item.departureDate)}`).join(", ")}).
                  </WarningBox>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField id="stay-status" label="Status *">
                <select
                  id="stay-status"
                  value={form.status}
                  onChange={(event) => update("status", event.target.value as StayStatus)}
                  className={inputClassName()}
                >
                  {STAY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STAY_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="stay-arrivalDate" label="Arrival date" error={errors.arrivalDate}>
                <input
                  id="stay-arrivalDate"
                  type="date"
                  value={form.arrivalDate}
                  onChange={(event) => update("arrivalDate", event.target.value)}
                  aria-invalid={!!errors.arrivalDate}
                  aria-describedby={errors.arrivalDate ? "stay-arrivalDate-error" : undefined}
                  className={inputClassName(errors.arrivalDate)}
                />
              </FormField>
              <FormField
                id="stay-departureDate"
                label="Departure date"
                error={errors.departureDate}
                hint={length !== null && length > 0 ? `${length} night${length === 1 ? "" : "s"}` : undefined}
              >
                <input
                  id="stay-departureDate"
                  type="date"
                  min={form.arrivalDate || undefined}
                  value={form.departureDate}
                  onChange={(event) => update("departureDate", event.target.value)}
                  aria-invalid={!!errors.departureDate}
                  aria-describedby={errors.departureDate ? "stay-departureDate-error" : undefined}
                  className={inputClassName(errors.departureDate)}
                />
              </FormField>
            </div>
            {tooLong !== null && (
              <WarningBox tone="rose">
                This stay is {tooLong} days — longer than the {ESC_RULES.visaFreeDays} visa-free days for most foreign
                nationals. Plan a residence permit (carte de séjour) application or shorten the stay.
              </WarningBox>
            )}
          </Section>

          <Section icon={<Plane className="h-4 w-4 text-emerald-400" />} title="Arrival & pickup">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField id="stay-arrivalAirport" label="Airport">
                <select
                  id="stay-arrivalAirport"
                  value={form.arrivalAirport}
                  onChange={(event) => update("arrivalAirport", event.target.value)}
                  className={inputClassName()}
                >
                  <option value="">Not set</option>
                  {ARRIVAL_AIRPORTS.map((airport) => (
                    <option key={airport.code} value={airport.code}>
                      {airport.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="stay-arrivalTime" label="Arrival time" error={errors.arrivalTime}>
                <input
                  id="stay-arrivalTime"
                  type="time"
                  value={form.arrivalTime}
                  onChange={(event) => update("arrivalTime", event.target.value)}
                  aria-invalid={!!errors.arrivalTime}
                  className={inputClassName(errors.arrivalTime)}
                />
              </FormField>
              <FormField id="stay-flightNumber" label="Flight / bus" error={errors.flightNumber}>
                <input
                  id="stay-flightNumber"
                  type="text"
                  maxLength={20}
                  placeholder="e.g. AT 980"
                  value={form.flightNumber}
                  onChange={(event) => update("flightNumber", event.target.value)}
                  aria-invalid={!!errors.flightNumber}
                  aria-describedby={errors.flightNumber ? "stay-flightNumber-error" : undefined}
                  className={`${inputClassName(errors.flightNumber)} uppercase`}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="stay-pickupBy" label="Pickup by">
                <input
                  id="stay-pickupBy"
                  type="text"
                  maxLength={80}
                  placeholder="Team member or driver"
                  value={form.pickupBy}
                  onChange={(event) => update("pickupBy", event.target.value)}
                  className={inputClassName()}
                />
              </FormField>
              <FormField id="stay-pickupStatus" label="Pickup status">
                <select
                  id="stay-pickupStatus"
                  value={form.pickupStatus}
                  onChange={(event) => update("pickupStatus", event.target.value)}
                  className={inputClassName()}
                >
                  <option value="">Not set</option>
                  {PICKUP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PICKUP_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField
              id="stay-roomId"
              label="Room"
              error={errors.roomId}
              hint={
                rooms.length === 0
                  ? "No rooms yet — add rooms on the Rooms tab."
                  : hasRange
                    ? "Occupancy shown for the busiest night of this stay."
                    : "Set arrival and departure dates to see free beds."
              }
            >
              <select
                id="stay-roomId"
                value={form.roomId}
                onChange={(event) => update("roomId", event.target.value)}
                aria-invalid={!!errors.roomId}
                aria-describedby={errors.roomId ? "stay-roomId-error" : undefined}
                className={inputClassName(errors.roomId)}
              >
                <option value="">No room assigned</option>
                {rooms.map((room) => {
                  const peak = hasRange ? peakOccupancy(room._id, stays, form.arrivalDate, form.departureDate, stayId) : null;
                  const label =
                    peak === null
                      ? `${room.name} — ${room.beds} bed${room.beds === 1 ? "" : "s"}`
                      : `${room.name} — ${peak}/${room.beds} beds taken${peak >= room.beds ? " (full)" : ""}`;
                  return (
                    <option key={room._id} value={room._id}>
                      {label}
                      {room.location ? ` · ${room.location}` : ""}
                    </option>
                  );
                })}
              </select>
            </FormField>
            {roomFull && selectedRoom && (
              <WarningBox>
                {selectedRoom.name} already has {roomPeak} of {selectedRoom.beds} beds taken on at least one night of this
                stay. Saving will put the room over capacity.
              </WarningBox>
            )}
          </Section>

          <Section icon={<FileCheck2 className="h-4 w-4 text-emerald-400" />} title={`Documents — ${completeness}% complete`}>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full ${completeness === 100 ? "bg-emerald-500" : completeness >= 60 ? "bg-amber-400" : "bg-rose-400"}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
            <ul className="flex flex-wrap gap-1.5 text-[11px]" aria-label="Documents checklist">
              {checklist.map((item) => (
                <li
                  key={item.key}
                  className={`px-2 py-0.5 rounded-full border ${
                    item.done
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-950 text-slate-500"
                  }`}
                >
                  {item.done ? "✓ " : ""}
                  {item.label}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CheckboxRow
                id="stay-passportChecked"
                label="Passport checked"
                checked={form.passportChecked}
                onChange={(checked) => update("passportChecked", checked)}
              />
              <FormField id="stay-passportExpiry" label="Passport expiry">
                <input
                  id="stay-passportExpiry"
                  type="date"
                  value={form.passportExpiry}
                  onChange={(event) => update("passportExpiry", event.target.value)}
                  className={inputClassName()}
                />
              </FormField>
            </div>
            {passport && <WarningBox tone="rose">{passport}</WarningBox>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="stay-insuranceProvider" label="Insurance provider">
                <input
                  id="stay-insuranceProvider"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. CIGNA (ESC insurance)"
                  value={form.insuranceProvider}
                  onChange={(event) => update("insuranceProvider", event.target.value)}
                  className={inputClassName()}
                />
              </FormField>
              <FormField id="stay-insurancePolicyNumber" label="Policy number">
                <input
                  id="stay-insurancePolicyNumber"
                  type="text"
                  maxLength={60}
                  value={form.insurancePolicyNumber}
                  onChange={(event) => update("insurancePolicyNumber", event.target.value)}
                  className={inputClassName()}
                />
              </FormField>
            </div>
            <FormField
              id="stay-criminalRecordDate"
              label="Criminal record certificate date"
              hint="Must be issued at most 6 months before arrival."
            >
              <input
                id="stay-criminalRecordDate"
                type="date"
                max={today}
                value={form.criminalRecordDate}
                onChange={(event) => update("criminalRecordDate", event.target.value)}
                className={inputClassName()}
              />
            </FormField>
            {criminal && <WarningBox>{criminal}</WarningBox>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CheckboxRow
                id="stay-agreementSigned"
                label="Volunteer agreement signed"
                checked={form.agreementSigned}
                onChange={(checked) => update("agreementSigned", checked)}
              />
              <CheckboxRow
                id="stay-photoConsent"
                label="Photo consent given"
                checked={form.photoConsent}
                onChange={(checked) => update("photoConsent", checked)}
              />
            </div>
          </Section>

          <Section icon={<FileCheck2 className="h-4 w-4 text-emerald-400" />} title="Youthpass & notes">
            <FormField id="stay-youthpassStatus" label="Youthpass">
              <select
                id="stay-youthpassStatus"
                value={form.youthpassStatus}
                onChange={(event) => update("youthpassStatus", event.target.value)}
                className={inputClassName()}
              >
                <option value="">Not set</option>
                {YOUTHPASS_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {YOUTHPASS_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="stay-notes"
              label="Notes"
              error={errors.notes}
              hint={`${form.notes.length}/${MAX_NOTES} characters`}
            >
              <textarea
                id="stay-notes"
                rows={3}
                maxLength={MAX_NOTES}
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                aria-invalid={!!errors.notes}
                className={`${inputClassName(errors.notes)} resize-none`}
              />
            </FormField>
          </Section>
        </form>

        <div className="px-5 sm:px-6 pb-6">
          <div className="border-t border-slate-800/80 pt-5">
            {stay ? (
              <AllowancesLedger stay={stay} today={today} onStayChanged={onStayChanged} onNotice={onNotice} />
            ) : (
              <p className="text-xs text-slate-500">
                Save the stay first to record pocket money, food and travel allowance payments.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/40 shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors"
        >
          {stay ? "Close" : "Cancel"}
        </button>
        <button
          type="submit"
          form="stay-form"
          disabled={saving || volunteers.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
        >
          {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : stay ? "Save changes" : "Add stay"}
        </button>
      </div>
    </Modal>
  );
}
