import Link from "next/link";
import { BedDouble, ChevronRight, PlaneLanding, PlaneTakeoff } from "lucide-react";
import { formatTime } from "@/lib/dates";
import { PICKUP_STATUS_BADGES, PICKUP_STATUS_LABELS, dayLabel } from "@/app/(app)/stays/components/stayUtils";
import { CARD_CLASS, CardHeading, CardLoadError, TEXT_LINK } from "./DashboardCard";
import type { TravelRow, TravelSummary } from "./dashboardData";

function TravelItem({ row }: { row: TravelRow }) {
  const isArrival = row.kind === "arrival";
  const Icon = isArrival ? PlaneLanding : PlaneTakeoff;
  const time = formatTime(row.time);
  const travel = [isArrival ? time : null, row.airport, row.flightNumber].filter(Boolean).join(" · ");

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 border-b border-slate-900/60 last:border-b-0">
      <div
        className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center ${
          isArrival
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-sky-500/10 border-sky-500/20 text-sky-300"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-white truncate">
          <span className="sr-only">{isArrival ? "Arrival: " : "Departure: "}</span>
          {row.volunteerName}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {isArrival ? travel || "Arrival time not set" : "Departs"}
          {row.projectName && <span className="text-slate-500"> · {row.projectName}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {isArrival && row.pickupStatus && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PICKUP_STATUS_BADGES[row.pickupStatus]}`}>
              Pickup: {PICKUP_STATUS_LABELS[row.pickupStatus]}
            </span>
          )}
          {row.roomName && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border text-slate-300 bg-slate-800 border-slate-700/50">
              <BedDouble className="h-3 w-3" aria-hidden="true" />
              {row.roomName}
            </span>
          )}
          {isArrival && row.documentsPercent !== undefined && row.documentsPercent < 100 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-amber-300 bg-amber-500/10 border-amber-500/30">
              Documents {row.documentsPercent}%
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/** Arrivals and departures today and tomorrow (managers only). `summary` is null when stays failed to load. */
export default function ArrivalsCard({ summary }: { summary: TravelSummary | null }) {
  const total = summary ? summary.days.reduce((sum, day) => sum + day.rows.length, 0) : 0;

  return (
    <section aria-labelledby="arrivals-heading" className={`${CARD_CLASS} flex flex-col gap-4`}>
      <CardHeading
        id="arrivals-heading"
        icon={PlaneLanding}
        title="Arrivals & Departures"
        count={summary ? total : undefined}
        href="/stays"
        linkLabel="Open stays"
      />

      {!summary ? (
        <CardLoadError>Stays could not be loaded.</CardLoadError>
      ) : total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <div className="h-11 w-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <PlaneLanding className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-300">Nobody arrives or leaves today or tomorrow.</p>
            <p className="text-xs text-slate-500">
              {summary.nextArrival
                ? `Next arrival: ${summary.nextArrival.volunteerName} on ${dayLabel(summary.nextArrival.date)}.`
                : "Add a stay with flight details to plan the airport pickup from Tangier or Tetouan."}
            </p>
          </div>
          <Link href="/stays" className={TEXT_LINK}>
            {summary.nextArrival ? "See upcoming arrivals" : "Plan a stay"}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {summary.days.map((day) => (
            <div key={day.key} className="space-y-2">
              <h3 className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span>
                  {day.label} <span className="normal-case tracking-normal font-medium">· {dayLabel(day.date)}</span>
                </span>
                <span className="normal-case tracking-normal font-medium">
                  {day.rows.length === 0 ? "Nothing planned" : `${day.rows.length} ${day.rows.length === 1 ? "move" : "moves"}`}
                </span>
              </h3>
              {day.rows.length > 0 && (
                <ul className="rounded-xl border border-slate-900 bg-slate-900/30 px-3 py-3">
                  {day.rows.map((row) => (
                    <TravelItem key={row.key} row={row} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
