import Link from "next/link";
import { CalendarRange, ChevronRight, FolderKanban, MapPin, Plus, Users } from "lucide-react";
import type { ProjectStatus } from "@/lib/domain";
import { formatDateLabel } from "@/lib/dates";
import type { ProjectWithStats } from "@/app/actions/projects";
import { CARD_CLASS, CardHeading, CardLoadError, PRIMARY_LINK } from "./DashboardCard";
import { relativeDay } from "./dashboardData";

const MAX_PROJECTS = 6;

const STATUS_BADGES: Partial<Record<ProjectStatus, { label: string; className: string }>> = {
  running: { label: "Running", className: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  open: { label: "Open", className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

function dateRange(start: string, end: string): string {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const from = formatDateLabel(start, options, "");
  const to = formatDateLabel(end, options, "");
  return from && to ? `${from} – ${to}` : from || to || "Dates not set";
}

function ProjectTile({ project, canManage, today }: { project: ProjectWithStats; canManage: boolean; today: string }) {
  const badge = STATUS_BADGES[project.status];
  const max = project.maxParticipants;
  const count = project.participantCount;
  const percent = max ? Math.min(100, Math.round((count / max) * 100)) : 0;
  const full = max !== undefined && max > 0 && count >= max;
  const deadline =
    project.status === "open" && project.applicationDeadline && project.applicationDeadline >= today
      ? project.applicationDeadline
      : null;

  return (
    <li className="rounded-xl border border-slate-900 bg-slate-900/30 p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-white leading-snug break-words min-w-0">{project.name}</h3>
        {badge && (
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${badge.className}`}>{badge.label}</span>
        )}
      </div>
      <div className="space-y-1 text-xs text-slate-400">
        <p className="flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="truncate">{dateRange(project.startDate, project.endDate)}</span>
        </p>
        {project.location && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="truncate">{project.location}</span>
          </p>
        )}
        {deadline && <p className="text-amber-300/90">Applications close {relativeDay(today, deadline)}</p>}
      </div>
      <div className="mt-auto space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">Participants</span>
          <span className={`font-bold tabular-nums ${full ? "text-amber-300" : "text-white"}`}>
            {max ? `${count}/${max}` : `${count} · no limit`}
            {full && <span className="ml-1 font-semibold">· full</span>}
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-slate-800 overflow-hidden"
          role="progressbar"
          aria-label={`Places filled on ${project.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={max ? `${count} of ${max} places filled` : `${count} participants, no limit`}
        >
          <div
            className={`h-full rounded-full ${full ? "bg-amber-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
            style={{ width: `${max ? percent : 0}%` }}
          />
        </div>
        {canManage && (
          <Link
            href={`/stays?project=${encodeURIComponent(project._id)}`}
            className="inline-flex items-center gap-0.5 pt-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
            aria-label={`View participants of ${project.name}`}
          >
            View participants
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}

/** Running and open projects with capacity bars. `projects` must already be filtered with stripProjects(). */
export default function ProjectsStrip({
  projects,
  failed,
  canManage,
  today,
}: {
  projects: ProjectWithStats[];
  failed: boolean;
  canManage: boolean;
  today: string;
}) {
  const shown = projects.slice(0, MAX_PROJECTS);
  const more = projects.length - shown.length;

  return (
    <section aria-labelledby="projects-strip-heading" className={`${CARD_CLASS} flex flex-col gap-4`}>
      <CardHeading
        id="projects-strip-heading"
        icon={FolderKanban}
        title="Running & Open Projects"
        count={failed ? undefined : projects.length}
        href={canManage ? "/projects" : undefined}
        linkLabel={more > 0 ? `All projects (+${more})` : "All projects"}
      />

      {failed ? (
        <CardLoadError>Projects could not be loaded.</CardLoadError>
      ) : shown.length === 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-900 bg-slate-900/20 p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-300">No projects are running or open right now.</p>
              <p className="text-xs text-slate-500">
                {canManage
                  ? "Create a project such as Malabis Share or a beach clean-up and open it for applications."
                  : "New projects will appear here when they open."}
              </p>
            </div>
          </div>
          {canManage && (
            <Link href="/projects?new=1" className={`${PRIMARY_LINK} shrink-0`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create project
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((project) => (
            <ProjectTile key={project._id} project={project} canManage={canManage} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}
