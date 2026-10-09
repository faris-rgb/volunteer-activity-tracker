"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarPlus,
  ChartNoAxesColumn,
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock,
  FolderKanban,
  LayoutGrid,
  List,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
  Tag,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  createActivityAction,
  createActivitySeriesAction,
  deleteActivityAction,
  updateActivityAction,
  updateActivityStatusAction,
  type ActivityData,
  type ActivityInput,
  type ActivityStatus,
} from "@/app/actions/activities";
import { formatLocalDate, formatTime, getActivityDateTime } from "@/lib/dates";
import { ACTIVITY_MAX_WEEKLY_REPEATS } from "@/sanity/schemas/activity";
import {
  addDaysToDateKey,
  OPEN_PROJECT_STATUSES,
  PROJECT_FILTER_ALL,
  PROJECT_FILTER_NONE,
  totalImpact,
  type ActivityProjectOption,
  type ProjectFilter,
} from "./activityShared";
import ImpactChips from "./components/ImpactChips";
import ImpactEditor, {
  addImpactRow,
  impactInputId,
  impactToRows,
  parseImpactRows,
  type ImpactRow,
} from "./components/ImpactEditor";
import PresetField from "./components/PresetField";

interface ActivitiesClientProps {
  initialActivities: ActivityData[];
  loadError: string | null;
  canManage: boolean;
  openCreateOnLoad: boolean;
  /** Projects for the form select, the filter and badges (may be empty). */
  projects: ActivityProjectOption[];
  /** Category presets from portal settings. */
  categoryOptions: string[];
  /** Location presets from portal settings. */
  locationOptions: string[];
  /** From ?project= : a project id, "none", or null for all projects. */
  initialProjectFilter: string | null;
}

type StatusFilter = "All" | ActivityStatus;
type SortOrder = "date-asc" | "date-desc" | "title";

interface FormState {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  /** True while the location is free text instead of a preset. */
  locationOther: boolean;
  category: string;
  /** True while the category is free text ("Other…") instead of a preset. */
  categoryOther: boolean;
  maxVolunteers: string;
  status: ActivityStatus;
  /** "" = no project. */
  projectId: string;
  impact: ImpactRow[];
  /** Create only: create a weekly series. */
  repeatWeekly: boolean;
  repeatWeeks: string;
}

type FormField = keyof FormState;

interface Filters {
  query: string;
  status: StatusFilter;
  category: string;
  project: ProjectFilter;
}

interface FormError {
  field: FormField | null;
  message: string;
  /** Element to focus instead of `activity-<field>`. */
  focusId?: string;
  /** Invalid impact row. */
  impactIndex?: number;
}

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
}

const STATUSES: ActivityStatus[] = ["Upcoming", "Active", "Completed"];

const STATUS_STYLES: Record<ActivityStatus, string> = {
  Upcoming: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Completed: "text-slate-400 bg-slate-800 border-slate-700/50",
};

const STATUS_TEXT: Record<ActivityStatus, string> = {
  Upcoming: "text-amber-400",
  Active: "text-emerald-400",
  Completed: "text-slate-400",
};

const DEFAULT_REPEAT_WEEKS = "4";

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  date: "",
  startTime: "09:00",
  endTime: "12:00",
  location: "",
  locationOther: false,
  category: "",
  categoryOther: false,
  maxVolunteers: "10",
  status: "Upcoming",
  projectId: "",
  impact: [],
  repeatWeekly: false,
  repeatWeeks: DEFAULT_REPEAT_WEEKS,
};

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

/** Fixed collation locale, so lists sorted on the server and in the browser match (no hydration mismatch). */
const SORT_LOCALE = "en";

const INPUT_BASE =
  "w-full bg-slate-950 border rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark] disabled:opacity-60";

const LABEL_CLASS = "text-xs font-semibold text-slate-400 uppercase tracking-wider block";

const TOOLBAR_SELECT_CLASS =
  "bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50";

function controlClass(invalid: boolean, extra = "px-4 py-2 text-white"): string {
  return `${INPUT_BASE} ${extra} ${invalid ? "border-rose-500/60" : "border-slate-800"}`;
}

function formatTimeRange(activity: ActivityData): string {
  if (!activity.startTime) return "Time not set";
  if (!activity.endTime) return formatTime(activity.startTime);
  return `${formatTime(activity.startTime)} – ${formatTime(activity.endTime)}`;
}

function formatDate(date: string): string {
  return date ? formatLocalDate(date, { month: "short", day: "numeric", year: "numeric" }) : "No date";
}

function formatShortDate(date: string): string {
  return formatLocalDate(date, { month: "short", day: "numeric" });
}

function getStartTimestamp(activity: ActivityData): number {
  return getActivityDateTime(activity.date, activity.startTime)?.getTime() ?? 0;
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function countActivities(count: number): string {
  return `${count} ${count === 1 ? "activity" : "activities"}`;
}

/** A blank form, optionally preselecting a project (and its location). */
function createEmptyForm(project: ActivityProjectOption | undefined, locationOptions: string[]): FormState {
  const location = project?.location?.trim() ?? "";
  return {
    ...EMPTY_FORM,
    projectId: project?._id ?? "",
    location,
    locationOther: location !== "" && !locationOptions.includes(location),
  };
}

function toFormState(activity: ActivityData, categoryOptions: string[], locationOptions: string[]): FormState {
  return {
    ...EMPTY_FORM,
    title: activity.title,
    description: activity.description ?? "",
    date: activity.date,
    startTime: /^\d{2}:\d{2}$/.test(activity.startTime) ? activity.startTime : "",
    endTime: /^\d{2}:\d{2}$/.test(activity.endTime) ? activity.endTime : "",
    location: activity.location,
    locationOther: activity.location !== "" && !locationOptions.includes(activity.location),
    category: activity.category,
    categoryOther: activity.category !== "" && !categoryOptions.includes(activity.category),
    maxVolunteers: String(activity.maxVolunteers || ""),
    status: activity.status,
    projectId: activity.projectId ?? "",
    impact: impactToRows(activity.impact),
  };
}

/** Number of weekly occurrences the form asks for, or null when the value is invalid. */
function parseRepeatWeeks(form: FormState): number | null {
  if (!form.repeatWeekly) return 1;
  const weeks = Number(form.repeatWeeks);
  return form.repeatWeeks.trim() !== "" && Number.isInteger(weeks) && weeks >= 1 && weeks <= ACTIVITY_MAX_WEEKLY_REPEATS
    ? weeks
    : null;
}

function validateForm(form: FormState, editing: ActivityData | null): FormError | null {
  if (!form.title.trim()) return { field: "title", message: "Title is required." };
  if (!form.date) return { field: "date", message: "Date is required." };
  if (!form.startTime) return { field: "startTime", message: "Start time is required." };
  if (!form.endTime) return { field: "endTime", message: "End time is required." };
  if (form.endTime <= form.startTime) return { field: "endTime", message: "End time must be after the start time." };
  if (!editing && parseRepeatWeeks(form) === null) {
    return {
      field: "repeatWeeks",
      message: `Repeat weekly must be a whole number of weeks between 1 and ${ACTIVITY_MAX_WEEKLY_REPEATS}.`,
    };
  }
  if (!form.location.trim()) return { field: "location", message: "Location is required." };
  if (!form.category.trim()) return { field: "category", message: "Category is required." };

  const capacity = Number(form.maxVolunteers);
  if (!form.maxVolunteers || !Number.isInteger(capacity) || capacity < 1) {
    return { field: "maxVolunteers", message: "Maximum volunteers must be a whole number of at least 1." };
  }
  if (capacity > 10000) {
    return { field: "maxVolunteers", message: "Maximum volunteers cannot exceed 10,000." };
  }
  const checkedIn = editing?.spotsFilled ?? 0;
  if (editing && capacity !== editing.maxVolunteers && capacity < checkedIn) {
    return {
      field: "maxVolunteers",
      message: `Capacity can't be lower than the ${pluralize(checkedIn, "volunteer")} already checked in.`,
    };
  }

  const impact = parseImpactRows(form.impact);
  if (!impact.ok) {
    return { field: "impact", message: impact.message, focusId: impactInputId(impact.index), impactIndex: impact.index };
  }
  return null;
}

function matchesFilters(activity: ActivityData, { query, status, category, project }: Filters): boolean {
  if (status !== "All" && activity.status !== status) return false;
  if (category !== "All" && activity.category !== category) return false;
  if (project === PROJECT_FILTER_NONE && activity.projectId) return false;
  if (project !== PROJECT_FILTER_ALL && project !== PROJECT_FILTER_NONE && activity.projectId !== project) return false;
  if (!query) return true;
  return [activity.title, activity.description, activity.location, activity.category, activity.projectName].some((value) =>
    value?.toLowerCase().includes(query)
  );
}

/** Mirrors the project filter in the URL (?project=) without a server round trip. */
function syncProjectParam(value: ProjectFilter) {
  const url = new URL(window.location.href);
  if (value === PROJECT_FILTER_ALL) {
    url.searchParams.delete("project");
  } else {
    url.searchParams.set("project", value);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function ActivitiesClient({
  initialActivities,
  loadError,
  canManage,
  openCreateOnLoad,
  projects,
  categoryOptions,
  locationOptions,
  initialProjectFilter,
}: ActivitiesClientProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  const [activities, setActivities] = useState<ActivityData[]>(initialActivities);
  const [syncedActivities, setSyncedActivities] = useState(initialActivities);
  if (initialActivities !== syncedActivities) {
    setSyncedActivities(initialActivities);
    if (!loadError) {
      setActivities(initialActivities);
    }
  }

  const projectsById = useMemo(() => new Map(projects.map((project) => [project._id, project])), [projects]);

  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [projectFilter, setProjectFilterState] = useState<ProjectFilter>(initialProjectFilter ?? PROJECT_FILTER_ALL);
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-asc");

  const [syncedProjectParam, setSyncedProjectParam] = useState(initialProjectFilter);
  if (initialProjectFilter !== syncedProjectParam) {
    setSyncedProjectParam(initialProjectFilter);
    setProjectFilterState(initialProjectFilter ?? PROJECT_FILTER_ALL);
  }

  const [formOpen, setFormOpen] = useState(openCreateOnLoad);
  const [editing, setEditing] = useState<ActivityData | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    openCreateOnLoad
      ? createEmptyForm(projects.find((project) => project._id === initialProjectFilter), locationOptions)
      : EMPTY_FORM
  );
  const [formError, setFormError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);
  const focusOnOpenRef = useRef<string | null>(null);

  const [syncedOpenCreate, setSyncedOpenCreate] = useState(openCreateOnLoad);
  if (openCreateOnLoad !== syncedOpenCreate) {
    setSyncedOpenCreate(openCreateOnLoad);
    if (openCreateOnLoad && !formOpen) {
      setEditing(null);
      setForm(createEmptyForm(projects.find((project) => project._id === initialProjectFilter), locationOptions));
      setFormError(null);
      setFormOpen(true);
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<ActivityData | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (openCreateOnLoad) {
      const query = initialProjectFilter ? `?project=${encodeURIComponent(initialProjectFilter)}` : "";
      router.replace(`/activities${query}`, { scroll: false });
    }
  }, [openCreateOnLoad, initialProjectFilter, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!formOpen && !deleteTarget) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving || deleting) return;
      setFormOpen(false);
      setDeleteTarget(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formOpen, deleteTarget, saving, deleting]);

  // "Log impact" opens the form scrolled to the impact section.
  useEffect(() => {
    if (!formOpen || !focusOnOpenRef.current) return;
    const element = document.getElementById(focusOnOpenRef.current);
    focusOnOpenRef.current = null;
    element?.focus();
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [formOpen]);

  const categories = useMemo(
    () =>
      Array.from(new Set(activities.map((activity) => activity.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, SORT_LOCALE)
      ),
    [activities]
  );
  const activeCategory = categories.includes(categoryFilter) ? categoryFilter : "All";

  const projectName = (activity: ActivityData): string | null => {
    if (!activity.projectId) return null;
    return projectsById.get(activity.projectId)?.name ?? activity.projectName ?? "Unknown project";
  };

  /** Filter options: every known project plus projects only seen on activities, with activity counts. */
  const projectFilterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    const names = new Map<string, string>(projects.map((project) => [project._id, project.name]));
    for (const activity of activities) {
      if (!activity.projectId) continue;
      counts.set(activity.projectId, (counts.get(activity.projectId) ?? 0) + 1);
      if (!names.has(activity.projectId)) {
        names.set(activity.projectId, activity.projectName ?? "Unknown project");
      }
    }
    if (projectFilter !== PROJECT_FILTER_ALL && projectFilter !== PROJECT_FILTER_NONE && !names.has(projectFilter)) {
      names.set(projectFilter, "Unknown project");
    }
    return Array.from(names, ([id, name]) => ({ id, name, count: counts.get(id) ?? 0 })).sort((a, b) =>
      a.name.localeCompare(b.name, SORT_LOCALE)
    );
  }, [projects, activities, projectFilter]);
  const unassignedCount = useMemo(() => activities.filter((activity) => !activity.projectId).length, [activities]);
  const filteredProject = projectsById.get(projectFilter);

  const query = search.trim().toLowerCase();

  const setProjectFilter = (value: ProjectFilter) => {
    setProjectFilterState(value);
    syncProjectParam(value);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setCategoryFilter("All");
    if (projectFilter !== PROJECT_FILTER_ALL) {
      setProjectFilter(PROJECT_FILTER_ALL);
    }
  };

  const showToast = (kind: Toast["kind"], message: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, kind, message }));
  };

  const replaceActivity = (updated: ActivityData) => {
    setActivities((prev) => prev.map((activity) => (activity._id === updated._id ? updated : activity)));
  };

  const removeActivity = (id: string) => {
    setActivities((prev) => prev.filter((activity) => activity._id !== id));
  };

  const resync = () => startRefresh(() => router.refresh());

  /** Applies a form change and clears the error shown for any of `fields`. */
  const patchForm = (patch: Partial<FormState>, fields: FormField[]) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (formError?.field && fields.includes(formError.field)) {
      setFormError(null);
    }
  };

  const updateField = <K extends FormField>(field: K, value: FormState[K]) => {
    patchForm({ [field]: value } as Partial<FormState>, [field]);
  };

  /** Choosing a project defaults the location to the project's location (unless the user already picked another one). */
  const handleProjectChange = (projectId: string) => {
    const previous = projectsById.get(form.projectId);
    const next = projectsById.get(projectId);
    const nextLocation = next?.location?.trim() ?? "";
    const currentLocation = form.location.trim();
    const replaceLocation =
      nextLocation !== "" && (currentLocation === "" || currentLocation === (previous?.location?.trim() ?? ""));
    patchForm(
      replaceLocation
        ? { projectId, location: nextLocation, locationOther: !locationOptions.includes(nextLocation) }
        : { projectId },
      replaceLocation ? ["projectId", "location"] : ["projectId"]
    );
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm(createEmptyForm(filteredProject, locationOptions));
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (activity: ActivityData, options?: { focusImpact?: boolean }) => {
    const next = toFormState(activity, categoryOptions, locationOptions);
    if (options?.focusImpact) {
      if (next.impact.length === 0) {
        next.impact = addImpactRow(next.impact);
      }
      focusOnOpenRef.current = impactInputId(next.impact.length - 1);
    }
    setEditing(activity);
    setForm(next);
    setFormError(null);
    setFormOpen(true);
  };

  const closeFormModal = () => {
    if (saving) return;
    setFormOpen(false);
  };

  const openDeleteModal = (activity: ActivityData) => {
    setDeleteTarget(activity);
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const currentFilters = (): Filters => ({ query, status: statusFilter, category: activeCategory, project: projectFilter });

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const current = editing ? (activities.find((activity) => activity._id === editing._id) ?? editing) : null;
    const validationError = validateForm(form, current);
    if (validationError) {
      setFormError(validationError);
      const focusId = validationError.focusId ?? (validationError.field ? `activity-${validationError.field}` : null);
      if (focusId) {
        document.getElementById(focusId)?.focus();
      }
      return;
    }

    const impact = parseImpactRows(form.impact);
    const payload: ActivityInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim(),
      category: form.category.trim(),
      maxVolunteers: Number(form.maxVolunteers),
      status: form.status,
      projectId: form.projectId || undefined,
      impact: impact.ok ? impact.impact : [],
    };
    const weeks = editing ? 1 : (parseRepeatWeeks(form) ?? 1);

    setSaving(true);
    setFormError(null);
    try {
      if (editing?._id) {
        const result = await updateActivityAction(editing._id, payload);
        if (!result.ok) {
          if (result.notFound) {
            removeActivity(editing._id);
            setFormOpen(false);
            showToast("error", result.error);
            return;
          }
          setFormError({ field: null, message: result.error });
          resync();
          return;
        }
        replaceActivity(result.data);
        setFormOpen(false);
        showToast("success", `"${result.data.title}" was updated.`);
        return;
      }

      const result =
        weeks > 1 ? await createActivitySeriesAction(payload, weeks) : await createActivityAction(payload);
      if (!result.ok) {
        setFormError({ field: null, message: result.error });
        resync();
        return;
      }
      const created = Array.isArray(result.data) ? result.data : [result.data];
      setActivities((prev) => [...prev, ...created]);
      const filters = currentFilters();
      if (created.some((activity) => !matchesFilters(activity, filters))) {
        clearFilters();
      }
      setFormOpen(false);
      const first = created[0];
      const last = created[created.length - 1];
      showToast(
        "success",
        created.length > 1
          ? `${created.length} weekly "${first.title}" activities were scheduled (${formatShortDate(first.date)} – ${formatDate(last.date)}).`
          : `"${first.title}" was scheduled.`
      );
    } catch (error) {
      console.error(error);
      setFormError({ field: null, message: NETWORK_ERROR });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id || deleting) return;
    const target = deleteTarget;
    const targetId = deleteTarget._id;

    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteActivityAction(targetId, target.attendanceCount ?? 0);
      if (!result.ok) {
        if (result.notFound) {
          removeActivity(targetId);
          setDeleteTarget(null);
          showToast("success", `"${target.title}" was already deleted.`);
          return;
        }
        if (result.attendanceCount !== undefined) {
          const refreshed = { ...target, attendanceCount: result.attendanceCount };
          setDeleteTarget(refreshed);
          replaceActivity(refreshed);
        }
        setDeleteError(result.error);
        resync();
        return;
      }
      removeActivity(targetId);
      setDeleteTarget(null);
      const removedRecords = result.data.deletedAttendance;
      showToast(
        "success",
        removedRecords > 0
          ? `"${target.title}" and ${pluralize(removedRecords, "attendance record")} were deleted.`
          : `"${target.title}" was deleted.`
      );
    } catch (error) {
      console.error(error);
      setDeleteError(NETWORK_ERROR);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (activity: ActivityData, nextStatus: ActivityStatus) => {
    if (!activity._id || nextStatus === activity.status || statusPendingId) return;

    setStatusPendingId(activity._id);
    try {
      const result = await updateActivityStatusAction(activity._id, nextStatus);
      if (!result.ok) {
        if (result.notFound) {
          removeActivity(activity._id);
        } else {
          resync();
        }
        showToast("error", result.error);
        return;
      }
      replaceActivity(result.data);
      showToast("success", `"${activity.title}" is now ${nextStatus}.`);
    } catch (error) {
      console.error(error);
      showToast("error", NETWORK_ERROR);
    } finally {
      setStatusPendingId(null);
    }
  };

  const visibleActivities = useMemo(() => {
    const filters: Filters = { query, status: statusFilter, category: activeCategory, project: projectFilter };
    const result = activities.filter((activity) => matchesFilters(activity, filters));
    result.sort((a, b) => {
      if (sortOrder === "title") return a.title.localeCompare(b.title, SORT_LOCALE);
      const diff = getStartTimestamp(a) - getStartTimestamp(b);
      return sortOrder === "date-asc" ? diff : -diff;
    });
    return result;
  }, [activities, query, statusFilter, activeCategory, projectFilter, sortOrder]);

  const visibleImpact = useMemo(
    () => totalImpact(visibleActivities.map((activity) => activity.impact)),
    [visibleActivities]
  );

  const stats = useMemo(
    () => ({
      All: activities.length,
      Upcoming: activities.filter((activity) => activity.status === "Upcoming").length,
      Active: activities.filter((activity) => activity.status === "Active").length,
      Completed: activities.filter((activity) => activity.status === "Completed").length,
    }),
    [activities]
  );

  const hasFilters =
    query !== "" || statusFilter !== "All" || activeCategory !== "All" || projectFilter !== PROJECT_FILTER_ALL;

  const statTiles: { key: StatusFilter; label: string; color: string }[] = [
    { key: "All", label: "Total Activities", color: "text-white" },
    { key: "Upcoming", label: "Upcoming", color: "text-amber-400" },
    { key: "Active", label: "Active", color: "text-emerald-400" },
    { key: "Completed", label: "Completed", color: "text-purple-400" },
  ];

  /* ---------- Form-derived values ---------- */

  const selectedProject = projectsById.get(form.projectId);
  const openProjects = projects.filter((project) => OPEN_PROJECT_STATUSES.includes(project.status));
  const pastProjects = projects.filter((project) => !OPEN_PROJECT_STATUSES.includes(project.status));
  const missingProjectOption =
    form.projectId && !selectedProject
      ? { id: form.projectId, name: editing?.projectId === form.projectId ? (editing.projectName ?? "Unknown project") : "Unknown project" }
      : null;

  const repeatWeeks = editing ? 1 : parseRepeatWeeks(form);
  const seriesDates =
    !editing && form.repeatWeekly && repeatWeeks && form.date
      ? Array.from({ length: repeatWeeks }, (_, index) => addDaysToDateKey(form.date, index * 7)).filter(Boolean)
      : [];
  const lastFormDate = seriesDates.length > 0 ? seriesDates[seriesDates.length - 1] : form.date;
  const projectPeriod =
    selectedProject?.startDate && selectedProject?.endDate
      ? `${formatDate(selectedProject.startDate)} – ${formatDate(selectedProject.endDate)}`
      : null;
  const outsideProjectPeriod =
    !!selectedProject?.startDate &&
    !!selectedProject?.endDate &&
    !!form.date &&
    (form.date < selectedProject.startDate || lastFormDate > selectedProject.endDate);

  /* ---------- Render helpers ---------- */

  const renderStatus = (activity: ActivityData, size: "sm" | "md") => {
    const sizeClass = size === "sm" ? "text-[10px] py-0.5" : "text-xs py-1";
    if (!canManage || !activity._id) {
      return (
        <span className={`inline-flex items-center px-2 rounded border font-bold ${sizeClass} ${STATUS_STYLES[activity.status]}`}>
          {activity.status}
        </span>
      );
    }

    const pending = statusPendingId === activity._id;
    return (
      <div className={`relative inline-flex items-center ${STATUS_TEXT[activity.status]}`}>
        <select
          aria-label={`Change status of ${activity.title}`}
          title="Change status"
          value={activity.status}
          disabled={statusPendingId !== null}
          onChange={(event) => handleStatusChange(activity, event.target.value as ActivityStatus)}
          className={`appearance-none cursor-pointer pl-2 pr-6 rounded border font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:cursor-wait disabled:opacity-60 ${sizeClass} ${STATUS_STYLES[activity.status]}`}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status} className="bg-slate-900 text-slate-200">
              {status}
            </option>
          ))}
        </select>
        {pending ? (
          <LoaderCircle className="absolute right-1.5 h-3 w-3 animate-spin pointer-events-none" />
        ) : (
          <ChevronDown className="absolute right-1.5 h-3 w-3 pointer-events-none opacity-70" />
        )}
      </div>
    );
  };

  const renderProjectBadge = (activity: ActivityData) => {
    const name = projectName(activity);
    if (!name || !activity.projectId) return null;
    const projectId = activity.projectId;
    const active = projectFilter === projectId;
    return (
      <button
        type="button"
        onClick={() => setProjectFilter(active ? PROJECT_FILTER_ALL : projectId)}
        aria-pressed={active}
        title={active ? "Show all projects" : `Show only ${name} activities`}
        className={`inline-flex max-w-full items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
          active
            ? "bg-sky-500/20 border-sky-400/40 text-sky-200"
            : "bg-sky-500/10 border-sky-500/20 text-sky-300 hover:bg-sky-500/20"
        }`}
      >
        <FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{name}</span>
      </button>
    );
  };

  const renderRowActions = (activity: ActivityData) => (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => openEditModal(activity, { focusImpact: true })}
        className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-900 transition-colors"
        title={activity.impact?.length ? "Update impact" : "Log impact"}
        aria-label={`${activity.impact?.length ? "Update" : "Log"} impact for ${activity.title}`}
      >
        <ChartNoAxesColumn className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => openEditModal(activity)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
        title="Edit activity"
        aria-label={`Edit ${activity.title}`}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => openDeleteModal(activity)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
        title="Delete activity"
        aria-label={`Delete ${activity.title}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const fieldClass = (field: FormField, extra?: string) => controlClass(formError?.field === field, extra);

  const deleteRecordCount = deleteTarget?.attendanceCount ?? 0;
  const showProjectFilter = projectFilterOptions.length > 0 || projectFilter !== PROJECT_FILTER_ALL;

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Calendar className="h-8 w-8 text-emerald-400" />
            Activities & Campaigns
          </h1>
          <p className="text-slate-400 mt-1">
            {canManage
              ? "Schedule activities, link them to projects and log their impact."
              : "Browse upcoming and ongoing volunteering activities."}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Add Activity
          </button>
        )}
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
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 hover:bg-rose-500/10 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statTiles.map((tile) => {
          const selected = activities.length > 0 && statusFilter === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setStatusFilter(tile.key)}
              disabled={activities.length === 0}
              aria-pressed={selected}
              title={activities.length > 0 ? `Show ${tile.key === "All" ? "all" : tile.label.toLowerCase()} activities` : undefined}
              className={`text-left bg-slate-950/40 border rounded-xl p-4 transition-colors disabled:cursor-default ${
                selected ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : "border-slate-900 enabled:hover:border-slate-800"
              }`}
            >
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">{tile.label}</span>
              <span className={`text-2xl font-bold block mt-1 ${tile.color}`}>{stats[tile.key]}</span>
            </button>
          );
        })}
      </div>

      {activities.length > 0 && (
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, location, category, project..."
              aria-label="Search activities"
              className="w-full pl-11 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 w-full lg:w-auto sm:justify-end">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              aria-label="Filter by status"
              className={`${TOOLBAR_SELECT_CLASS} sm:min-w-[130px]`}
            >
              <option value="All">All Statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {showProjectFilter && (
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                aria-label="Filter by project"
                className={`${TOOLBAR_SELECT_CLASS} sm:min-w-[150px] sm:max-w-[220px]`}
              >
                <option value={PROJECT_FILTER_ALL}>All Projects</option>
                {projectFilterOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.count})
                  </option>
                ))}
                <option value={PROJECT_FILTER_NONE}>No project ({unassignedCount})</option>
              </select>
            )}

            <select
              value={activeCategory}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
              className={`${TOOLBAR_SELECT_CLASS} sm:min-w-[140px] sm:max-w-[220px]`}
            >
              <option value="All">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              aria-label="Sort activities"
              className={`${TOOLBAR_SELECT_CLASS} sm:min-w-[155px]`}
            >
              <option value="date-asc">Date: Earliest first</option>
              <option value="date-desc">Date: Latest first</option>
              <option value="title">Title: A–Z</option>
            </select>

            <div
              className="bg-slate-900 border border-slate-800 rounded-xl p-0.5 flex items-center justify-self-start"
              role="group"
              aria-label="Layout"
            >
              <button
                type="button"
                onClick={() => setViewMode("card")}
                aria-pressed={viewMode === "card"}
                aria-label="Card grid view"
                className={`p-2 rounded-lg transition-colors ${viewMode === "card" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                title="Card grid view"
              >
                <LayoutGrid className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-pressed={viewMode === "table"}
                aria-label="Table view"
                className={`p-2 rounded-lg transition-colors ${viewMode === "table" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                title="Table view"
              >
                <List className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activities.length > 0 && visibleImpact.length > 0 && (
        <section
          aria-label="Impact summary"
          className="flex flex-col sm:flex-row sm:items-center gap-3 bg-teal-500/5 border border-teal-500/15 rounded-2xl px-4 py-3"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-300 uppercase tracking-wider shrink-0">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {filteredProject ? `${filteredProject.name} impact` : hasFilters ? "Impact of shown activities" : "Impact logged"}
          </span>
          <ImpactChips impact={visibleImpact} size="md" />
        </section>
      )}

      {activities.length === 0 ? (
        !loadError && (
          <div className="py-16 px-6 border border-dashed border-slate-800 bg-slate-950/20 rounded-2xl text-center">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
              <CalendarPlus className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">No activities yet</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              {canManage
                ? "Schedule your first activity, such as a beach clean-up or a Malabis Share distribution, to start tracking capacity, attendance and impact."
                : "No volunteering activities have been scheduled yet. Check back soon."}
            </p>
            {canManage && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {filteredProject ? `Schedule First ${filteredProject.name} Activity` : "Schedule First Activity"}
                </button>
                {projects.length === 0 && (
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:bg-slate-900 transition-colors"
                  >
                    <FolderKanban className="h-4 w-4" />
                    Set up projects
                  </Link>
                )}
              </div>
            )}
          </div>
        )
      ) : visibleActivities.length === 0 ? (
        <div className="py-12 px-6 border border-slate-900 bg-slate-950/20 rounded-2xl text-center text-slate-500 text-sm space-y-3">
          <p>
            {filteredProject && !query && statusFilter === "All" && activeCategory === "All"
              ? `No activities are linked to ${filteredProject.name} yet.`
              : "No activities match your search or filters."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {canManage && filteredProject && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add activity to {filteredProject.name}
              </button>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:bg-slate-900 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleActivities.map((activity) => {
            const spotsFilled = activity.spotsFilled ?? 0;
            const percent =
              activity.maxVolunteers > 0 ? Math.min(100, Math.round((spotsFilled / activity.maxVolunteers) * 100)) : 0;
            return (
              <div
                key={activity._id}
                className="bg-slate-950/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md min-w-0">
                      <Tag className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{activity.category || "Uncategorized"}</span>
                    </span>
                    {renderStatus(activity, "sm")}
                  </div>

                  <div className="space-y-1.5">
                    {renderProjectBadge(activity)}
                    <h3 className="text-lg font-bold text-white tracking-tight">{activity.title}</h3>
                    {activity.description && (
                      <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{activity.description}</p>
                    )}
                  </div>

                  <div className="space-y-2 pt-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{activity.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span>{formatDate(activity.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span>{formatTimeRange(activity)}</span>
                    </div>
                  </div>

                  <ImpactChips impact={activity.impact} />
                </div>

                <div className="mt-6 pt-5 border-t border-slate-900/80 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Checked In</span>
                      <span className="text-white font-bold">
                        {spotsFilled}/{activity.maxVolunteers}
                      </span>
                    </div>
                    <div
                      className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                      aria-label={`${spotsFilled} of ${activity.maxVolunteers} volunteers checked in`}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {canManage && renderRowActions(activity)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20">
                  <th className="py-4 px-6">Campaign / Title</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Date & Location</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Checked In</th>
                  <th className="py-4 px-6">Impact</th>
                  {canManage && <th className="py-4 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-sm">
                {visibleActivities.map((activity) => (
                  <tr key={activity._id} className="hover:bg-slate-950/20 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">{activity.title}</div>
                      {activity.description && (
                        <div className="text-slate-500 text-xs mt-0.5 line-clamp-1 max-w-xs">{activity.description}</div>
                      )}
                      {activity.projectId && <div className="mt-1.5">{renderProjectBadge(activity)}</div>}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-300 font-medium">{activity.category || "Uncategorized"}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-white font-medium whitespace-nowrap">{formatDate(activity.date)}</div>
                      <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5 whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {formatTimeRange(activity)}
                      </div>
                      <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {activity.location}
                      </div>
                    </td>
                    <td className="py-4 px-6">{renderStatus(activity, "md")}</td>
                    <td className="py-4 px-6 font-semibold text-slate-300 whitespace-nowrap">
                      {activity.spotsFilled ?? 0} / {activity.maxVolunteers}
                    </td>
                    <td className="py-4 px-6 min-w-[160px]">
                      {activity.impact && activity.impact.length > 0 ? (
                        <ImpactChips impact={activity.impact} />
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    {canManage && <td className="py-4 px-6 text-right">{renderRowActions(activity)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage && formOpen && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeFormModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-form-title"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 id="activity-form-title" className="text-lg font-bold text-white">
                {editing ? "Edit Activity" : "Schedule New Activity"}
              </h3>
              <button
                type="button"
                onClick={closeFormModal}
                disabled={saving}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} noValidate className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl px-4 py-3 text-sm"
                >
                  <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError.message}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="activity-title" className={LABEL_CLASS}>
                  Activity Title *
                </label>
                <input
                  id="activity-title"
                  type="text"
                  required
                  autoFocus
                  maxLength={120}
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="e.g. Martil beach clean-up"
                  className={fieldClass("title")}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="activity-description" className={LABEL_CLASS}>
                  Description
                </label>
                <textarea
                  id="activity-description"
                  value={form.description}
                  maxLength={2000}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={2}
                  className={fieldClass("description", "px-4 py-3 text-white resize-none")}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="activity-projectId" className={LABEL_CLASS}>
                  Project
                </label>
                <select
                  id="activity-projectId"
                  value={form.projectId}
                  onChange={(event) => handleProjectChange(event.target.value)}
                  className={fieldClass("projectId", "px-4 py-2.5 text-slate-200")}
                >
                  <option value="">No project</option>
                  {openProjects.length > 0 && (
                    <optgroup label="Current projects">
                      {openProjects.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {pastProjects.length > 0 && (
                    <optgroup label="Completed & cancelled">
                      {pastProjects.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {missingProjectOption && (
                    <option value={missingProjectOption.id}>{missingProjectOption.name}</option>
                  )}
                </select>
                {projects.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No projects yet.{" "}
                    <Link href="/projects" className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">
                      Create a project
                    </Link>{" "}
                    to group activities such as Malabis Share or Soccer4All.
                  </p>
                ) : selectedProject ? (
                  <p className={`text-xs ${outsideProjectPeriod ? "text-amber-300" : "text-slate-500"}`}>
                    {outsideProjectPeriod
                      ? `Heads up: ${seriesDates.length > 1 ? "some of these dates are" : "this date is"} outside the project period (${projectPeriod}).`
                      : [projectPeriod && `Runs ${projectPeriod}`, selectedProject.location && `Based in ${selectedProject.location}`]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="activity-date" className={LABEL_CLASS}>
                    {form.repeatWeekly && !editing ? "First Date *" : "Date *"}
                  </label>
                  <input
                    id="activity-date"
                    type="date"
                    required
                    value={form.date}
                    onChange={(event) => updateField("date", event.target.value)}
                    className={fieldClass("date")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="activity-startTime" className={LABEL_CLASS}>
                    Start Time *
                  </label>
                  <input
                    id="activity-startTime"
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(event) => updateField("startTime", event.target.value)}
                    className={fieldClass("startTime")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="activity-endTime" className={LABEL_CLASS}>
                    End Time *
                  </label>
                  <input
                    id="activity-endTime"
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(event) => updateField("endTime", event.target.value)}
                    className={fieldClass("endTime")}
                  />
                </div>
              </div>

              {!editing && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label htmlFor="activity-repeatWeekly" className="flex items-center gap-2.5 text-sm font-medium text-slate-200 cursor-pointer">
                      <input
                        id="activity-repeatWeekly"
                        type="checkbox"
                        checked={form.repeatWeekly}
                        onChange={(event) =>
                          patchForm(
                            {
                              repeatWeekly: event.target.checked,
                              repeatWeeks: form.repeatWeeks.trim() ? form.repeatWeeks : DEFAULT_REPEAT_WEEKS,
                            },
                            ["repeatWeekly", "repeatWeeks"]
                          )
                        }
                        className="h-4 w-4 rounded accent-emerald-500"
                      />
                      <Repeat className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                      Repeat weekly
                    </label>
                    {form.repeatWeekly && (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <label htmlFor="activity-repeatWeeks">for</label>
                        <div className="w-20">
                          <input
                            id="activity-repeatWeeks"
                            type="number"
                            min={1}
                            max={ACTIVITY_MAX_WEEKLY_REPEATS}
                            step={1}
                            inputMode="numeric"
                            value={form.repeatWeeks}
                            onChange={(event) => updateField("repeatWeeks", event.target.value)}
                            className={fieldClass("repeatWeeks", "px-3 py-1.5 text-white")}
                          />
                        </div>
                        <span>weeks</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {!form.repeatWeekly
                      ? `Create the same activity on the same weekday for up to ${ACTIVITY_MAX_WEEKLY_REPEATS} weeks, e.g. a weekly English class.`
                      : !repeatWeeks
                        ? `Enter a number of weeks between 1 and ${ACTIVITY_MAX_WEEKLY_REPEATS}.`
                        : !form.date
                          ? `Creates ${countActivities(repeatWeeks)}, one per week. Pick the first date above.`
                          : `Creates ${countActivities(repeatWeeks)}, every ${formatLocalDate(form.date, { weekday: "long" })}: ${seriesDates
                              .map((date) => formatShortDate(date))
                              .join(", ")}.`}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PresetField
                  id="activity-location"
                  label="Location / Site"
                  required
                  options={locationOptions}
                  value={form.location}
                  isOther={form.locationOther}
                  onChange={(value, isOther) => patchForm({ location: value, locationOther: isOther }, ["location"])}
                  placeholder="Select a location"
                  otherLabel="Other location…"
                  otherPlaceholder="e.g. Dar Ataa care home, Tetouan"
                  maxLength={200}
                  invalid={formError?.field === "location"}
                  inputClassName={controlClass}
                />
                <PresetField
                  id="activity-category"
                  label="Category"
                  required
                  options={categoryOptions}
                  value={form.category}
                  isOther={form.categoryOther}
                  onChange={(value, isOther) => patchForm({ category: value, categoryOther: isOther }, ["category"])}
                  placeholder="Select a category"
                  otherLabel="Other…"
                  otherPlaceholder="Describe the category"
                  maxLength={60}
                  invalid={formError?.field === "category"}
                  inputClassName={controlClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="activity-maxVolunteers" className={LABEL_CLASS}>
                    {form.repeatWeekly && !editing ? "Max Volunteers (each week) *" : "Maximum Volunteers *"}
                  </label>
                  <input
                    id="activity-maxVolunteers"
                    type="number"
                    required
                    min={1}
                    max={10000}
                    step={1}
                    inputMode="numeric"
                    value={form.maxVolunteers}
                    onChange={(event) => updateField("maxVolunteers", event.target.value)}
                    className={fieldClass("maxVolunteers")}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="activity-status" className={LABEL_CLASS}>
                    Status *
                  </label>
                  <select
                    id="activity-status"
                    value={form.status}
                    onChange={(event) => updateField("status", event.target.value as ActivityStatus)}
                    className={fieldClass("status", "px-4 py-2.5 text-slate-300")}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ImpactEditor
                rows={form.impact}
                onChange={(rows) => patchForm({ impact: rows }, ["impact"])}
                invalidIndex={formError?.field === "impact" ? (formError.impactIndex ?? null) : null}
                disabled={saving}
                inputClassName={controlClass}
                note={
                  !editing && form.repeatWeekly && (repeatWeeks ?? 0) > 1 && form.impact.length > 0
                    ? "Impact is saved on the first activity only. Log impact for the later weeks after they take place."
                    : undefined
                }
              />

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                >
                  {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : form.repeatWeekly && (repeatWeeks ?? 0) > 1
                        ? `Create ${repeatWeeks} Activities`
                        : "Create Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canManage && deleteTarget && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteModal();
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-activity-title"
            aria-describedby="delete-activity-description"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            <div className="p-6 space-y-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                <TriangleAlert className="h-6 w-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 id="delete-activity-title" className="text-lg font-bold text-white">
                  Delete Activity
                </h3>
                <p id="delete-activity-description" className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-white">{deleteTarget.title}</span>
                  {deleteTarget.date && <> on {formatDate(deleteTarget.date)}</>}? This cannot be undone.
                </p>
              </div>

              {deleteRecordCount > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl px-4 py-3 text-xs leading-relaxed">
                  This activity has {pluralize(deleteRecordCount, "attendance record")}. Deleting it will also permanently
                  delete {deleteRecordCount === 1 ? "that record" : "all of those records"}.
                </div>
              )}

              {deleteError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl px-4 py-3 text-xs"
                >
                  <CircleX className="h-4 w-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50 transition-colors"
                >
                  {deleting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {deleting
                    ? "Deleting..."
                    : deleteRecordCount > 0
                      ? `Delete Activity & ${pluralize(deleteRecordCount, "Record")}`
                      : "Delete Activity"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 left-6 sm:left-auto z-[60] sm:max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.kind === "success"
              ? "bg-slate-900 border-emerald-500/30 text-emerald-300"
              : "bg-slate-900 border-rose-500/30 text-rose-300"
          }`}
        >
          {toast.kind === "success" ? (
            <CircleCheck className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <CircleX className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
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
