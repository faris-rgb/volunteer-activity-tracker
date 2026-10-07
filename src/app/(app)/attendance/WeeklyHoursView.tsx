"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import { ESC_RULES, type VolunteerType } from "@/lib/domain";
import { formatTime } from "@/lib/dates";
import type { AttendanceVolunteer } from "./AttendanceClient";
import {
  activityDurationHours,
  addDays,
  dayParts,
  ESC_STATUS_LABELS,
  filterWeeklyRows,
  formatHours,
  formatWeekRange,
  isDateKey,
  startOfWeek,
  toDayLabel,
  type EscHoursStatus,
  type WeeklyFilter,
  type WeeklyHours,
} from "./hours";

interface WeeklyHoursViewProps {
  /** Null until the current week is known (it depends on the viewer's clock, so it is resolved after hydration). */
  weekly: WeeklyHours<AttendanceVolunteer> | null;
  weekStart: string;
  todayKey: string;
  isCurrentWeek: boolean;
  hasVolunteers: boolean;
  filter: WeeklyFilter;
  onFilterChange: (filter: WeeklyFilter) => void;
  /** A Monday "YYYY-MM-DD", or "" for the current week. */
  onWeekChange: (weekStart: string) => void;
  onOpenActivity: (activityId: string) => void;
}

const TYPE_BADGES: Record<VolunteerType, { label: string; className: string }> = {
  incoming_esc: { label: "ESC", className: "text-sky-300 bg-sky-500/10 border-sky-500/20" },
  local: { label: "Local", className: "text-slate-300 bg-slate-800 border-slate-700/50" },
  domestic: { label: "Domestic", className: "text-slate-300 bg-slate-800 border-slate-700/50" },
  outgoing: { label: "Outgoing", className: "text-slate-300 bg-slate-800 border-slate-700/50" },
};

const ESC_TOTAL_CLASSES: Record<EscHoursStatus, { text: string; badge: string; row: string }> = {
  under: {
    text: "text-amber-400",
    badge: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    row: "bg-amber-500/[0.04]",
  },
  ok: {
    text: "text-emerald-400",
    badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    row: "",
  },
  over: {
    text: "text-rose-400",
    badge: "text-rose-300 bg-rose-500/10 border-rose-500/20",
    row: "bg-rose-500/[0.05]",
  },
};

const FILTER_LABELS: Record<WeeklyFilter, string> = {
  all: "All",
  esc: "ESC volunteers",
  attention: "Needs attention",
};

function fullName(volunteer: AttendanceVolunteer): string {
  return `${volunteer.firstName} ${volunteer.lastName}`.trim() || "Unnamed volunteer";
}

function initials(volunteer: AttendanceVolunteer): string {
  return `${volunteer.firstName.charAt(0)}${volunteer.lastName.charAt(0)}`.toUpperCase() || "?";
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "amber" | "rose" | "emerald";
}) {
  const toneClasses = {
    neutral: "text-white",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  }[tone];
  return (
    <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 space-y-1 print:border-slate-300 print:bg-transparent">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 print:text-black">
        <Icon className="h-3.5 w-3.5 text-slate-500" /> {label}
      </p>
      <p className={`text-2xl font-extrabold tracking-tight ${toneClasses} print:text-black`}>{value}</p>
      <p className="text-[11px] text-slate-500 print:text-black">{hint}</p>
    </div>
  );
}

export default function WeeklyHoursView({
  weekly,
  weekStart,
  todayKey,
  isCurrentWeek,
  hasVolunteers,
  filter,
  onFilterChange,
  onWeekChange,
  onOpenActivity,
}: WeeklyHoursViewProps) {
  if (!weekly || !weekStart) {
    return (
      <div
        role="status"
        className="bg-slate-950/40 border border-slate-900 rounded-2xl p-10 flex items-center justify-center gap-2 text-sm text-slate-400"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Loading this week…
      </div>
    );
  }

  const visibleRows = filterWeeklyRows(weekly.rows, filter);
  const filterCounts: Record<WeeklyFilter, number> = {
    all: weekly.rows.length,
    esc: filterWeeklyRows(weekly.rows, "esc").length,
    attention: filterWeeklyRows(weekly.rows, "attention").length,
  };
  const volunteersWithHours = weekly.rows.filter((row) => row.total > 0).length;
  const escRows = weekly.rows.filter((row) => row.isEsc);
  const underCount = escRows.filter((row) => row.escStatus === "under").length;
  const overCount = escRows.filter((row) => row.escStatus === "over").length;
  const onTrackCount = escRows.length - underCount - overCount;
  const firstActivity = weekly.activities[0];
  const weekLabel = formatWeekRange(weekStart);

  const goToWeek = (offsetDays: number) => {
    onWeekChange(startOfWeek(addDays(weekStart, offsetDays)));
  };

  return (
    <section aria-labelledby="weekly-hours-title" className="space-y-6">
      <div className="hidden print:block space-y-1">
        <h1 className="text-2xl font-bold">Weekly hours: {weekLabel}</h1>
        <p className="text-sm">
          ESC volunteers should log {ESC_RULES.minWeeklyHours}–{ESC_RULES.maxWeeklyHours} hours a week. Total logged:{" "}
          {formatHours(weekly.total) || "0h"}.
        </p>
      </div>

      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToWeek(-7)}
            aria-label="Previous week"
            title="Previous week"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 md:flex-none md:min-w-[13rem] text-center">
            <h2 id="weekly-hours-title" className="text-sm font-bold text-white tracking-tight">
              {weekLabel}
            </h2>
            <p className="text-[11px] text-slate-500">
              {isCurrentWeek ? "This week" : "Monday to Sunday"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => goToWeek(7)}
            aria-label="Next week"
            title="Next week"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onWeekChange("")}
            disabled={isCurrentWeek}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            This week
          </button>
          <label htmlFor="weekly-hours-date" className="sr-only">
            Show the week that contains a date
          </label>
          <input
            id="weekly-hours-date"
            type="date"
            value={weekStart}
            onChange={(event) => {
              if (isDateKey(event.target.value)) {
                onWeekChange(startOfWeek(event.target.value));
              }
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Timer}
          label="Hours logged"
          value={formatHours(weekly.total) || "0h"}
          hint={`${weekly.activities.length} activit${weekly.activities.length === 1 ? "y" : "ies"} this week`}
        />
        <StatCard
          icon={Users}
          label="Volunteers"
          value={String(volunteersWithHours)}
          hint="with hours this week"
        />
        <StatCard
          icon={AlertTriangle}
          label={`ESC under ${ESC_RULES.minWeeklyHours}h`}
          value={escRows.length > 0 ? String(underCount) : "—"}
          hint={escRows.length > 0 ? `${onTrackCount} of ${escRows.length} ESC on track` : "No ESC volunteers this week"}
          tone={underCount > 0 ? "amber" : "neutral"}
        />
        <StatCard
          icon={AlertTriangle}
          label={`ESC over ${ESC_RULES.maxWeeklyHours}h`}
          value={escRows.length > 0 ? String(overCount) : "—"}
          hint={`ESC limit is ${ESC_RULES.maxWeeklyHours}h a week`}
          tone={overCount > 0 ? "rose" : "neutral"}
        />
      </div>

      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 md:p-6 space-y-5 print:border-0 print:bg-transparent print:p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
          <p className="text-xs text-slate-400 max-w-xl">
            Hours from Present and Late check-ins. ESC volunteers should log{" "}
            <span className="text-white font-semibold">
              {ESC_RULES.minWeeklyHours}–{ESC_RULES.maxWeeklyHours} hours
            </span>{" "}
            a week; other volunteers are not checked.
          </p>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter volunteers">
            {(Object.keys(FILTER_LABELS) as WeeklyFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onFilterChange(option)}
                aria-pressed={filter === option}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  filter === option
                    ? "bg-slate-900 text-white border-slate-800"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {FILTER_LABELS[option]}
                <span className="ml-1 text-[10px] text-slate-500">{filterCounts[option]}</span>
              </button>
            ))}
          </div>
        </div>

        {!hasVolunteers ? (
          <div className="py-10 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white">No volunteers yet</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Add volunteers and record their attendance to see weekly hours and the ESC {ESC_RULES.minWeeklyHours}–
              {ESC_RULES.maxWeeklyHours}h check here.
            </p>
            <Link
              href="/volunteers?new=1"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              <UserPlus className="h-4 w-4" /> Add volunteers
            </Link>
          </div>
        ) : weekly.rows.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Timer className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white">No hours logged this week</p>
            <p className="text-xs text-slate-400 max-w-sm">
              {firstActivity
                ? "Check volunteers in to this week's activities and their hours will add up here."
                : "No activities are scheduled this week. Create one, then record attendance to log hours."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
              {firstActivity ? (
                <button
                  type="button"
                  onClick={() => onOpenActivity(firstActivity._id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" /> Record attendance
                </button>
              ) : (
                <Link
                  href="/activities?new=1"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
                >
                  <CalendarPlus className="h-4 w-4" /> Create an activity
                </Link>
              )}
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => onWeekChange("")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
                >
                  Go to this week
                </button>
              )}
            </div>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-xs text-slate-500">
              {filter === "attention"
                ? "Every ESC volunteer is within the weekly hours range."
                : "No ESC volunteers have hours this week."}
            </p>
            <button
              type="button"
              onClick={() => onFilterChange("all")}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:text-white print:hidden"
            >
              Show all volunteers
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-950 print:border-0 print:bg-transparent">
            <table className="w-full min-w-[760px] text-left border-collapse text-sm">
              <caption className="sr-only">
                Hours per volunteer for the week of {weekLabel}, Monday to Sunday, with weekly totals
              </caption>
              <thead>
                <tr className="border-b border-slate-900 text-xs font-semibold text-slate-400 uppercase print:text-black">
                  <th scope="col" className="sticky left-0 z-10 bg-slate-950 py-3 px-4 print:static print:bg-transparent">
                    Volunteer
                  </th>
                  {weekly.days.map((day) => {
                    const parts = dayParts(day);
                    const isToday = day === todayKey;
                    return (
                      <th
                        key={day}
                        scope="col"
                        className={`py-3 px-2 text-center ${isToday ? "bg-emerald-500/5 text-emerald-300" : ""}`}
                      >
                        <span className="block">{parts?.weekday}</span>
                        <span className="block text-[10px] font-medium normal-case text-slate-500">
                          {parts ? `${parts.day} ${parts.month}` : day}
                        </span>
                      </th>
                    );
                  })}
                  <th scope="col" className="py-3 px-4 text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {visibleRows.map((row) => {
                  const { volunteer } = row;
                  const badge = volunteer.volunteerType ? TYPE_BADGES[volunteer.volunteerType] : null;
                  const tone = row.escStatus ? ESC_TOTAL_CLASSES[row.escStatus] : null;
                  return (
                    <tr key={volunteer._id} className={tone?.row ?? ""}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-slate-950 py-3 px-4 font-normal text-left print:static print:bg-transparent"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 print:hidden">
                            {initials(volunteer)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate max-w-[10rem] sm:max-w-[14rem] print:text-black print:max-w-none">
                              {fullName(volunteer)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {badge && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              )}
                              {!volunteer.active && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-slate-700 bg-slate-800 text-slate-400">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </th>
                      {row.days.map((hours, index) => {
                        const entries = row.entries[index];
                        const isToday = weekly.days[index] === todayKey;
                        const detail = entries.map((entry) => `${entry.title}: ${formatHours(entry.hours)}`).join("\n");
                        return (
                          <td
                            key={weekly.days[index]}
                            title={detail || undefined}
                            className={`py-3 px-2 text-center tabular-nums ${isToday ? "bg-emerald-500/5" : ""} ${
                              entries.length > 0 ? "text-slate-200 font-semibold print:text-black" : "text-slate-700"
                            }`}
                          >
                            {entries.length > 0 ? (
                              formatHours(hours)
                            ) : (
                              <>
                                <span aria-hidden="true">—</span>
                                <span className="sr-only">No hours</span>
                              </>
                            )}
                            {entries.length > 1 && (
                              <span className="block text-[9px] font-normal text-slate-500">
                                {entries.length} activities
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-extrabold tabular-nums ${tone?.text ?? "text-white"} print:text-black`}
                        >
                          {formatHours(row.total) || "0h"}
                        </span>
                        {row.escStatus && (
                          <span
                            className={`mt-1 ml-auto flex w-fit items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                              ESC_TOTAL_CLASSES[row.escStatus].badge
                            }`}
                          >
                            {row.escStatus === "ok" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {ESC_STATUS_LABELS[row.escStatus]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-800 text-xs text-slate-400 print:text-black">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-slate-950 py-3 px-4 text-left font-semibold uppercase print:static print:bg-transparent"
                  >
                    {filter === "all" ? "Daily total" : "Daily total (shown)"}
                  </th>
                  {weekly.days.map((day, index) => {
                    const total = visibleRows.reduce((sum, row) => sum + row.days[index], 0);
                    return (
                      <td
                        key={day}
                        className={`py-3 px-2 text-center font-semibold tabular-nums ${
                          day === todayKey ? "bg-emerald-500/5" : ""
                        }`}
                      >
                        {total > 0 ? formatHours(total) : "—"}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right font-extrabold text-white tabular-nums print:text-black">
                    {formatHours(visibleRows.reduce((sum, row) => sum + row.total, 0)) || "0h"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 md:p-6 space-y-4 print:hidden">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-emerald-400" /> Activities this week
          <span className="text-[11px] font-semibold text-slate-500">{weekly.activities.length}</span>
        </h3>
        {weekly.activities.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-400">No activities are scheduled between {weekLabel}.</p>
            <Link
              href="/activities?new=1"
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              <CalendarPlus className="h-4 w-4" /> Create an activity
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-900/60">
            {weekly.activities.map((activity) => {
              const duration = activityDurationHours(activity.startTime, activity.endTime);
              const times = [formatTime(activity.startTime), formatTime(activity.endTime)].filter(Boolean).join(" – ");
              return (
                <li key={activity._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{activity.title}</p>
                    <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                      <span>{toDayLabel(activity.date)}</span>
                      {times && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {times}
                        </span>
                      )}
                      {duration !== undefined && <span>{formatHours(duration)} per volunteer</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenActivity(activity._id)}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Record attendance
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
