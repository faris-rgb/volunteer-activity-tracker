"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarRange,
  FolderKanban,
  FolderPlus,
  Globe,
  Handshake,
  Hourglass,
  MapPin,
  Pencil,
  PlaneLanding,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { setProjectPublicAction, type ProjectWithStats } from "@/app/actions/projects";
import { FUNDING_TYPES, PROJECT_STATUSES, type FundingType, type Partner, type ProjectStatus } from "@/lib/domain";
import { FUNDING_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/sanity/schemas/project";
import DeleteProjectDialog from "./DeleteProjectDialog";
import ProjectFormModal from "./ProjectFormModal";
import { DeletePartnerDialog, PartnerFormModal, PartnersTable } from "./PartnersPanel";
import {
  FILTER_SELECT,
  FUNDING_SHORT,
  NETWORK_ERROR,
  PRIMARY_BUTTON,
  PROJECT_STATUS_SHORT,
  PROJECT_STATUS_STYLES,
  SECONDARY_BUTTON,
  Switch,
  Toast,
  daysBetween,
  formatShortDate,
  pluralize,
  useToast,
  useTodayKey,
} from "./ui";

export type ProjectsTab = "projects" | "partners";

interface ProjectsClientProps {
  initialProjects: ProjectWithStats[];
  initialPartners: Partner[];
  loadError: string | null;
  locationSuggestions: string[];
  initialTab: ProjectsTab;
  openCreateOnLoad: boolean;
}

type StatusFilter = "all" | ProjectStatus;
type FundingFilter = "all" | "none" | FundingType;
type SortOrder = "relevance" | "start-asc" | "start-desc" | "name";

interface Filters {
  query: string;
  status: StatusFilter;
  funding: FundingFilter;
}

const STATUS_ORDER: Record<ProjectStatus, number> = {
  running: 0,
  open: 1,
  planned: 2,
  completed: 3,
  cancelled: 4,
};

const TABS: { key: ProjectsTab; label: string }[] = [
  { key: "projects", label: "Projects" },
  { key: "partners", label: "Partners" },
];

function sortPartners(partners: Partner[]): Partner[] {
  return [...partners].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

function formatDuration(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate || endDate < startDate) return null;
  const days = daysBetween(startDate, endDate) + 1;
  if (days >= 60) return pluralize(Math.round(days / 30.44), "month");
  if (days >= 14) return pluralize(Math.round(days / 7), "week");
  return pluralize(days, "day");
}

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return "Dates not set";
  if (startDate === endDate) return formatShortDate(startDate);
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}

function formatAgeRange(ageMin?: number, ageMax?: number): string | null {
  if (ageMin !== undefined && ageMax !== undefined) return ageMin === ageMax ? `Age ${ageMin}` : `Ages ${ageMin}–${ageMax}`;
  if (ageMin !== undefined) return `Ages ${ageMin}+`;
  if (ageMax !== undefined) return `Up to age ${ageMax}`;
  return null;
}

function getDeadlineInfo(
  deadline: string,
  status: ProjectStatus,
  today: string | null
): { text: string; tone: string } {
  if (status === "completed" || status === "cancelled") {
    return { text: `Applications closed (deadline ${formatShortDate(deadline)})`, tone: "text-slate-500" };
  }
  if (!today) return { text: `Apply by ${formatShortDate(deadline)}`, tone: "text-slate-400" };
  const days = daysBetween(today, deadline);
  if (days < 0) return { text: `Applications closed ${formatShortDate(deadline)}`, tone: "text-slate-500" };
  if (days === 0) return { text: "Applications close today", tone: "text-amber-300" };
  if (days === 1) return { text: "Applications close tomorrow", tone: "text-amber-300" };
  return {
    text: `Applications close in ${days} days (${formatShortDate(deadline)})`,
    tone: days <= 14 ? "text-amber-300" : "text-slate-400",
  };
}

function matchesFilters(project: ProjectWithStats, filters: Filters, partnerNames: Map<string, string>): boolean {
  if (filters.status !== "all" && project.status !== filters.status) return false;
  if (filters.funding === "none" && project.funding) return false;
  if (filters.funding !== "all" && filters.funding !== "none" && project.funding !== filters.funding) return false;
  if (!filters.query) return true;
  const haystack = [
    project.name,
    project.description,
    project.location,
    project.escProjectCode,
    ...(project.eligibleCountries ?? []),
    ...(project.partnerIds ?? []).map((id) => partnerNames.get(id)),
  ];
  return haystack.some((value) => value?.toLowerCase().includes(filters.query));
}

export default function ProjectsClient({
  initialProjects,
  initialPartners,
  loadError,
  locationSuggestions,
  initialTab,
  openCreateOnLoad,
}: ProjectsClientProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const today = useTodayKey();
  const { toast, showToast, dismissToast } = useToast();

  const [projects, setProjects] = useState<ProjectWithStats[]>(initialProjects);
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [synced, setSynced] = useState({ projects: initialProjects, partners: initialPartners });
  if (synced.projects !== initialProjects || synced.partners !== initialPartners) {
    setSynced({ projects: initialProjects, partners: initialPartners });
    if (!loadError) {
      setProjects(initialProjects);
      setPartners(initialPartners);
    }
  }

  const [tab, setTab] = useState<ProjectsTab>(initialTab);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fundingFilter, setFundingFilter] = useState<FundingFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("relevance");

  // `key` remounts the form so it starts from the right values each time it opens.
  const [projectForm, setProjectForm] = useState<{ key: number; project: ProjectWithStats | null } | null>(
    openCreateOnLoad ? { key: 0, project: null } : null
  );
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithStats | null>(null);
  const [partnerForm, setPartnerForm] = useState<{ key: number; partner: Partner | null } | null>(null);
  const [partnerDeleteTarget, setPartnerDeleteTarget] = useState<Partner | null>(null);
  const [publicPendingId, setPublicPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (openCreateOnLoad) {
      router.replace("/projects", { scroll: false });
    }
  }, [openCreateOnLoad, router]);

  const resync = () => startRefresh(() => router.refresh());

  const partnerNames = useMemo(() => new Map(partners.map((partner) => [partner._id, partner.name])), [partners]);

  const locations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const location of [...locationSuggestions, ...projects.map((project) => project.location ?? "")]) {
      const trimmed = location.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed);
    }
    return Array.from(seen.values());
  }, [locationSuggestions, projects]);

  const query = search.trim().toLowerCase();
  const filters: Filters = { query, status: statusFilter, funding: fundingFilter };
  const hasFilters = query !== "" || statusFilter !== "all" || fundingFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setFundingFilter("all");
  };

  const visibleProjects = projects
    .filter((project) => matchesFilters(project, filters, partnerNames))
    .sort((a, b) => {
      if (sortOrder === "name") return a.name.localeCompare(b.name);
      if (sortOrder === "start-desc") return b.startDate.localeCompare(a.startDate);
      if (sortOrder === "start-asc") return a.startDate.localeCompare(b.startDate);
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.startDate.localeCompare(b.startDate);
    });

  const stats = {
    all: projects.length,
    open: projects.filter((project) => project.status === "open").length,
    running: projects.filter((project) => project.status === "running").length,
    participants: projects
      .filter((project) => project.status !== "cancelled")
      .reduce((sum, project) => sum + project.participantCount, 0),
    public: projects.filter((project) => project.isPublic).length,
  };

  /* ---------- Tabs ---------- */

  const selectTab = (next: ProjectsTab) => {
    setTab(next);
    try {
      window.history.replaceState(window.history.state, "", next === "partners" ? "/projects?tab=partners" : "/projects");
    } catch {
      // URL sync is a convenience only.
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = TABS.findIndex((entry) => entry.key === tab);
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].key;
    selectTab(next);
    document.getElementById(`projects-tab-${next}`)?.focus();
  };

  /* ---------- Project handlers ---------- */

  const replaceProject = (updated: ProjectWithStats) => {
    setProjects((prev) => prev.map((project) => (project._id === updated._id ? updated : project)));
  };

  const removeProject = (projectId: string) => {
    setProjects((prev) => prev.filter((project) => project._id !== projectId));
  };

  const openCreateProject = () => setProjectForm((prev) => ({ key: (prev?.key ?? 0) + 1, project: null }));
  const openEditProject = (project: ProjectWithStats) =>
    setProjectForm((prev) => ({ key: (prev?.key ?? 0) + 1, project }));

  const handleProjectSaved = (saved: ProjectWithStats, created: boolean) => {
    if (created) {
      // The action's revalidation may already have delivered the new project in fresh server props.
      setProjects((prev) => [saved, ...prev.filter((project) => project._id !== saved._id)]);
      if (!matchesFilters(saved, filters, partnerNames)) clearFilters();
    } else {
      replaceProject(saved);
    }
    setProjectForm(null);
    showToast("success", created ? `"${saved.name}" was created.` : `"${saved.name}" was updated.`);
  };

  const handleProjectNotFound = (projectId: string, message: string) => {
    removeProject(projectId);
    setProjectForm(null);
    setDeleteTarget(null);
    showToast("error", message);
  };

  const handleTogglePublic = async (project: ProjectWithStats, isPublic: boolean) => {
    if (publicPendingId) return;
    setPublicPendingId(project._id);
    try {
      const result = await setProjectPublicAction(project._id, isPublic);
      if (!result.ok) {
        if (result.notFound) removeProject(project._id);
        else resync();
        showToast("error", result.error);
        return;
      }
      replaceProject(result.data);
      showToast(
        "success",
        isPublic ? `"${project.name}" is now shown on the Join page.` : `"${project.name}" is hidden from the Join page.`
      );
    } catch (error) {
      console.error(error);
      showToast("error", NETWORK_ERROR);
    } finally {
      setPublicPendingId(null);
    }
  };

  /* ---------- Partner handlers ---------- */

  const upsertPartner = (partner: Partner) => {
    setPartners((prev) =>
      sortPartners(prev.some((entry) => entry._id === partner._id)
        ? prev.map((entry) => (entry._id === partner._id ? partner : entry))
        : [...prev, partner])
    );
  };

  const removePartner = (partnerId: string) => {
    setPartners((prev) => prev.filter((partner) => partner._id !== partnerId));
  };

  const openCreatePartner = () => setPartnerForm((prev) => ({ key: (prev?.key ?? 0) + 1, partner: null }));

  const handlePartnerNotFound = (partnerId: string, message: string) => {
    removePartner(partnerId);
    setPartnerForm(null);
    setPartnerDeleteTarget(null);
    showToast("error", message);
  };

  const linkedProjectNames = (partnerId: string) =>
    projects.filter((project) => project.partnerIds?.includes(partnerId)).map((project) => project.name);

  /* ---------- Rendering ---------- */

  const statTiles: { key: StatusFilter; label: string; value: number; color: string; caption: string }[] = [
    { key: "all", label: "Projects", value: stats.all, color: "text-white", caption: `${stats.public} on the Join page` },
    { key: "open", label: "Open for applications", value: stats.open, color: "text-emerald-400", caption: "Accepting applicants" },
    { key: "running", label: "Running now", value: stats.running, color: "text-violet-400", caption: "Volunteers on site" },
  ];

  const renderProjectCard = (project: ProjectWithStats) => {
    const encodedId = encodeURIComponent(project._id);
    const duration = formatDuration(project.startDate, project.endDate);
    const ageRange = formatAgeRange(project.ageMin, project.ageMax);
    const deadline = project.applicationDeadline ? getDeadlineInfo(project.applicationDeadline, project.status, today) : null;
    const countries = project.eligibleCountries ?? [];
    const projectPartners = (project.partnerIds ?? [])
      .map((id) => partnerNames.get(id))
      .filter((name): name is string => !!name);
    const max = project.maxParticipants;
    const count = project.participantCount;
    const percent = max ? Math.min(100, Math.round((count / max) * 100)) : 0;
    const full = max !== undefined && count >= max;

    return (
      <article
        key={project._id}
        aria-labelledby={`project-${project._id}-name`}
        className="bg-slate-950/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-5 sm:p-6 transition-colors flex flex-col"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${PROJECT_STATUS_STYLES[project.status]}`}
              title={PROJECT_STATUS_LABELS[project.status]}
            >
              {PROJECT_STATUS_SHORT[project.status]}
            </span>
            {project.funding && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold min-w-0 ${
                  project.funding === "esc"
                    ? "text-blue-300 bg-blue-500/10 border-blue-500/20"
                    : "text-slate-300 bg-slate-900 border-slate-800"
                }`}
                title={FUNDING_TYPE_LABELS[project.funding]}
              >
                {FUNDING_SHORT[project.funding]}
                {project.escProjectCode && (
                  <span className="font-mono font-medium opacity-80 truncate max-w-[11rem]">{project.escProjectCode}</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] font-semibold ${project.isPublic ? "text-emerald-400" : "text-slate-500"}`} aria-hidden="true">
              {project.isPublic ? "Public" : "Hidden"}
            </span>
            <Switch
              size="sm"
              checked={project.isPublic}
              label={`Show ${project.name} on the public Join page`}
              pending={publicPendingId === project._id}
              disabled={publicPendingId !== null && publicPendingId !== project._id}
              onChange={(checked) => handleTogglePublic(project, checked)}
            />
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <h3 id={`project-${project._id}-name`} className="text-lg font-bold text-white tracking-tight break-words">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{project.description}</p>
          )}
        </div>

        <dl className="mt-4 space-y-2 text-xs text-slate-400">
          <div className="flex items-start gap-2">
            <dt className="sr-only">Dates</dt>
            <CalendarRange className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
            <dd>
              {formatDateRange(project.startDate, project.endDate)}
              {duration && <span className="text-slate-500"> · {duration}</span>}
            </dd>
          </div>
          {project.location && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Location</dt>
              <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <dd className="truncate">{project.location}</dd>
            </div>
          )}
          {ageRange && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Age range</dt>
              <UserRound className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <dd>{ageRange}</dd>
            </div>
          )}
          {countries.length > 0 && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Eligible countries</dt>
              <Globe className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <dd title={countries.join(", ")}>
                {countries.slice(0, 3).join(", ")}
                {countries.length > 3 && <span className="text-slate-500"> +{countries.length - 3} more</span>}
              </dd>
            </div>
          )}
          {deadline && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Application deadline</dt>
              <Hourglass className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <dd className={deadline.tone}>{deadline.text}</dd>
            </div>
          )}
          {projectPartners.length > 0 && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Partners</dt>
              <Handshake className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              <dd className="flex flex-wrap gap-1">
                {projectPartners.map((name) => (
                  <span key={name} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                    {name}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-auto pt-5">
          <div className="pt-4 border-t border-slate-900/80 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Participants</span>
                <span className={`font-bold ${full ? "text-amber-300" : "text-white"}`}>
                  {max !== undefined ? `${count}/${max}` : `${count} · no limit`}
                  {full && <span className="font-medium"> · full</span>}
                </span>
              </div>
              {max !== undefined && (
                <div
                  className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={`${count} of ${max} places taken`}
                >
                  <div
                    className={`h-full rounded-full ${full ? "bg-amber-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/stays?project=${encodedId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
                >
                  <PlaneLanding className="h-3.5 w-3.5" aria-hidden="true" />
                  View stays
                </Link>
                <Link
                  href={`/activities?project=${encodedId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  View activities
                  {project.activityCount > 0 && <span className="text-slate-500">({project.activityCount})</span>}
                </Link>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditProject(project)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                  title="Edit project"
                  aria-label={`Edit ${project.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(project)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                  title="Delete project"
                  aria-label={`Delete ${project.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FolderKanban className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" aria-hidden="true" />
            Projects
          </h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Plan ESC and local projects, link activities and volunteer stays, and keep your partners in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={tab === "projects" ? openCreateProject : openCreatePartner}
          className={PRIMARY_BUTTON}
        >
          <Plus className="h-4 w-4" />
          {tab === "projects" ? "New Project" : "Add Partner"}
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl px-4 py-3 text-sm"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{loadError}</span>
          </span>
          <button
            type="button"
            onClick={resync}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 hover:bg-rose-500/10 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Projects and partners" className="inline-flex bg-slate-950/60 border border-slate-900 rounded-xl p-1">
        {TABS.map((entry) => {
          const selected = tab === entry.key;
          const count = entry.key === "projects" ? projects.length : partners.length;
          return (
            <button
              key={entry.key}
              id={`projects-tab-${entry.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`projects-panel-${entry.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(entry.key)}
              onKeyDown={handleTabKeyDown}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                selected ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              {entry.key === "projects" ? (
                <FolderKanban className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Handshake className="h-4 w-4" aria-hidden="true" />
              )}
              {entry.label}
              <span
                className={`text-[11px] px-1.5 rounded-md ${selected ? "bg-slate-950/20" : "bg-slate-900 text-slate-500"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "projects" ? (
        <div id="projects-panel-projects" role="tabpanel" aria-labelledby="projects-tab-projects" className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {statTiles.map((tile) => {
              const selected = projects.length > 0 && statusFilter === tile.key;
              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => setStatusFilter(tile.key)}
                  disabled={projects.length === 0}
                  aria-pressed={selected}
                  title={projects.length > 0 ? `Show ${tile.key === "all" ? "all" : tile.label.toLowerCase()} projects` : undefined}
                  className={`text-left bg-slate-950/40 border rounded-xl p-4 transition-colors disabled:cursor-default ${
                    selected ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : "border-slate-900 enabled:hover:border-slate-800"
                  }`}
                >
                  <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">{tile.label}</span>
                  <span className={`text-2xl font-bold block mt-1 ${tile.color}`}>{tile.value}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">{tile.caption}</span>
                </button>
              );
            })}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Participants</span>
              <span className="text-2xl font-bold block mt-1 text-amber-400">{stats.participants}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">Linked volunteer stays</span>
            </div>
          </div>

          {projects.length > 0 && (
            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, place, partner, ESC code..."
                  aria-label="Search projects"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  aria-label="Filter by status"
                  className={FILTER_SELECT}
                >
                  <option value="all">All statuses</option>
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PROJECT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
                <select
                  value={fundingFilter}
                  onChange={(event) => setFundingFilter(event.target.value as FundingFilter)}
                  aria-label="Filter by funding"
                  className={FILTER_SELECT}
                >
                  <option value="all">All funding</option>
                  {FUNDING_TYPES.map((funding) => (
                    <option key={funding} value={funding}>
                      {FUNDING_TYPE_LABELS[funding]}
                    </option>
                  ))}
                  <option value="none">Funding not set</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                  aria-label="Sort projects"
                  className={FILTER_SELECT}
                >
                  <option value="relevance">Running & open first</option>
                  <option value="start-asc">Start date: earliest</option>
                  <option value="start-desc">Start date: latest</option>
                  <option value="name">Name: A–Z</option>
                </select>
              </div>
            </div>
          )}

          {projects.length === 0 ? (
            !loadError && (
              <div className="py-16 px-6 border border-dashed border-slate-800 bg-slate-950/20 rounded-2xl text-center">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                  <FolderPlus className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">No projects yet</h3>
                <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
                  Create a project, such as Malabis Share, Soccer4All or an ESC volunteering placement, then link
                  activities and volunteer stays to it. Public projects appear on the Join page.
                </p>
                <button type="button" onClick={openCreateProject} className={`mt-6 inline-flex ${PRIMARY_BUTTON}`}>
                  <Plus className="h-4 w-4" />
                  Create First Project
                </button>
              </div>
            )
          ) : visibleProjects.length === 0 ? (
            <div className="py-12 border border-slate-900 bg-slate-950/20 rounded-2xl text-center text-slate-500 text-sm space-y-3">
              <p>No projects match your search or filters.</p>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className={SECONDARY_BUTTON}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {visibleProjects.map(renderProjectCard)}
            </div>
          )}
        </div>
      ) : (
        <div id="projects-panel-partners" role="tabpanel" aria-labelledby="projects-tab-partners">
          <PartnersTable
            partners={partners}
            projects={projects}
            onCreate={openCreatePartner}
            onEdit={(partner) => setPartnerForm((prev) => ({ key: (prev?.key ?? 0) + 1, partner }))}
            onDelete={setPartnerDeleteTarget}
          />
        </div>
      )}

      {projectForm && (
        <ProjectFormModal
          key={projectForm.key}
          project={projectForm.project}
          partners={partners}
          locations={locations}
          onClose={() => setProjectForm(null)}
          onSaved={handleProjectSaved}
          onNotFound={handleProjectNotFound}
          onPartnerCreated={(partner) => {
            upsertPartner(partner);
            showToast("success", `Partner "${partner.name}" was added.`);
          }}
          onResync={resync}
        />
      )}

      {deleteTarget && (
        <DeleteProjectDialog
          key={deleteTarget._id}
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(projectId) => {
            removeProject(projectId);
            setDeleteTarget(null);
            showToast("success", `"${deleteTarget.name}" was deleted.`);
          }}
          onCancelled={(updated) => {
            replaceProject(updated);
            setDeleteTarget(null);
            showToast("success", `"${updated.name}" is now marked as cancelled.`);
          }}
          onNotFound={handleProjectNotFound}
          onResync={resync}
        />
      )}

      {partnerForm && (
        <PartnerFormModal
          key={partnerForm.key}
          partner={partnerForm.partner}
          onClose={() => setPartnerForm(null)}
          onSaved={(partner, created) => {
            upsertPartner(partner);
            setPartnerForm(null);
            showToast("success", created ? `Partner "${partner.name}" was added.` : `"${partner.name}" was updated.`);
          }}
          onNotFound={handlePartnerNotFound}
          onResync={resync}
        />
      )}

      {partnerDeleteTarget && (
        <DeletePartnerDialog
          key={partnerDeleteTarget._id}
          partner={partnerDeleteTarget}
          linkedProjects={linkedProjectNames(partnerDeleteTarget._id)}
          onClose={() => setPartnerDeleteTarget(null)}
          onDeleted={(partnerId) => {
            removePartner(partnerId);
            setPartnerDeleteTarget(null);
            showToast("success", `"${partnerDeleteTarget.name}" was deleted.`);
          }}
          onNotFound={handlePartnerNotFound}
          onResync={resync}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
