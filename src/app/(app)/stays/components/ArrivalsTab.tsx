"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  BedDouble,
  Car,
  CircleCheck,
  Clock,
  FileText,
  LoaderCircle,
  MessageCircle,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  SquarePen,
  UserPlus,
  UserX,
} from "lucide-react";
import { fillTemplate, whatsappLink, type PickupStatus, type Room, type Stay } from "@/lib/domain";
import { formatTime } from "@/lib/dates";
import {
  DIET_LABELS,
  PICKUP_STATUS_BADGES,
  PICKUP_STATUS_LABELS,
  STAY_STATUS_BADGES,
  STAY_STATUS_LABELS,
  VISA_BADGES,
  addDays,
  airportLabel,
  dayLabel,
  documentsCompleteness,
  initials,
  volunteerName,
  visaCounter,
  type StayProjectOption,
  type StayVolunteerOption,
} from "./stayUtils";
import { Badge, ICON_BUTTON, PRIMARY_BUTTON } from "./ui";

const QUICK_PICKUPS: { status: PickupStatus; label: string; icon: typeof Clock; active: string }[] = [
  { status: "scheduled", label: "Scheduled", icon: Clock, active: "border-sky-500/40 bg-sky-500/15 text-sky-200" },
  { status: "picked_up", label: "Picked up", icon: CircleCheck, active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" },
  { status: "no_show", label: "No-show", icon: UserX, active: "border-rose-500/40 bg-rose-500/15 text-rose-200" },
];

interface Lookups {
  volunteers: Map<string, StayVolunteerOption>;
  projects: Map<string, StayProjectOption>;
  rooms: Map<string, Room>;
}

function byArrival(a: Stay, b: Stay) {
  return (a.arrivalDate ?? "").localeCompare(b.arrivalDate ?? "") || (a.arrivalTime ?? "99:99").localeCompare(b.arrivalTime ?? "99:99");
}

function byDeparture(a: Stay, b: Stay) {
  return (a.departureDate ?? "").localeCompare(b.departureDate ?? "");
}

function SectionHeader({ icon, title, count, hint }: { icon: ReactNode; title: string; count: number; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold text-white">
        {icon}
        {title}
        <span className="text-xs font-semibold text-slate-500 bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5">
          {count}
        </span>
      </h2>
      {hint && <span className="text-xs text-slate-500 hidden sm:block">{hint}</span>}
    </div>
  );
}

function ArrivalCard({
  stay,
  lookups,
  today,
  busyStatus,
  pickupTemplate,
  organizationName,
  onPickup,
  onEdit,
}: {
  stay: Stay;
  lookups: Lookups;
  today: string;
  busyStatus: PickupStatus | null;
  pickupTemplate: string;
  organizationName: string;
  onPickup: (stay: Stay, status: PickupStatus) => void;
  onEdit: (stay: Stay) => void;
}) {
  const volunteer = lookups.volunteers.get(stay.volunteerId);
  const project = stay.projectId ? lookups.projects.get(stay.projectId) : undefined;
  const room = stay.roomId ? lookups.rooms.get(stay.roomId) : undefined;
  const name = volunteerName(volunteer);
  const docs = documentsCompleteness(stay.documents);
  const visa = visaCounter(stay, volunteer, today);
  const whatsapp = whatsappLink(
    volunteer?.phoneNumber,
    fillTemplate(pickupTemplate, {
      firstName: volunteer?.firstName,
      org: organizationName,
      project: project?.name,
      date: dayLabel(stay.arrivalDate),
      time: stay.arrivalTime ? formatTime(stay.arrivalTime) : "",
    })
  );

  return (
    <li className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-bold border text-sm bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            {initials(volunteer)}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-sm truncate">{name}</div>
            <div className="text-xs text-slate-500 truncate">
              {[volunteer?.nationality, project?.name ?? "Individual placement"].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={stay.pickupStatus ? PICKUP_STATUS_BADGES[stay.pickupStatus] : PICKUP_STATUS_BADGES.not_needed}>
            {stay.pickupStatus ? PICKUP_STATUS_LABELS[stay.pickupStatus] : "Pickup not set"}
          </Badge>
          {stay.status !== "planned" && (
            <Badge className={STAY_STATUS_BADGES[stay.status]}>{STAY_STATUS_LABELS[stay.status]}</Badge>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0">
          <dt className="sr-only">Arrival</dt>
          <Plane className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <dd className="truncate">
            <span className="text-slate-200 font-semibold">{stay.arrivalTime ? formatTime(stay.arrivalTime) : "Time not set"}</span>
            {stay.flightNumber && <span> · {stay.flightNumber}</span>}
          </dd>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <dt className="sr-only">Airport</dt>
          <PlaneLanding className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <dd className="truncate">{airportLabel(stay.arrivalAirport) || "Airport not set"}</dd>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <dt className="sr-only">Pickup by</dt>
          <Car className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <dd className="truncate">{stay.pickupBy ? `Pickup: ${stay.pickupBy}` : "No driver assigned"}</dd>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <dt className="sr-only">Room</dt>
          <BedDouble className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <dd className="truncate">{room ? room.name : "No room assigned"}</dd>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <dt className="sr-only">Documents</dt>
          <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <dd className={docs === 100 ? "text-emerald-400" : "text-amber-300"}>Documents {docs}%</dd>
        </div>
        {volunteer?.diet && volunteer.diet !== "none" && (
          <div className="flex items-center gap-1.5 min-w-0">
            <dt className="sr-only">Diet</dt>
            <dd className="text-slate-300">Diet: {DIET_LABELS[volunteer.diet]}</dd>
          </div>
        )}
        {visa && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Days in Morocco</dt>
            <dd>
              <Badge className={VISA_BADGES[visa.level]}>Day {visa.day}/90</Badge>
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Pickup status for ${name}`}>
          {QUICK_PICKUPS.map((option) => {
            const Icon = option.icon;
            const selected = stay.pickupStatus === option.status;
            const pending = busyStatus === option.status;
            return (
              <button
                key={option.status}
                type="button"
                aria-pressed={selected}
                disabled={busyStatus !== null || selected || stay.status === "cancelled"}
                onClick={() => onPickup(stay, option.status)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:cursor-default ${
                  selected
                    ? option.active
                    : "border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                }`}
              >
                {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ICON_BUTTON} hover:text-emerald-400`}
              title="Send pickup details on WhatsApp"
              aria-label={`Send pickup details to ${name} on WhatsApp`}
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onEdit(stay)}
            className={ICON_BUTTON}
            title="Edit stay"
            aria-label={`Edit stay of ${name}`}
          >
            <SquarePen className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

export default function ArrivalsTab({
  stays,
  lookups,
  today,
  busy,
  hasVolunteers,
  pickupTemplate,
  organizationName,
  onPickup,
  onEdit,
  onCreate,
}: {
  stays: Stay[];
  lookups: Lookups;
  today: string;
  busy: { stayId: string; status: PickupStatus } | null;
  hasVolunteers: boolean;
  pickupTemplate: string;
  organizationName: string;
  onPickup: (stay: Stay, status: PickupStatus) => void;
  onEdit: (stay: Stay) => void;
  onCreate: () => void;
}) {
  const tomorrow = addDays(today, 1);
  const horizon = addDays(today, 14);
  const weekEnd = addDays(today, 6);
  const recentFrom = addDays(today, -3);

  const live = stays.filter((stay) => stay.status !== "cancelled");
  const arriving = live.filter((stay) => stay.arrivalDate && stay.status !== "completed").sort(byArrival);
  const todayArrivals = arriving.filter((stay) => stay.arrivalDate === today);
  const tomorrowArrivals = arriving.filter((stay) => stay.arrivalDate === tomorrow);
  const laterArrivals = arriving.filter(
    (stay) => (stay.arrivalDate as string) > tomorrow && (stay.arrivalDate as string) <= horizon
  );
  const unconfirmed = arriving.filter(
    (stay) =>
      (stay.arrivalDate as string) >= recentFrom &&
      (stay.arrivalDate as string) < today &&
      (stay.status === "planned" || stay.status === "confirmed")
  );
  const departures = live
    .filter((stay) => stay.departureDate && stay.departureDate >= today && stay.departureDate <= weekEnd)
    .sort(byDeparture);

  const totalUpcoming = todayArrivals.length + tomorrowArrivals.length + laterArrivals.length;

  const renderCards = (list: Stay[]) => (
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {list.map((stay) => (
        <ArrivalCard
          key={stay._id}
          stay={stay}
          lookups={lookups}
          today={today}
          busyStatus={busy?.stayId === stay._id ? busy.status : null}
          pickupTemplate={pickupTemplate}
          organizationName={organizationName}
          onPickup={onPickup}
          onEdit={onEdit}
        />
      ))}
    </ul>
  );

  if (totalUpcoming === 0 && departures.length === 0 && unconfirmed.length === 0) {
    return (
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl px-6 py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
          <PlaneLanding className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-white">No arrivals or departures in the next two weeks</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
          {hasVolunteers
            ? "Add a stay with flight details and the pickup plan will show up here — from Tangier, Tetouan or any other airport."
            : "Register your first volunteer, then add their stay with flight details to plan the airport pickup."}
        </p>
        {hasVolunteers ? (
          <button type="button" onClick={onCreate} className={`mt-6 ${PRIMARY_BUTTON}`}>
            <Plus className="h-4 w-4" />
            Add a stay
          </button>
        ) : (
          <Link href="/volunteers?new=1" className={`mt-6 ${PRIMARY_BUTTON}`}>
            <UserPlus className="h-4 w-4" />
            Add your first volunteer
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {unconfirmed.length > 0 && (
        <section className="space-y-3" aria-label="Recent arrivals to confirm">
          <SectionHeader
            icon={<Clock className="h-4 w-4 text-amber-400" />}
            title="Arrived? Confirm pickup"
            count={unconfirmed.length}
            hint="Arrival date passed but the stay isn't marked as arrived"
          />
          {renderCards(unconfirmed)}
        </section>
      )}

      <section className="space-y-3" aria-label="Arriving today">
        <SectionHeader icon={<PlaneLanding className="h-4 w-4 text-emerald-400" />} title="Today" count={todayArrivals.length} hint={dayLabel(today)} />
        {todayArrivals.length > 0 ? renderCards(todayArrivals) : <EmptyLine>No arrivals today.</EmptyLine>}
      </section>

      <section className="space-y-3" aria-label="Arriving tomorrow">
        <SectionHeader icon={<PlaneLanding className="h-4 w-4 text-sky-400" />} title="Tomorrow" count={tomorrowArrivals.length} hint={dayLabel(tomorrow)} />
        {tomorrowArrivals.length > 0 ? renderCards(tomorrowArrivals) : <EmptyLine>No arrivals tomorrow.</EmptyLine>}
      </section>

      <section className="space-y-3" aria-label="Arriving in the next 14 days">
        <SectionHeader
          icon={<PlaneLanding className="h-4 w-4 text-slate-400" />}
          title="Next 14 days"
          count={laterArrivals.length}
          hint={`${dayLabel(addDays(today, 2))} – ${dayLabel(horizon)}`}
        />
        {laterArrivals.length > 0 ? (
          <div className="space-y-4">
            {Array.from(new Set(laterArrivals.map((stay) => stay.arrivalDate as string))).map((date) => (
              <div key={date} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{dayLabel(date)}</h3>
                {renderCards(laterArrivals.filter((stay) => stay.arrivalDate === date))}
              </div>
            ))}
          </div>
        ) : (
          <EmptyLine>No other arrivals in the next two weeks.</EmptyLine>
        )}
      </section>

      <section className="space-y-3" aria-label="Departures this week">
        <SectionHeader
          icon={<PlaneTakeoff className="h-4 w-4 text-violet-400" />}
          title="Departures this week"
          count={departures.length}
          hint={`${dayLabel(today)} – ${dayLabel(weekEnd)}`}
        />
        {departures.length === 0 ? (
          <EmptyLine>Nobody leaves in the next 7 days.</EmptyLine>
        ) : (
          <ul className="bg-slate-950/40 border border-slate-900 rounded-2xl divide-y divide-slate-900/60">
            {departures.map((stay) => {
              const volunteer = lookups.volunteers.get(stay.volunteerId);
              const project = stay.projectId ? lookups.projects.get(stay.projectId) : undefined;
              const room = stay.roomId ? lookups.rooms.get(stay.roomId) : undefined;
              const name = volunteerName(volunteer);
              return (
                <li key={stay._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {[project?.name ?? "Individual placement", room?.name].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={stay.departureDate === today ? "text-amber-300 bg-amber-500/10 border-amber-500/20" : "text-slate-300 bg-slate-800 border-slate-700/50"}>
                      {stay.departureDate === today ? "Leaves today" : dayLabel(stay.departureDate)}
                    </Badge>
                    <Link
                      href={`/certificates/${encodeURIComponent(stay._id)}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Certificate
                    </Link>
                    <button
                      type="button"
                      onClick={() => onEdit(stay)}
                      className={ICON_BUTTON}
                      aria-label={`Edit stay of ${name}`}
                      title="Edit stay"
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export type { Lookups };
