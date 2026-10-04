"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, ChevronRight, Clock, MapPin, Plus, Radio } from "lucide-react";
import StatCard from "@/components/StatCard";
import {
  formatDateLabel,
  formatTime,
  getActivityDateTime,
  getActivityPhase,
  getWallClock,
  type WallClock,
} from "@/lib/dates";

export interface ScheduledActivity {
  id: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  category: string;
  status: "Upcoming" | "Active" | "Completed";
  maxVolunteers: number;
  checkedIn: number;
}

interface UpcomingEntry {
  activity: ScheduledActivity;
  phase: "upcoming" | "live";
}

interface UpcomingState {
  upcoming: UpcomingEntry[];
  todayKey: string;
  /** Device time in ms, or null while rendering on the server and hydrating. */
  now: number | null;
  failed: boolean;
}

const UpcomingActivitiesContext = createContext<UpcomingState | null>(null);

const STATUS_BADGE: Record<ScheduledActivity["status"], string> = {
  Upcoming: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Active: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Completed: "text-slate-400 bg-slate-800 border-slate-700/50",
};

function subscribeToClock(callback: () => void) {
  const timer = window.setInterval(callback, 1000);
  return () => window.clearInterval(timer);
}

function getClockSnapshot(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

function getServerClockSnapshot(): number | null {
  return null;
}

function subscribeToNothing() {
  return () => {};
}

/** Shows a stored date or timestamp in the viewer's time zone; renders a placeholder until the page hydrates. */
export function LocalDate({ value, options }: { value: string; options?: Intl.DateTimeFormatOptions }) {
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  return <time dateTime={value}>{hydrated ? formatDateLabel(value, options) : "…"}</time>;
}

function attendanceHref(activityId: string): string {
  return `/attendance?activity=${encodeURIComponent(activityId)}`;
}

function getTimeRange(activity: ScheduledActivity): string {
  return [formatTime(activity.startTime), formatTime(activity.endTime)].filter(Boolean).join(" - ");
}

/**
 * Decides which activities are still upcoming or in progress using the viewer's device clock and time zone,
 * so the countdown, the count and the list always agree and advance on their own when an activity ends.
 * Until the page hydrates it uses the server's clock reading, which keeps the server and first client render equal.
 */
export function UpcomingActivitiesProvider({
  activities,
  serverClock,
  failed = false,
  children,
}: {
  activities: ScheduledActivity[];
  serverClock: WallClock;
  failed?: boolean;
  children: ReactNode;
}) {
  const now = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);
  const clock = now === null ? serverClock : getWallClock(new Date(now));
  const upcoming = activities.flatMap((activity): UpcomingEntry[] => {
    const phase = getActivityPhase(activity, clock);
    return phase === "upcoming" || phase === "live" ? [{ activity, phase }] : [];
  });

  return (
    <UpcomingActivitiesContext.Provider value={{ upcoming, todayKey: clock.dateKey, now, failed }}>
      {children}
    </UpcomingActivitiesContext.Provider>
  );
}

function useUpcomingActivities(): UpcomingState {
  const state = useContext(UpcomingActivitiesContext);
  if (!state) {
    throw new Error("Upcoming activity components must be rendered inside UpcomingActivitiesProvider.");
  }
  return state;
}

export default function NextActivityCountdown({ canManage = false }: { canManage?: boolean }) {
  const { upcoming, now } = useUpcomingActivities();
  const next = upcoming[0];
  if (!next) {
    return null;
  }

  const { activity, phase } = next;
  const timeRange = getTimeRange(activity);
  const details = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
      <span className="flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5 text-slate-500" />
        {formatDateLabel(activity.date, { weekday: "short", month: "short", day: "numeric" })}
        {timeRange && <span className="text-slate-500">· {timeRange}</span>}
      </span>
      {activity.location && (
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-semibold text-slate-300">{activity.location}</span>
        </span>
      )}
    </div>
  );

  if (phase === "live") {
    return (
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
            <Radio className="h-4 w-4 animate-pulse" />
            Happening Now
          </span>
          <h3 className="text-xl font-extrabold text-white">{activity.title}</h3>
          {details}
          <p className="text-xs text-slate-400">
            {canManage
              ? "This activity is in progress. Record volunteer check-ins as they arrive."
              : "This activity is in progress."}
          </p>
        </div>
        {canManage && (
          <Link
            href={attendanceHref(activity.id)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200 shrink-0"
          >
            Record Attendance
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  const start = getActivityDateTime(activity.date, activity.startTime);
  const remaining = now !== null && start ? Math.max(0, start.getTime() - now) : null;
  const units = [
    { label: "Days", value: remaining === null ? null : Math.floor(remaining / 86_400_000) },
    { label: "Hrs", value: remaining === null ? null : Math.floor(remaining / 3_600_000) % 24 },
    { label: "Min", value: remaining === null ? null : Math.floor(remaining / 60_000) % 60 },
    { label: "Sec", value: remaining === null ? null : Math.floor(remaining / 1000) % 60 },
  ];

  return (
    <div className="bg-gradient-to-r from-slate-950/80 to-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-1.5">
        <span className="text-xs text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-amber-400 animate-pulse" /> Next Activity Starts In
        </span>
        <h3 className="text-xl font-extrabold text-white tracking-tight">{activity.title}</h3>
        {details}
      </div>

      <div className="flex items-center gap-3" role="timer" aria-label={`Time until ${activity.title} starts`}>
        {units.map((unit) => (
          <div key={unit.label} className="flex flex-col items-center">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl h-14 min-w-14 px-2 flex items-center justify-center font-bold text-lg text-emerald-400 tabular-nums shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              {unit.value === null ? "--" : String(unit.value).padStart(2, "0")}
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-1.5">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UpcomingActivitiesStat() {
  const { upcoming, failed } = useUpcomingActivities();
  const next = upcoming[0];
  const live = upcoming.filter((entry) => entry.phase === "live").length;

  return (
    <StatCard
      title="Upcoming Activities"
      value={failed ? "—" : upcoming.length.toString()}
      badge={
        failed
          ? "Unavailable"
          : !next
            ? "None scheduled"
            : live > 0
              ? `${live} happening now`
              : `Next: ${formatDateLabel(next.activity.date, { month: "short", day: "numeric" })}`
      }
      badgeTone={live > 0 ? "positive" : "neutral"}
      caption="planned or in progress"
      icon={Clock}
      color="from-amber-500/10 to-orange-500/10 text-amber-400 border-amber-500/20"
    />
  );
}

export function UpcomingActivitiesList({
  canManage,
  hasActivities,
  limit,
}: {
  canManage: boolean;
  hasActivities: boolean;
  limit: number;
}) {
  const { upcoming, todayKey, failed } = useUpcomingActivities();

  if (failed) {
    return (
      <div className="py-12 px-6 border border-rose-500/20 bg-rose-500/5 rounded-2xl text-center space-y-2">
        <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
        <p className="text-sm font-semibold text-slate-300">Activities could not be loaded.</p>
        <p className="text-xs text-slate-500">Reload the page to try again.</p>
      </div>
    );
  }

  if (upcoming.length === 0) {
    return (
      <div className="py-12 px-6 border border-slate-900 bg-slate-950/20 rounded-2xl text-center space-y-4">
        <Calendar className="h-8 w-8 text-slate-600 mx-auto" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-300">No upcoming activities scheduled.</p>
          <p className="text-xs text-slate-500">
            {canManage
              ? "Plan the next activity so volunteers know where to show up."
              : "Check back soon — new activities will appear here."}
          </p>
        </div>
        {canManage ? (
          <Link
            href="/activities?new=1"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Add Activity
          </Link>
        ) : (
          hasActivities && (
            <Link
              href="/activities"
              className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              View past activities
              <ChevronRight className="h-4 w-4" />
            </Link>
          )
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {upcoming.slice(0, limit).map(({ activity, phase }) => {
        const capacity = activity.maxVolunteers > 0 ? activity.maxVolunteers : null;
        const fillPercent = capacity ? Math.min(100, Math.round((activity.checkedIn / capacity) * 100)) : 0;
        const timeRange = getTimeRange(activity);
        return (
          <div
            key={activity.id}
            className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 hover:border-slate-800 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {activity.category && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/50">
                    {activity.category}
                  </span>
                )}
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_BADGE[activity.status] ?? STATUS_BADGE.Upcoming}`}
                >
                  {activity.status}
                </span>
                {phase === "live" ? (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    Happening now
                  </span>
                ) : (
                  activity.date === todayKey && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                      Today
                    </span>
                  )
                )}
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight truncate">{activity.title}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400 text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  {formatDateLabel(activity.date, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {timeRange && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {timeRange}
                  </span>
                )}
                {activity.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                    {activity.location}
                  </span>
                )}
              </div>
            </div>

            <div className="md:w-48 space-y-2 shrink-0">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">Checked In</span>
                <span className="text-white font-bold">
                  {capacity ? `${activity.checkedIn}/${capacity}` : `${activity.checkedIn} · no limit`}
                </span>
              </div>
              <div
                className="w-full h-2 bg-slate-800 rounded-full overflow-hidden"
                role="progressbar"
                aria-label={`Checked in for ${activity.title}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={fillPercent}
              >
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
