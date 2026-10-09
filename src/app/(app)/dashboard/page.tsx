import Link from "next/link";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import {
  Users,
  Calendar,
  Percent,
  Plus,
  Heart,
  ChevronRight,
  Activity,
  AlertCircle,
  Award,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { getVolunteersAction, type VolunteerData } from "@/app/actions/volunteers";
import { getActivitiesResultAction, type ActivityData } from "@/app/actions/activities";
import { getAttendanceRecordsAction, type AttendanceRecord } from "@/app/actions/attendance";
import { getPortalSettingsAction, type PortalSettings } from "@/app/actions/settings";
import { getProjectsAction, type ProjectWithStats } from "@/app/actions/projects";
import { getStaysAction } from "@/app/actions/stays";
import { getRoomsAction } from "@/app/actions/rooms";
import type { Room, Stay } from "@/lib/domain";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import ArrivalsCard from "@/components/dashboard/ArrivalsCard";
import ImpactTotalsCard from "@/components/dashboard/ImpactTotalsCard";
import PipelineCard from "@/components/dashboard/PipelineCard";
import ProjectsStrip from "@/components/dashboard/ProjectsStrip";
import ShareJoinCard from "@/components/dashboard/ShareJoinCard";
import {
  buildAlerts,
  buildJoinUrl,
  buildPipelineSummary,
  buildTravelSummary,
  countPublicProjects,
  organizationToday,
  stripProjects,
  volunteerLookup,
} from "@/components/dashboard/dashboardData";
import NextActivityCountdown, {
  LocalDate,
  UpcomingActivitiesList,
  UpcomingActivitiesProvider,
  UpcomingActivitiesStat,
  type ScheduledActivity,
} from "@/components/NextActivityCountdown";
import StatCard, { type StatCardProps } from "@/components/StatCard";
import OwnerConsole from "@/components/owner/OwnerConsole";
import { getDisplayName, requireAssignedRole } from "@/lib/auth";
import { MANAGER_ROLES, canRoleAccessRoute } from "@/lib/roles";
import {
  formatDateLabel,
  getActivityMinutes,
  getWallClock,
  minutesUntil,
  toDateKey,
  type WallClock,
} from "@/lib/dates";

const TREND_SIZE = 8;
const UPCOMING_LIST_SIZE = 4;
const RECENT_VOLUNTEERS_SIZE = 4;
/** UTC-12 to UTC+14: how far a viewer's wall clock can be from the server's. */
const MAX_TIME_ZONE_GAP_MINUTES = 26 * 60;
const DEFAULT_ORGANIZATION_NAME = "Volunteer in Morocco";

interface Loaded<T> {
  data: T;
  failed: boolean;
}

/** A source this role may not read: resolved empty without calling the action. */
function skipped<T>(fallback: T): Promise<Loaded<T>> {
  return Promise.resolve({ data: fallback, failed: false });
}

async function load<T>(label: string, loader: () => Promise<T>, fallback: T): Promise<Loaded<T>> {
  try {
    return { data: await loader(), failed: false };
  } catch (error) {
    unstable_rethrow(error);
    console.error(`Dashboard: failed to load ${label}:`, error);
    return { data: fallback, failed: true };
  }
}

function compareBySchedule(a: ScheduledActivity, b: ScheduledActivity): number {
  return (
    a.date.localeCompare(b.date) ||
    getActivityMinutes(a.startTime, a.endTime).start - getActivityMinutes(b.startTime, b.endTime).start ||
    a.title.localeCompare(b.title)
  );
}

function isCheckedIn(record: AttendanceRecord): boolean {
  return record.status === "Present" || record.status === "Late";
}

/** One record per volunteer and activity: the latest, as on the attendance page (records arrive oldest first). */
function latestRecordPerVolunteer(records: AttendanceRecord[]): AttendanceRecord[] {
  const byKey = new Map<string, AttendanceRecord>();
  for (const record of records) {
    byKey.set(`${record.activityId}::${record.volunteerId}`, record);
  }
  return [...byKey.values()];
}

interface ActivityAttendance {
  id: string;
  title: string;
  dateKey: string;
  total: number;
  checkedIn: number;
  rate: number;
}

function getActivityAttendance(activities: ActivityData[], records: AttendanceRecord[]): ActivityAttendance[] {
  const activityById = new Map(activities.map((activity) => [activity._id, activity]));
  const totals = new Map<string, Omit<ActivityAttendance, "rate">>();

  for (const record of records) {
    const activity = activityById.get(record.activityId);
    const title = activity?.title ?? record.activity?.title;
    if (!title) {
      continue;
    }
    const entry = totals.get(record.activityId) ?? {
      id: record.activityId,
      title,
      dateKey: toDateKey(activity?.date ?? record.activity?.date),
      total: 0,
      checkedIn: 0,
    };
    entry.total += 1;
    if (isCheckedIn(record)) {
      entry.checkedIn += 1;
    }
    totals.set(record.activityId, entry);
  }

  return [...totals.values()].map((entry) => ({
    ...entry,
    rate: Math.round((entry.checkedIn / entry.total) * 100),
  }));
}

/** Not-completed activities that may still be upcoming or in progress on some viewer's clock. */
function getScheduledActivities(activities: ActivityData[], serverClock: WallClock): ScheduledActivity[] {
  return activities
    .flatMap((activity): ScheduledActivity[] => {
      const date = toDateKey(activity.date);
      if (!activity._id || !date || activity.status === "Completed") {
        return [];
      }
      const { end } = getActivityMinutes(activity.startTime, activity.endTime);
      if (minutesUntil(date, end, serverClock) <= -MAX_TIME_ZONE_GAP_MINUTES) {
        return [];
      }
      return [
        {
          id: activity._id,
          title: activity.title,
          date,
          startTime: activity.startTime,
          endTime: activity.endTime,
          location: activity.location,
          category: activity.category,
          status: activity.status,
          maxVolunteers: Number(activity.maxVolunteers) || 0,
          checkedIn: activity.spotsFilled ?? 0,
        },
      ];
    })
    .sort(compareBySchedule);
}

function attendanceHref(activityId: string): string {
  return `/attendance?activity=${encodeURIComponent(activityId)}`;
}

function getInitials(volunteer: VolunteerData): string {
  const initials = `${volunteer.firstName?.charAt(0) ?? ""}${volunteer.lastName?.charAt(0) ?? ""}`.toUpperCase();
  return initials || "?";
}

export default async function Dashboard() {
  const user = await requireAssignedRole();
  // The owner sees the technical console only; the day-to-day dashboard is for admins and staff.
  if (user.role === "owner") {
    return <OwnerConsole user={user} />;
  }
  const canManage = MANAGER_ROLES.includes(user.role);

  // Every source loads (and fails) on its own, so one failing source never breaks the page.
  const [
    volunteersResult,
    activitiesResult,
    attendanceResult,
    settingsResult,
    projectsResult,
    staysResult,
    roomsResult,
    requestHeaders,
  ] = await Promise.all([
    canManage ? load("volunteers", () => getVolunteersAction(), [] as VolunteerData[]) : skipped<VolunteerData[]>([]),
    load<ActivityData[]>(
      "activities",
      () =>
        getActivitiesResultAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
      []
    ),
    load("attendance", () => getAttendanceRecordsAction(), [] as AttendanceRecord[]),
    load<PortalSettings | null>("portal settings", () => getPortalSettingsAction(), null),
    load("projects", () => getProjectsAction(), [] as ProjectWithStats[]),
    canManage ? load("stays", () => getStaysAction(), [] as Stay[]) : skipped<Stay[]>([]),
    canManage ? load("rooms", () => getRoomsAction(), [] as Room[]) : skipped<Room[]>([]),
    headers(),
  ]);

  const volunteers = volunteersResult.data;
  const activities = activitiesResult.data;
  const settings = settingsResult.data;
  const attendanceTarget = settings?.attendanceTarget ?? null;
  const failedSources = [
    volunteersResult.failed && "volunteers",
    activitiesResult.failed && "activities",
    attendanceResult.failed && "attendance",
    settingsResult.failed && "portal settings",
    projectsResult.failed && "projects",
    staysResult.failed && "stays",
    roomsResult.failed && "rooms",
  ].filter((source): source is string => Boolean(source));

  // Stays, alerts and deadlines use the organisation's calendar day (Morocco).
  const today = organizationToday();
  const projects = projectsResult.failed ? null : projectsResult.data;
  const stays = staysResult.failed ? null : staysResult.data;
  const rooms = roomsResult.failed ? null : roomsResult.data;
  const knownVolunteers = volunteersResult.failed ? null : volunteers;

  const travelSummary =
    canManage && stays
      ? buildTravelSummary(
          stays,
          volunteerLookup(volunteers),
          new Map((rooms ?? []).map((room) => [room._id, room])),
          new Map((projects ?? []).map((project) => [project._id, project])),
          today
        )
      : null;
  const alertsResult = canManage
    ? buildAlerts({
        today,
        stays,
        rooms,
        volunteers: knownVolunteers,
        projects,
        escLabelExpiry: settingsResult.failed ? null : settings?.escLabelExpiry,
        canOpenSettings: canRoleAccessRoute(user.role, "/settings"),
      })
    : null;
  const pipelineSummary = canManage && knownVolunteers ? buildPipelineSummary(knownVolunteers) : null;
  const runningProjects = stripProjects(projectsResult.data);
  const joinUrl = buildJoinUrl(requestHeaders);
  const organizationName = settings?.organizationName?.trim() || DEFAULT_ORGANIZATION_NAME;
  const heroDate = new Date().toLocaleDateString("en-GB", {
    timeZone: "Africa/Casablanca",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const knownActivityIds = activitiesResult.failed ? null : new Set(activities.map((activity) => activity._id));
  const knownVolunteerIds =
    canManage && !volunteersResult.failed ? new Set(volunteers.map((volunteer) => volunteer._id)) : null;
  const attendanceRecords = latestRecordPerVolunteer(
    attendanceResult.data.filter(
      (record) =>
        (!knownActivityIds || knownActivityIds.has(record.activityId)) &&
        (!knownVolunteerIds || knownVolunteerIds.has(record.volunteerId))
    )
  );
  const attendanceFailed = attendanceResult.failed;

  const totalVolunteers = volunteers.length;
  const activeVolunteers = volunteers.filter((volunteer) => volunteer.active).length;
  const totalActivities = activities.length;
  const activeActivities = activities.filter((activity) => activity.status === "Active").length;
  const completedActivities = activities.filter((activity) => activity.status === "Completed").length;

  const totalRecords = attendanceRecords.length;
  const totalPresent = attendanceRecords.filter((record) => record.status === "Present").length;
  const totalLate = attendanceRecords.filter((record) => record.status === "Late").length;
  const totalAbsent = attendanceRecords.filter((record) => record.status === "Absent").length;
  const totalCheckedIn = totalPresent + totalLate;
  const attendanceRate = totalRecords > 0 ? Math.round((totalCheckedIn / totalRecords) * 100) : null;
  const meetsTarget = attendanceRate !== null && attendanceTarget !== null && attendanceRate >= attendanceTarget;

  const serverClock = getWallClock();
  const activityAttendance = getActivityAttendance(activities, attendanceRecords);
  const scheduledActivities = getScheduledActivities(activities, serverClock);
  const bestAttended = [...activityAttendance].sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
  const trend = [...activityAttendance]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.title.localeCompare(b.title))
    .slice(-TREND_SIZE);
  const latestPoint = trend.at(-1);
  const trendDelta = trend.length >= 2 && latestPoint ? latestPoint.rate - trend[trend.length - 2].rate : null;

  const recentVolunteers = [...volunteers]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, RECENT_VOLUNTEERS_SIZE);

  const stats: StatCardProps[] = [
    canManage
      ? {
          title: "Total Volunteers",
          value: volunteersResult.failed ? "—" : totalVolunteers.toString(),
          badge: volunteersResult.failed ? "Unavailable" : `${activeVolunteers} active`,
          badgeTone: activeVolunteers > 0 ? "positive" : "neutral",
          caption: "registered volunteers",
          icon: Users,
          color: "from-emerald-500/10 to-teal-500/10 text-emerald-400 border-emerald-500/20",
        }
      : {
          title: "Total Activities",
          value: activitiesResult.failed ? "—" : totalActivities.toString(),
          badge: activitiesResult.failed ? "Unavailable" : `${completedActivities} completed`,
          badgeTone: "neutral",
          caption: "in the activity calendar",
          icon: Calendar,
          color: "from-emerald-500/10 to-teal-500/10 text-emerald-400 border-emerald-500/20",
        },
    {
      title: "Active Activities",
      value: activitiesResult.failed ? "—" : activeActivities.toString(),
      badge: activitiesResult.failed ? "Unavailable" : `of ${totalActivities} total`,
      badgeTone: "neutral",
      caption: "status set to Active",
      icon: Activity,
      color: "from-blue-500/10 to-indigo-500/10 text-blue-400 border-blue-500/20",
    },
    {
      title: "Attendance Rate",
      value: attendanceRate === null ? "—" : `${attendanceRate}%`,
      badge: attendanceFailed
        ? "Unavailable"
        : totalRecords > 0
          ? `${totalCheckedIn} of ${totalRecords} checked in`
          : "No records yet",
      badgeTone:
        attendanceRate === null || attendanceTarget === null ? "neutral" : meetsTarget ? "positive" : "warning",
      caption:
        attendanceTarget !== null
          ? `present or late · target ${attendanceTarget}%`
          : "present or late, across all records",
      icon: Percent,
      color: "from-purple-500/10 to-pink-500/10 text-purple-400 border-purple-500/20",
    },
  ];

  const breakdown = [
    { label: "Present", count: totalPresent, bar: "bg-emerald-500" },
    { label: "Late", count: totalLate, bar: "bg-amber-400" },
    { label: "Absent", count: totalAbsent, bar: "bg-rose-500" },
  ];

  return (
    <UpcomingActivitiesProvider
      activities={scheduledActivities}
      serverClock={serverClock}
      failed={activitiesResult.failed}
    >
      <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-600/30 via-slate-950 to-slate-950 p-6 md:p-8 shadow-[0_20px_60px_-30px_rgba(16,185,129,0.6)]">
          <div className="pointer-events-none absolute inset-0 bg-zellige opacity-[0.09]" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-red/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-sand/25 bg-brand-sand/10 px-3 py-1 text-xs font-semibold text-brand-sand">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                {organizationName} · Martil &amp; Tetouan · {heroDate}
              </p>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Marhaba, <span className="brand-gradient-text">{user.firstName?.trim() || getDisplayName(user)}</span>
              </h1>
              <p className="max-w-xl text-sm md:text-base text-slate-300">
                Be the change — here is how your volunteers, projects and activities are doing today.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canManage ? (
                <>
                  <Link
                    href="/volunteers"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-slate-100 backdrop-blur hover:bg-white/10 transition-all duration-200"
                  >
                    <Users className="h-4 w-4" />
                    Manage Volunteers
                  </Link>
                  <Link
                    href="/activities?new=1"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-lg shadow-emerald-500/30 transition-all duration-200"
                  >
                    <Plus className="h-4 w-4" />
                    Add Activity
                  </Link>
                </>
              ) : (
                <Link
                  href="/activities"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-lg shadow-emerald-500/30 transition-all duration-200"
                >
                  <Calendar className="h-4 w-4" />
                  Browse Activities
                </Link>
              )}
            </div>
          </div>
        </section>

        {failedSources.length > 0 && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <p>
              Could not load {failedSources.join(", ")} from the database. The figures below may be incomplete — reload
              the page to try again.
            </p>
          </div>
        )}

        <NextActivityCountdown canManage={canManage} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((item) => (
            <StatCard key={item.title} {...item} />
          ))}
          <UpcomingActivitiesStat />
        </div>

        {canManage && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ArrivalsCard summary={travelSummary} />
            </div>
            {alertsResult && <AlertsPanel result={alertsResult} />}
          </div>
        )}

        <ProjectsStrip projects={runningProjects} failed={projectsResult.failed} canManage={canManage} today={today} />

        <div className={`grid grid-cols-1 gap-6 ${canManage ? "lg:grid-cols-3" : "lg:grid-cols-1"}`}>
          <ImpactTotalsCard activities={activities} failed={activitiesResult.failed} canManage={canManage} />
          {canManage && <PipelineCard summary={pipelineSummary} />}
          {canManage && (
            <ShareJoinCard
              joinUrl={joinUrl}
              organizationName={organizationName}
              publicProjects={projectsResult.failed ? null : countPublicProjects(projectsResult.data)}
              canManage={canManage}
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 flex flex-col justify-between gap-4">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Attendance Breakdown</span>
            {attendanceFailed ? (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                Attendance could not be loaded.
              </p>
            ) : totalRecords === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">No attendance recorded yet.</p>
                {canManage && (
                  <Link
                    href="/attendance"
                    className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 hover:underline"
                  >
                    Record attendance
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {breakdown.map((item) => (
                    <span key={item.label} className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-white">{item.count}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <span className={`inline-block h-2 w-2 rounded-full ${item.bar}`} aria-hidden="true" />
                        {item.label}
                      </span>
                    </span>
                  ))}
                </div>
                <div
                  className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-800"
                  role="img"
                  aria-label={breakdown.map((item) => `${item.count} ${item.label.toLowerCase()}`).join(", ")}
                >
                  {breakdown
                    .filter((item) => item.count > 0)
                    .map((item) => (
                      <div
                        key={item.label}
                        className={`h-full ${item.bar}`}
                        style={{ width: `${(item.count / totalRecords) * 100}%` }}
                      />
                    ))}
                </div>
                <div className="pt-3 border-t border-slate-900/60 flex items-center justify-between text-xs text-slate-500">
                  <span>{totalRecords} records</span>
                  <span className="text-slate-300 font-semibold">{attendanceRate}% attendance rate</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
                Best Attended Activity
              </span>
              {bestAttended ? (
                <>
                  <Link
                    href={attendanceHref(bestAttended.id)}
                    className="text-base font-bold text-white block mt-1.5 truncate hover:text-emerald-300 hover:underline"
                    title={`View attendance for ${bestAttended.title}`}
                  >
                    {bestAttended.title}
                  </Link>
                  <span className="text-xs text-emerald-400 font-semibold block">
                    {bestAttended.rate}% attendance · {bestAttended.checkedIn}/{bestAttended.total} checked in
                  </span>
                </>
              ) : (
                <span className="text-sm text-slate-400 block mt-1.5">
                  {attendanceFailed ? "Attendance could not be loaded." : "No attendance logged yet."}
                </span>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Award className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Attendance Trend</span>
              {trendDelta !== null && (
                <span
                  className={`text-xs font-semibold flex items-center gap-1 ${
                    trendDelta > 0 ? "text-emerald-400" : trendDelta < 0 ? "text-rose-400" : "text-slate-400"
                  }`}
                >
                  {trendDelta > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : trendDelta < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {trendDelta === 0 ? "No change" : `${trendDelta > 0 ? "+" : ""}${trendDelta} pts vs previous`}
                </span>
              )}
            </div>
            {trend.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                {attendanceFailed ? (
                  <>
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    Attendance could not be loaded.
                  </>
                ) : (
                  <>
                    <BarChart2 className="h-4 w-4 shrink-0 text-slate-600" />
                    The trend appears once attendance is recorded.
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="relative h-16 w-full">
                  {attendanceTarget !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-500/70"
                      style={{ bottom: `${attendanceTarget}%` }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex h-full items-end gap-0.5">
                    {trend.map((point) => (
                      <Link
                        key={point.id}
                        href={attendanceHref(point.id)}
                        aria-label={`${point.title}, ${formatDateLabel(point.dateKey, { month: "short", day: "numeric" })}: ${point.rate}% (${point.checkedIn} of ${point.total} checked in). View attendance.`}
                        className="group relative flex h-full flex-1 items-end justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                      >
                        <div
                          className="w-full max-w-6 rounded-t bg-emerald-500 transition-colors group-hover:bg-emerald-400 group-focus-visible:bg-emerald-400"
                          style={{ height: `${Math.max(point.rate, 3)}%` }}
                        />
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-48 -translate-x-1/2 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <span className="block truncate font-semibold text-white">{point.title}</span>
                          <span className="block text-slate-400">
                            {formatDateLabel(point.dateKey, { month: "short", day: "numeric" })} · {point.rate}% (
                            {point.checkedIn}/{point.total})
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Last {trend.length} {trend.length === 1 ? "activity" : "activities"}
                    {latestPoint && <> · latest {latestPoint.rate}%</>}
                  </span>
                  {attendanceTarget !== null && (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 border-t border-dashed border-slate-500" aria-hidden="true" />
                      Target {attendanceTarget}%
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={`${canManage ? "lg:col-span-2" : "lg:col-span-3"} space-y-6`}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                <Activity className="h-5 w-5 text-emerald-400" />
                Upcoming Activities
              </h2>
              <Link
                href="/activities"
                className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
              >
                See all activities
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <UpcomingActivitiesList
              canManage={canManage}
              hasActivities={totalActivities > 0}
              limit={UPCOMING_LIST_SIZE}
            />
          </div>

          {canManage && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Heart className="h-5 w-5 text-emerald-400" />
                  New Volunteers
                </h2>
                <Link
                  href="/volunteers"
                  className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
                >
                  All volunteers
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 space-y-5">
                {recentVolunteers.length === 0 ? (
                  <div className="text-center py-6 space-y-3">
                    <Users className="h-8 w-8 text-slate-600 mx-auto" />
                    <p className="text-sm text-slate-400">
                      {volunteersResult.failed ? "Volunteers could not be loaded." : "No volunteers registered yet."}
                    </p>
                    {!volunteersResult.failed && (
                      <Link
                        href="/volunteers?new=1"
                        className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 hover:underline"
                      >
                        <Plus className="h-4 w-4" />
                        Add Volunteer
                      </Link>
                    )}
                  </div>
                ) : (
                  recentVolunteers.map((volunteer) => (
                    <div
                      key={volunteer._id}
                      className="flex items-start justify-between gap-3 pb-4 last:pb-0 border-b border-slate-900/60 last:border-b-0"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs border ${
                            volunteer.active
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border-slate-700/30"
                          }`}
                        >
                          {getInitials(volunteer)}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="text-sm font-bold text-white tracking-tight truncate">
                            {[volunteer.firstName, volunteer.lastName].filter(Boolean).join(" ") || volunteer.email}
                          </h4>
                          <p className="text-xs text-slate-500 truncate">{volunteer.email}</p>
                          {(volunteer.skills?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {volunteer.skills?.slice(0, 2).map((skill) => (
                                <span
                                  key={skill}
                                  className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800/80"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {volunteer.createdAt && (
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          <LocalDate
                            value={volunteer.createdAt}
                            options={{ month: "short", day: "numeric", year: "numeric" }}
                          />
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </UpcomingActivitiesProvider>
  );
}
