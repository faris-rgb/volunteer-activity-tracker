"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarPlus,
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock,
  LayoutGrid,
  List,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  createActivityAction,
  deleteActivityAction,
  updateActivityAction,
  updateActivityStatusAction,
  type ActivityData,
  type ActivityInput,
  type ActivityStatus,
} from "@/app/actions/activities";
import { formatLocalDate, formatTime, getActivityDateTime } from "@/lib/dates";

interface ActivitiesClientProps {
  initialActivities: ActivityData[];
  loadError: string | null;
  canManage: boolean;
  openCreateOnLoad: boolean;
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
  category: string;
  maxVolunteers: string;
  status: ActivityStatus;
}

interface Filters {
  query: string;
  status: StatusFilter;
  category: string;
}

interface FormError {
  field: keyof FormState | null;
  message: string;
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

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  date: "",
  startTime: "09:00",
  endTime: "12:00",
  location: "",
  category: "",
  maxVolunteers: "10",
  status: "Upcoming",
};

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

const INPUT_CLASS =
  "w-full bg-slate-950 border rounded-xl px-4 text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]";

function formatTimeRange(activity: ActivityData): string {
  if (!activity.startTime) return "Time not set";
  if (!activity.endTime) return formatTime(activity.startTime);
  return `${formatTime(activity.startTime)} – ${formatTime(activity.endTime)}`;
}

function formatDate(date: string): string {
  return date ? formatLocalDate(date, { month: "short", day: "numeric", year: "numeric" }) : "No date";
}

function getStartTimestamp(activity: ActivityData): number {
  return getActivityDateTime(activity.date, activity.startTime)?.getTime() ?? 0;
}

function toFormState(activity: ActivityData): FormState {
  return {
    title: activity.title,
    description: activity.description ?? "",
    date: activity.date,
    startTime: /^\d{2}:\d{2}$/.test(activity.startTime) ? activity.startTime : "",
    endTime: /^\d{2}:\d{2}$/.test(activity.endTime) ? activity.endTime : "",
    location: activity.location,
    category: activity.category,
    maxVolunteers: String(activity.maxVolunteers || ""),
    status: activity.status,
  };
}

function validateForm(form: FormState, editing: ActivityData | null): FormError | null {
  if (!form.title.trim()) return { field: "title", message: "Title is required." };
  if (!form.date) return { field: "date", message: "Date is required." };
  if (!form.startTime) return { field: "startTime", message: "Start time is required." };
  if (!form.endTime) return { field: "endTime", message: "End time is required." };
  if (form.endTime <= form.startTime) return { field: "endTime", message: "End time must be after the start time." };
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
  return null;
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function matchesFilters(activity: ActivityData, { query, status, category }: Filters): boolean {
  if (status !== "All" && activity.status !== status) return false;
  if (category !== "All" && activity.category !== category) return false;
  if (!query) return true;
  return [activity.title, activity.description, activity.location, activity.category].some((value) =>
    value?.toLowerCase().includes(query)
  );
}

export default function ActivitiesClient({
  initialActivities,
  loadError,
  canManage,
  openCreateOnLoad,
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

  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-asc");

  const [formOpen, setFormOpen] = useState(openCreateOnLoad);
  const [editing, setEditing] = useState<ActivityData | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);

  const [syncedOpenCreate, setSyncedOpenCreate] = useState(openCreateOnLoad);
  if (openCreateOnLoad !== syncedOpenCreate) {
    setSyncedOpenCreate(openCreateOnLoad);
    if (openCreateOnLoad && !formOpen) {
      setEditing(null);
      setForm(EMPTY_FORM);
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
      router.replace("/activities", { scroll: false });
    }
  }, [openCreateOnLoad, router]);

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

  const categories = useMemo(
    () =>
      Array.from(new Set(activities.map((activity) => activity.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [activities]
  );
  const activeCategory = categories.includes(categoryFilter) ? categoryFilter : "All";

  const query = search.trim().toLowerCase();

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setCategoryFilter("All");
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

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError?.field === field) {
      setFormError(null);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (activity: ActivityData) => {
    setEditing(activity);
    setForm(toFormState(activity));
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

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const current = editing ? (activities.find((activity) => activity._id === editing._id) ?? editing) : null;
    const validationError = validateForm(form, current);
    if (validationError) {
      setFormError(validationError);
      if (validationError.field) {
        document.getElementById(`activity-${validationError.field}`)?.focus();
      }
      return;
    }

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
    };

    setSaving(true);
    setFormError(null);
    try {
      const result = editing?._id
        ? await updateActivityAction(editing._id, payload)
        : await createActivityAction(payload);
      if (!result.ok) {
        if (result.notFound && editing?._id) {
          removeActivity(editing._id);
          setFormOpen(false);
          showToast("error", result.error);
          return;
        }
        setFormError({ field: null, message: result.error });
        resync();
        return;
      }
      if (editing) {
        replaceActivity(result.data);
      } else {
        setActivities((prev) => [...prev, result.data]);
        if (!matchesFilters(result.data, { query, status: statusFilter, category: activeCategory })) {
          clearFilters();
        }
      }
      setFormOpen(false);
      showToast("success", editing ? `"${result.data.title}" was updated.` : `"${result.data.title}" was scheduled.`);
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
    const result = activities.filter((activity) =>
      matchesFilters(activity, { query, status: statusFilter, category: activeCategory })
    );
    result.sort((a, b) => {
      if (sortOrder === "title") return a.title.localeCompare(b.title);
      const diff = getStartTimestamp(a) - getStartTimestamp(b);
      return sortOrder === "date-asc" ? diff : -diff;
    });
    return result;
  }, [activities, query, statusFilter, activeCategory, sortOrder]);

  const stats = useMemo(
    () => ({
      All: activities.length,
      Upcoming: activities.filter((activity) => activity.status === "Upcoming").length,
      Active: activities.filter((activity) => activity.status === "Active").length,
      Completed: activities.filter((activity) => activity.status === "Completed").length,
    }),
    [activities]
  );

  const hasFilters = query !== "" || statusFilter !== "All" || activeCategory !== "All";

  const statTiles: { key: StatusFilter; label: string; color: string }[] = [
    { key: "All", label: "Total Activities", color: "text-white" },
    { key: "Upcoming", label: "Upcoming", color: "text-amber-400" },
    { key: "Active", label: "Active", color: "text-emerald-400" },
    { key: "Completed", label: "Completed", color: "text-purple-400" },
  ];

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

  const renderRowActions = (activity: ActivityData) => (
    <div className="flex items-center justify-end gap-1.5">
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

  const fieldClass = (field: keyof FormState, extra = "py-2 text-white") =>
    `${INPUT_CLASS} ${extra} ${formError?.field === field ? "border-rose-500/60" : "border-slate-800"}`;

  const deleteRecordCount = deleteTarget?.attendanceCount ?? 0;

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Calendar className="h-8 w-8 text-emerald-400" />
            Activities & Campaigns
          </h1>
          <p className="text-slate-400 mt-1">
            {canManage
              ? "Schedule and monitor ongoing volunteering activities."
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
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities by title, location, category..."
              aria-label="Search activities"
              className="w-full pl-11 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              aria-label="Filter by status"
              className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 min-w-[130px]"
            >
              <option value="All">All Statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={activeCategory}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
              className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 min-w-[140px]"
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
              className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 min-w-[155px]"
            >
              <option value="date-asc">Date: Earliest first</option>
              <option value="date-desc">Date: Latest first</option>
              <option value="title">Title: A–Z</option>
            </select>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-0.5 flex items-center" role="group" aria-label="Layout">
              <button
                type="button"
                onClick={() => setViewMode("card")}
                aria-pressed={viewMode === "card"}
                className={`p-2 rounded-lg transition-colors ${viewMode === "card" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                title="Card grid view"
              >
                <LayoutGrid className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-pressed={viewMode === "table"}
                className={`p-2 rounded-lg transition-colors ${viewMode === "table" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                title="Table view"
              >
                <List className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>
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
                ? "Schedule your first volunteering activity to start tracking capacity and attendance."
                : "No volunteering activities have been scheduled yet. Check back soon."}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Schedule First Activity
              </button>
            )}
          </div>
        )
      ) : visibleActivities.length === 0 ? (
        <div className="py-12 border border-slate-900 bg-slate-950/20 rounded-2xl text-center text-slate-500 text-sm space-y-3">
          <p>No activities match your search or filters.</p>
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

                  <div className="space-y-1">
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
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-300 font-medium">{activity.category || "Uncategorized"}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-white font-medium">{formatDate(activity.date)}</div>
                      <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
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

            <form onSubmit={handleSave} noValidate className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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
                <label htmlFor="activity-title" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
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
                  placeholder="e.g. Beach Cleanup"
                  className={fieldClass("title")}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="activity-description" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Description
                </label>
                <textarea
                  id="activity-description"
                  value={form.description}
                  maxLength={2000}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={2}
                  className={fieldClass("description", "py-3 text-white resize-none")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="activity-date" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Date *
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
                  <label htmlFor="activity-startTime" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
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
                  <label htmlFor="activity-endTime" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="activity-location" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Location / Site *
                  </label>
                  <input
                    id="activity-location"
                    type="text"
                    required
                    maxLength={200}
                    value={form.location}
                    onChange={(event) => updateField("location", event.target.value)}
                    className={fieldClass("location")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="activity-category" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Category *
                  </label>
                  <input
                    id="activity-category"
                    type="text"
                    required
                    maxLength={60}
                    list="activity-category-options"
                    placeholder="e.g. Environment, Elderly Care"
                    value={form.category}
                    onChange={(event) => updateField("category", event.target.value)}
                    className={fieldClass("category")}
                  />
                  <datalist id="activity-category-options">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="activity-maxVolunteers" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Maximum Volunteers *
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
                  <label htmlFor="activity-status" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Status *
                  </label>
                  <select
                    id="activity-status"
                    value={form.status}
                    onChange={(event) => updateField("status", event.target.value as ActivityStatus)}
                    className={fieldClass("status", "py-2.5 text-slate-300")}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
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
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                >
                  {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create Activity"}
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
          className={`fixed bottom-6 right-6 z-[60] max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 ${
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
