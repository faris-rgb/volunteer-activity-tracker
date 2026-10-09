"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CalendarPlus,
  CalendarRange,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Loader2,
  ListChecks,
  MapPin,
  Pencil,
  Printer,
  RefreshCw,
  Search,
  StickyNote,
  Timer,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  bulkRecordAttendanceAction,
  recordAttendanceAction,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@/app/actions/attendance";
import type { ActionResult } from "@/lib/actionResult";
import { formatDateKey, formatLocalDate, formatTime, toDateKey } from "@/lib/dates";
import { ESC_RULES, VOLUNTEER_TYPE_LABELS, type PipelineStage, type VolunteerType } from "@/lib/domain";
import WeeklyHoursView from "./WeeklyHoursView";
import {
  activityDurationHours,
  buildWeeklyHours,
  effectiveHours,
  ESC_STATUS_LABELS,
  filterWeeklyRows,
  formatHours,
  formatHoursNumber,
  isDateKey,
  isValidHours,
  MAX_HOURS,
  nextHours,
  startOfWeek,
  type WeeklyFilter,
} from "./hours";

export interface AttendanceVolunteer {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  country?: string;
  skills?: string[];
  active: boolean;
  /** Managers only: drives the ESC weekly hours check. */
  volunteerType?: VolunteerType;
  pipelineStage?: PipelineStage;
}

export interface AttendanceActivity {
  _id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  status: "Upcoming" | "Active" | "Completed";
  maxVolunteers?: number;
}

interface AttendanceClientProps {
  volunteers: AttendanceVolunteer[];
  activities: AttendanceActivity[];
  initialRecords: AttendanceRecord[];
  initialActivityId: string;
  canManage: boolean;
  loadError?: string;
}

type RowStatus = AttendanceStatus | "Unmarked";
type View = "activity" | "weekly";
type StatusFilter = "All" | RowStatus;

interface AttendanceRow {
  volunteer: AttendanceVolunteer;
  record?: AttendanceRecord;
  status: RowStatus;
}

interface Notice {
  type: "success" | "error";
  message: string;
}

type EditorField = "status" | "hours" | "notes";

interface EditorState {
  activityId: string;
  volunteer: AttendanceVolunteer;
  status: AttendanceStatus | null;
  /** Raw text of the hours field; empty means "use the activity's duration". */
  hours: string;
  /** The activity's duration in hours, used when the hours field is left empty. */
  defaultHours: number | undefined;
  notes: string;
  saving: boolean;
  error: string | null;
  errorField: EditorField | null;
  /** Field focused when the dialog opens. */
  focus: Exclude<EditorField, "status">;
}

const STATUS_OPTIONS: { value: AttendanceStatus; icon: typeof Check; activeClass: string }[] = [
  { value: "Present", icon: Check, activeClass: "text-emerald-400 bg-emerald-500/10" },
  { value: "Late", icon: Clock, activeClass: "text-amber-400 bg-amber-500/10" },
  { value: "Absent", icon: X, activeClass: "text-rose-400 bg-rose-500/10" },
];

const BULK_BUTTON_CLASSES: Record<AttendanceStatus, string> = {
  Present: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
  Late: "bg-amber-500 text-slate-950 hover:bg-amber-400",
  Absent: "bg-rose-500 text-white hover:bg-rose-400",
};

const STATUS_BADGE_CLASSES: Record<RowStatus, string> = {
  Present: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Late: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Absent: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  Unmarked: "text-slate-400 bg-slate-800 border-slate-700/50",
};

const ACTIVITY_STATUS_CLASSES: Record<AttendanceActivity["status"], string> = {
  Active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Upcoming: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  Completed: "text-slate-400 bg-slate-800 border-slate-700/50",
};

const FILTERS: StatusFilter[] = ["All", "Present", "Late", "Absent", "Unmarked"];
const ACTIVITY_GROUPS: AttendanceActivity["status"][] = ["Active", "Upcoming", "Completed"];
const MAX_NOTES_LENGTH = 1000;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;
const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const VIEWS: { id: View; label: string; icon: typeof Check }[] = [
  { id: "activity", label: "By activity", icon: ListChecks },
  { id: "weekly", label: "Weekly hours", icon: CalendarRange },
];

const subscribeToNothing = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}

/** Re-checks the date every minute, so "today" and "this week" roll over at midnight. */
function subscribeToMinutes(onChange: () => void): () => void {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

/** Today's local "YYYY-MM-DD", or "" while rendering on the server (the viewer's date is unknown there). */
function useTodayKey(): string {
  return useSyncExternalStore(subscribeToMinutes, () => formatDateKey(new Date()), () => "");
}

/** A valid ?week= value snapped to its Monday, or "" for the current week. */
function parseWeekParam(value: string | null): string {
  return value && isDateKey(value) ? startOfWeek(value) : "";
}

/** Parses the editor's hours text ("2.5" or "2,5"). Returns null for an empty field and an error for bad input. */
function parseHoursInput(value: string): { hours: number | null } | { error: string } {
  const text = value.trim().replace(",", ".");
  if (!text) {
    return { hours: null };
  }
  const hours = /^(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : Number.NaN;
  if (!Number.isFinite(hours) || hours < 0 || hours > MAX_HOURS) {
    return { error: `Hours must be a number from 0 to ${MAX_HOURS}.` };
  }
  if (!isValidHours(hours)) {
    return { error: "Use 15-minute steps for hours (e.g. 2, 2.25, 2.5 or 2.75)." };
  }
  return { hours };
}

function recordKey(activityId: string, volunteerId: string): string {
  return `${activityId}::${volunteerId}`;
}

function fullName(volunteer: AttendanceVolunteer): string {
  return `${volunteer.firstName} ${volunteer.lastName}`.trim() || "Unnamed volunteer";
}

function initials(volunteer: AttendanceVolunteer): string {
  return `${volunteer.firstName.charAt(0)}${volunteer.lastName.charAt(0)}`.toUpperCase() || "?";
}

function formatActivityDate(date: string, options?: Intl.DateTimeFormatOptions): string {
  if (!date) {
    return "No date set";
  }
  const formatted = formatLocalDate(date, options);
  return formatted === "No date" ? date : formatted;
}

/**
 * New records store an ISO timestamp; older ones hold a preformatted time that is shown as-is.
 * The date is included when asked for, or when the check-in did not happen on the activity's date.
 */
function formatCheckIn(
  value: string | undefined,
  hydrated: boolean,
  { withDate = false, activityDate }: { withDate?: boolean; activityDate?: string } = {}
): string {
  if (!value) {
    return "";
  }
  if (!ISO_TIMESTAMP.test(value)) {
    return value;
  }
  if (!hydrated) {
    return "…";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  if (withDate) {
    return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }
  if (activityDate && formatDateKey(date) !== toDateKey(activityDate)) {
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function resolveActivityId(activities: AttendanceActivity[], ...candidates: string[]): string {
  return candidates.find((id) => activities.some((activity) => activity._id === id)) ?? activities[0]?._id ?? "";
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "activity"
  );
}

export default function AttendanceClient({
  volunteers,
  activities,
  initialRecords,
  initialActivityId,
  canManage,
  loadError,
}: AttendanceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlActivityId = searchParams.get("activity") ?? "";
  const hydrated = useHydrated();
  const todayKey = useTodayKey();
  const [isRefreshing, startRefresh] = useTransition();

  const [view, setView] = useState<View>(() =>
    canManage && searchParams.get("view") === "weekly" ? "weekly" : "activity"
  );
  // "" follows the current week.
  const [weekParam, setWeekParam] = useState(() => parseWeekParam(searchParams.get("week")));
  const [weeklyFilter, setWeeklyFilter] = useState<WeeklyFilter>("all");

  const [selectedActivityId, setSelectedActivityId] = useState(initialActivityId);
  const [seenUrlActivityId, setSeenUrlActivityId] = useState(urlActivityId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, AttendanceRecord>>({});
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);

  // Fresh server data replaces local overrides, except for saves that are still in flight.
  const [syncedRecords, setSyncedRecords] = useState(initialRecords);
  if (syncedRecords !== initialRecords) {
    setSyncedRecords(initialRecords);
    setOverrides((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => savingKeys.includes(key))));
  }

  // A navigation that changes ?activity= (a link, back/forward) selects that activity. Otherwise the selection
  // is kept, unless it disappeared after a refresh (e.g. another manager deleted it). Skipped while loading
  // failed, because the empty lists then say nothing about which activities exist.
  const urlChanged = !loadError && urlActivityId !== seenUrlActivityId;
  const followUrl = urlChanged && urlActivityId !== selectedActivityId;
  const activityId = loadError
    ? ""
    : resolveActivityId(activities, followUrl ? urlActivityId : selectedActivityId, initialActivityId);
  if (urlChanged) {
    setSeenUrlActivityId(urlActivityId);
  }
  if (!loadError && activityId !== selectedActivityId) {
    setSelectedActivityId(activityId);
    setSelectedIds([]);
    if (!followUrl && selectedActivityId) {
      setNotice({
        type: "error",
        message: "The activity you were viewing no longer exists. Your selection was cleared.",
      });
    }
  }

  const currentActivity = activities.find((activity) => activity._id === activityId);
  const currentDefaultHours = currentActivity
    ? activityDurationHours(currentActivity.startTime, currentActivity.endTime)
    : undefined;
  const editorOpen = editor !== null;
  const editorError = editor?.error ?? null;
  const editorErrorField = editor?.errorField ?? null;
  const activeView: View = canManage && !loadError ? view : "activity";
  const currentWeekStart = todayKey ? startOfWeek(todayKey) : "";
  const weekStart = weekParam || currentWeekStart;

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activityId || urlActivityId === activityId) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("activity", activityId);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [activityId, urlActivityId]);

  useEffect(() => {
    if (!editorOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditor((current) => (current?.saving ? current : null));
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editorOpen]);

  useEffect(() => {
    if (!canManage) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const wantedView = view === "weekly" ? "weekly" : null;
    const wantedWeek = view === "weekly" && weekParam ? weekParam : null;
    if (params.get("view") === wantedView && params.get("week") === wantedWeek) {
      return;
    }
    if (wantedView) {
      params.set("view", wantedView);
    } else {
      params.delete("view");
    }
    if (wantedWeek) {
      params.set("week", wantedWeek);
    } else {
      params.delete("week");
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [canManage, view, weekParam]);

  useEffect(() => {
    if (!editorError) {
      return;
    }
    if (editorErrorField === "hours") {
      hoursRef.current?.focus();
    } else {
      notesRef.current?.focus();
    }
  }, [editorError, editorErrorField]);

  const groupedActivities = useMemo(
    () =>
      ACTIVITY_GROUPS.map((status) => ({
        status,
        items: activities
          .filter((activity) => activity.status === status)
          .sort((a, b) => (status === "Completed" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))),
      })).filter((group) => group.items.length > 0),
    [activities]
  );

  const recordsByKey = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    initialRecords.forEach((record) => map.set(recordKey(record.activityId, record.volunteerId), record));
    Object.entries(overrides).forEach(([key, record]) => map.set(key, record));
    return map;
  }, [initialRecords, overrides]);

  const roster = useMemo<AttendanceRow[]>(() => {
    if (!activityId) {
      return [];
    }
    return volunteers
      .map((volunteer) => {
        const record = recordsByKey.get(recordKey(activityId, volunteer._id));
        return { volunteer, record, status: record?.status ?? "Unmarked" } as AttendanceRow;
      })
      .filter((row) => row.volunteer.active || row.record)
      // A fixed locale keeps the server-rendered order identical to the browser's (no hydration mismatch).
      .sort((a, b) => fullName(a.volunteer).localeCompare(fullName(b.volunteer), "en"));
  }, [volunteers, recordsByKey, activityId]);

  const counts = useMemo(() => {
    const totals: Record<RowStatus, number> = { Present: 0, Late: 0, Absent: 0, Unmarked: 0 };
    roster.forEach((row) => {
      totals[row.status] += 1;
    });
    return totals;
  }, [roster]);

  const hoursByVolunteer = useMemo(() => {
    const activity = activities.find((item) => item._id === activityId);
    const map = new Map<string, number>();
    roster.forEach((row) => {
      const hours = row.record ? effectiveHours(row.record, activity) : undefined;
      if (hours !== undefined) {
        map.set(row.volunteer._id, hours);
      }
    });
    return map;
  }, [roster, activities, activityId]);
  const totalHours = [...hoursByVolunteer.values()].reduce((sum, hours) => sum + hours, 0);

  // Built only while the weekly view is open.
  const weekly = useMemo(
    () =>
      activeView === "weekly" && weekStart
        ? buildWeeklyHours(weekStart, volunteers, activities, recordsByKey.values())
        : null,
    [activeView, weekStart, volunteers, activities, recordsByKey]
  );

  const checkedInCount = counts.Present + counts.Late;
  const capacity = currentActivity?.maxVolunteers ?? 0;
  const markedCount = checkedInCount + counts.Absent;
  const attendanceRate = markedCount > 0 ? Math.round((checkedInCount / markedCount) * 100) : 0;

  const query = search.trim().toLowerCase();
  const visibleRows = useMemo(
    () =>
      roster.filter((row) => {
        if (statusFilter !== "All" && row.status !== statusFilter) {
          return false;
        }
        if (!query) {
          return true;
        }
        const { volunteer } = row;
        return [fullName(volunteer), volunteer.email ?? "", volunteer.country ?? "", ...(volunteer.skills ?? [])].some(
          (field) => field.toLowerCase().includes(query)
        );
      }),
    [roster, statusFilter, query]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = visibleRows.map((row) => row.volunteer._id);
  const selectedVisibleIds = visibleIds.filter((id) => selectedSet.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const someVisibleSelected = selectedVisibleIds.length > 0 && !allVisibleSelected;
  const columnCount = canManage ? 7 : 5;

  const showNotice = (type: Notice["type"], message: string) => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    }
    const next = { type, message };
    setNotice(next);
    if (type === "success") {
      noticeTimer.current = setTimeout(() => setNotice((current) => (current === next ? null : current)), 4000);
    }
  };

  const buildOptimisticRecord = (
    targetActivityId: string,
    volunteerId: string,
    status: AttendanceStatus,
    notes?: string,
    hours?: number | null
  ): AttendanceRecord => {
    const previous = recordsByKey.get(recordKey(targetActivityId, volunteerId));
    const keepCheckIn = previous && previous.status !== "Absent" && previous.checkInTime;
    const activity = activities.find((item) => item._id === targetActivityId);
    const now = new Date();
    const checkInNow = toDateKey(activity?.date) === formatDateKey(now) ? now.toISOString() : undefined;
    const defaultHours = activity ? activityDurationHours(activity.startTime, activity.endTime) : undefined;
    return {
      ...previous,
      volunteerId,
      activityId: targetActivityId,
      status,
      checkInTime: status === "Absent" ? undefined : keepCheckIn ? previous.checkInTime : checkInNow,
      hours: nextHours(previous, status, hours, defaultHours),
      notes: notes === undefined ? previous?.notes : notes.trim() || undefined,
    };
  };

  /** Mirrors the server rule: Present/Late may not check in more distinct volunteers than the activity's capacity. */
  const capacityError = (targetActivityId: string, volunteerIds: string[], status: AttendanceStatus): string | null => {
    const max = activities.find((activity) => activity._id === targetActivityId)?.maxVolunteers ?? 0;
    if (status === "Absent" || !(max > 0)) {
      return null;
    }
    const checkedIn = new Set(
      [...recordsByKey.values()]
        .filter((record) => record.activityId === targetActivityId && record.status !== "Absent")
        .map((record) => record.volunteerId)
    );
    const added = volunteerIds.filter((id) => !checkedIn.has(id)).length;
    if (added === 0 || checkedIn.size + added <= max) {
      return null;
    }
    const remaining = Math.max(0, max - checkedIn.size);
    return remaining === 0
      ? `This activity is full (${checkedIn.size} of ${max} spots checked in). Raise its capacity on the Activities page to check in more volunteers.`
      : `Only ${remaining} of ${max} spots are left, so ${added} more volunteers can't be checked in. Select fewer volunteers or raise the activity's capacity on the Activities page.`;
  };

  /** Applies the change optimistically, runs the save, then keeps the server result or rolls back. */
  const runSave = async (
    targetActivityId: string,
    volunteerIds: string[],
    status: AttendanceStatus,
    notes: string | undefined,
    hours: number | null | undefined,
    save: () => Promise<ActionResult<AttendanceRecord[]>>
  ): Promise<string | null> => {
    const blocked = capacityError(targetActivityId, volunteerIds, status);
    if (blocked) {
      return blocked;
    }
    const keys = volunteerIds.map((id) => recordKey(targetActivityId, id));
    const previousOverrides = new Map(keys.map((key) => [key, overrides[key]]));

    setOverrides((prev) => {
      const next = { ...prev };
      volunteerIds.forEach((id, index) => {
        next[keys[index]] = buildOptimisticRecord(targetActivityId, id, status, notes, hours);
      });
      return next;
    });
    setSavingKeys((prev) => [...prev, ...keys]);

    let result: ActionResult<AttendanceRecord[]>;
    try {
      result = await save();
    } catch (error) {
      console.error(error);
      result = { ok: false, error: "Could not reach the server. Check your connection and try again." };
    }

    setSavingKeys((prev) => prev.filter((key) => !keys.includes(key)));
    setOverrides((prev) => {
      const next = { ...prev };
      if (result.ok) {
        result.data.forEach((record) => {
          next[recordKey(record.activityId, record.volunteerId)] = record;
        });
      } else {
        keys.forEach((key) => {
          const previous = previousOverrides.get(key);
          if (previous) {
            next[key] = previous;
          } else {
            delete next[key];
          }
        });
      }
      return next;
    });

    return result.ok ? null : result.error;
  };

  const saveSingle = (
    targetActivityId: string,
    volunteerId: string,
    status: AttendanceStatus,
    notes?: string,
    hours?: number | null
  ) =>
    runSave(targetActivityId, [volunteerId], status, notes, hours, async () => {
      const result = await recordAttendanceAction({
        volunteerId,
        activityId: targetActivityId,
        status,
        notes,
        hours,
        timeZone: localTimeZone(),
      });
      return result.ok ? { ok: true, data: [result.data] } : result;
    });

  const handleMark = async (row: AttendanceRow, status: AttendanceStatus) => {
    if (row.status === status || savingKeys.includes(recordKey(activityId, row.volunteer._id))) {
      return;
    }
    const error = await saveSingle(activityId, row.volunteer._id, status);
    if (error) {
      showNotice("error", `${fullName(row.volunteer)}: ${error}`);
    }
  };

  const handleBulkMark = async (status: AttendanceStatus) => {
    const ids = selectedVisibleIds.filter((id) => !savingKeys.includes(recordKey(activityId, id)));
    if (ids.length === 0 || bulkStatus) {
      return;
    }
    setBulkStatus(status);
    const error = await runSave(activityId, ids, status, undefined, undefined, () =>
      bulkRecordAttendanceAction(activityId, ids, status, localTimeZone())
    );
    setBulkStatus(null);
    if (error) {
      showNotice("error", error);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    showNotice(
      "success",
      `Marked ${ids.length} volunteer${ids.length === 1 ? "" : "s"} as ${status.toLowerCase()}.`
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, ...visibleIds])] : prev.filter((id) => !visibleIds.includes(id))
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleSelectRow = (checked: boolean, volunteerId: string) => {
    setSelectedIds((prev) => (checked ? [...prev, volunteerId] : prev.filter((id) => id !== volunteerId)));
  };

  const handleActivityChange = (id: string) => {
    setSelectedActivityId(id);
    setSelectedIds([]);
  };

  const handleViewChange = (next: View) => {
    if (next === view) {
      return;
    }
    setView(next);
    setNotice(null);
  };

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const index = VIEWS.findIndex((item) => item.id === view);
    const next = VIEWS[(index + (event.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length];
    handleViewChange(next.id);
    document.getElementById(`attendance-tab-${next.id}`)?.focus();
  };

  /** Jumps from the weekly view to one activity's roster. */
  const openActivity = (id: string) => {
    handleActivityChange(id);
    setView("activity");
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWeekChange = (next: string) => {
    setWeekParam(next && next !== currentWeekStart ? next : "");
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
  };

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh();
    });
  };

  const openEditor = (row: AttendanceRow, focus: EditorState["focus"] = "notes") => {
    const current = row.record ? effectiveHours(row.record, currentActivity) : undefined;
    const prefill = current ?? currentDefaultHours;
    setEditor({
      activityId,
      volunteer: row.volunteer,
      status: row.record?.status ?? null,
      hours: prefill === undefined ? "" : formatHoursNumber(prefill),
      defaultHours: currentDefaultHours,
      notes: row.record?.notes ?? "",
      saving: false,
      error: null,
      errorField: null,
      focus,
    });
  };

  const closeEditor = () => {
    setEditor((current) => (current?.saving ? current : null));
  };

  const handleEditorSave = async () => {
    if (!editor || editor.saving) {
      return;
    }
    if (!editor.status) {
      setEditor({ ...editor, error: "Choose an attendance status.", errorField: "status" });
      return;
    }
    let hours: number | null | undefined;
    if (editor.status !== "Absent") {
      const parsed = parseHoursInput(editor.hours);
      if ("error" in parsed) {
        setEditor({ ...editor, error: parsed.error, errorField: "hours" });
        return;
      }
      hours = parsed.hours;
    }
    if (editor.notes.trim().length > MAX_NOTES_LENGTH) {
      setEditor({ ...editor, error: `Notes must be at most ${MAX_NOTES_LENGTH} characters.`, errorField: "notes" });
      return;
    }

    const { activityId: targetActivityId, volunteer, status, notes } = editor;
    setEditor({ ...editor, saving: true, error: null, errorField: null });
    const error = await saveSingle(targetActivityId, volunteer._id, status, notes.trim(), hours);
    if (error) {
      setEditor((current) =>
        current ? { ...current, saving: false, error, errorField: /hour/i.test(error) ? "hours" : null } : current
      );
      return;
    }
    setEditor(null);
    const savedHours = status === "Absent" ? undefined : (hours ?? editor.defaultHours);
    showNotice(
      "success",
      `Saved attendance for ${fullName(volunteer)}${savedHours !== undefined ? ` (${formatHours(savedHours)})` : ""}.`
    );
  };

  const downloadCsv = (rows: string[][], filename: string, exported: number) => {
    const csv = rows.map((cells) => cells.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showNotice("success", `Exported ${exported} row${exported === 1 ? "" : "s"} to CSV.`);
  };

  const exportCsv = () => {
    if (!currentActivity || visibleRows.length === 0) {
      return;
    }
    const headers = [
      "Volunteer",
      ...(canManage ? ["Email"] : []),
      "Country",
      "Status",
      "Check-in",
      "Hours",
      ...(canManage ? ["Recorded by", "Notes"] : []),
    ];
    const lines = visibleRows.map(({ volunteer, record, status }) => {
      const hours = hoursByVolunteer.get(volunteer._id);
      return [
        fullName(volunteer),
        ...(canManage ? [volunteer.email ?? ""] : []),
        volunteer.country ?? "",
        status,
        formatCheckIn(record?.checkInTime, true, { withDate: true }),
        hours === undefined ? "" : formatHoursNumber(hours),
        ...(canManage ? [record?.recordedBy ?? "", record?.notes ?? ""] : []),
      ];
    });
    downloadCsv(
      [headers, ...lines],
      `attendance-${slugify(currentActivity.title)}${currentActivity.date ? `-${currentActivity.date}` : ""}.csv`,
      visibleRows.length
    );
  };

  const weeklyRows = weekly ? filterWeeklyRows(weekly.rows, weeklyFilter) : [];

  const exportWeeklyCsv = () => {
    if (!weekly || weeklyRows.length === 0) {
      return;
    }
    const headers = [
      "Volunteer",
      "Volunteer type",
      ...weekly.days.map((day) => `${formatActivityDate(day, { weekday: "short" })} ${day}`),
      "Total hours",
      `ESC check (${ESC_RULES.minWeeklyHours}-${ESC_RULES.maxWeeklyHours}h)`,
    ];
    const lines = weeklyRows.map((row) => [
      fullName(row.volunteer),
      row.volunteer.volunteerType ? VOLUNTEER_TYPE_LABELS[row.volunteer.volunteerType] : "",
      ...row.days.map((hours) => formatHoursNumber(hours)),
      formatHoursNumber(row.total),
      row.escStatus ? ESC_STATUS_LABELS[row.escStatus] : "",
    ]);
    const totals = [
      "Daily total",
      "",
      ...weekly.days.map((_, index) => formatHoursNumber(weeklyRows.reduce((sum, row) => sum + row.days[index], 0))),
      formatHoursNumber(weeklyRows.reduce((sum, row) => sum + row.total, 0)),
      "",
    ];
    downloadCsv([headers, ...lines, totals], `weekly-hours-${weekly.days[0]}.csv`, weeklyRows.length);
  };

  const timeRange = currentActivity
    ? [formatTime(currentActivity.startTime), formatTime(currentActivity.endTime)].filter(Boolean).join(" – ")
    : "";

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full print:p-0 print:space-y-4 print:text-black">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-emerald-400" />
            Attendance Recorder
          </h1>
          <p className="text-slate-400 mt-1 flex flex-wrap items-center gap-2">
            {canManage
              ? "Record volunteer participation and hours for each activity."
              : "View volunteer participation for each activity."}
            {!canManage && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-700 bg-slate-800 text-slate-300">
                <Eye className="h-3 w-3" /> View only
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
          {activeView === "weekly" && weekly && (
            <>
              <button
                type="button"
                onClick={exportWeeklyCsv}
                disabled={weeklyRows.length === 0}
                title={weeklyRows.length === 0 ? "There are no rows to export" : "Export the weekly hours shown below"}
                className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all duration-200"
              >
                <Printer className="h-4 w-4" /> Print / PDF
              </button>
            </>
          )}
          {activeView === "activity" && currentActivity && (
            <>
              <button
                type="button"
                onClick={exportCsv}
                disabled={visibleRows.length === 0}
                title={visibleRows.length === 0 ? "There are no rows to export" : "Export the rows shown below"}
                className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all duration-200"
              >
                <Printer className="h-4 w-4" /> Print / PDF
              </button>
            </>
          )}
        </div>
      </div>

      {canManage && !loadError && (
        <div
          role="tablist"
          aria-label="Attendance views"
          className="inline-flex w-full sm:w-auto rounded-xl border border-slate-800 bg-slate-900 p-1 print:hidden"
        >
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const selected = activeView === id;
            return (
              <button
                key={id}
                id={`attendance-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="attendance-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => handleViewChange(id)}
                onKeyDown={handleTabKeyDown}
                className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  selected ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            );
          })}
        </div>
      )}

      {activeView === "activity" && currentActivity && (
        <div className="hidden print:block space-y-1">
          <h1 className="text-2xl font-bold">Attendance: {currentActivity.title}</h1>
          <p className="text-sm">
            {[formatActivityDate(currentActivity.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }), timeRange, currentActivity.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-sm">
            Present {counts.Present} · Late {counts.Late} · Absent {counts.Absent} · Unmarked {counts.Unmarked} · Hours
            logged {formatHours(totalHours) || "0h"}
          </p>
        </div>
      )}

      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm print:hidden ${
            notice.type === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          <span className="flex items-start gap-2">
            {notice.type === "error" ? (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            {notice.message}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
            className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loadError ? (
        <div
          role="alert"
          className="bg-slate-950/40 border border-rose-500/20 rounded-2xl p-10 md:p-16 flex flex-col items-center text-center gap-4"
        >
          <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Attendance could not be loaded</h2>
          <p className="text-sm text-slate-400 max-w-md">{loadError}</p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isRefreshing ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : activeView === "weekly" ? (
        <div id="attendance-panel" role="tabpanel" aria-labelledby="attendance-tab-weekly">
          <WeeklyHoursView
            weekly={weekly}
            weekStart={weekStart}
            todayKey={todayKey}
            isCurrentWeek={Boolean(weekStart) && weekStart === currentWeekStart}
            hasVolunteers={volunteers.length > 0}
            filter={weeklyFilter}
            onFilterChange={setWeeklyFilter}
            onWeekChange={handleWeekChange}
            onOpenActivity={openActivity}
          />
        </div>
      ) : !currentActivity ? (
        <div
          id="attendance-panel"
          role={canManage ? "tabpanel" : undefined}
          aria-labelledby={canManage ? "attendance-tab-activity" : undefined}
          className="bg-slate-950/40 border border-slate-900 rounded-2xl p-10 md:p-16 flex flex-col items-center text-center gap-4"
        >
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CalendarPlus className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">No activities yet</h2>
          <p className="text-sm text-slate-400 max-w-md">
            Attendance is recorded per activity.{" "}
            {canManage
              ? "Create your first activity, then come back here to check volunteers in."
              : "Once your team schedules an activity, its attendance will show up here."}
          </p>
          {canManage && (
            <Link
              href="/activities?new=1"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              <CalendarPlus className="h-4 w-4" /> Create an activity
            </Link>
          )}
        </div>
      ) : (
        <div
          id="attendance-panel"
          role={canManage ? "tabpanel" : undefined}
          aria-labelledby={canManage ? "attendance-tab-activity" : undefined}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          <div className="space-y-6 print:hidden">
            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-4">
              <label
                htmlFor="attendance-activity"
                className="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
              >
                Activity
              </label>
              <div className="relative">
                <select
                  id="attendance-activity"
                  value={activityId}
                  onChange={(e) => handleActivityChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer font-medium"
                >
                  {groupedActivities.map((group) => (
                    <optgroup key={group.status} label={group.status}>
                      {group.items.map((activity) => (
                        <option key={activity._id} value={activity._id}>
                          {activity.title} · {formatActivityDate(activity.date, { month: "short", day: "numeric", year: "numeric" })}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              </div>
              <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    {formatActivityDate(currentActivity.date, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ACTIVITY_STATUS_CLASSES[currentActivity.status]}`}
                  >
                    {currentActivity.status}
                  </span>
                </div>
                {timeRange && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-500" /> {timeRange}
                    {currentDefaultHours !== undefined && (
                      <span className="text-slate-500">· {formatHours(currentDefaultHours)} per volunteer</span>
                    )}
                  </div>
                )}
                {currentActivity.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-500" /> {currentActivity.location}
                  </div>
                )}
                {capacity > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    <span>
                      {checkedInCount} / {capacity} checked in
                      {checkedInCount >= capacity && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-amber-500/20 bg-amber-500/10 text-amber-400">
                          Full
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white tracking-tight">Attendance Metrics</h2>

              <div className="flex flex-col items-center py-2">
                <div className="relative h-32 w-32 flex items-center justify-center">
                  <svg className="absolute -rotate-90 w-full h-full" viewBox="0 0 128 128" aria-hidden="true">
                    <circle cx="64" cy="64" r={RING_RADIUS} className="stroke-slate-800" strokeWidth="10" fill="transparent" />
                    <circle
                      cx="64"
                      cy="64"
                      r={RING_RADIUS}
                      className="stroke-emerald-400 transition-all duration-500 ease-out"
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={RING_CIRCUMFERENCE * (1 - attendanceRate / 100)}
                      strokeLinecap="round"
                      opacity={markedCount > 0 ? 1 : 0}
                    />
                  </svg>
                  <div className="text-center space-y-0.5">
                    <span className="text-3xl font-extrabold text-white tracking-tight">
                      {markedCount > 0 ? `${attendanceRate}%` : "—"}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Turnout</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-3 text-center">
                  {markedCount > 0
                    ? `Present or late, out of ${markedCount} marked`
                    : "No attendance recorded yet"}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {(
                  [
                    { status: "Present", dot: "bg-emerald-400" },
                    { status: "Late", dot: "bg-amber-400" },
                    { status: "Absent", dot: "bg-rose-400" },
                    { status: "Unmarked", dot: "bg-slate-500" },
                  ] as const
                ).map((metric) => (
                  <div key={metric.status} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${metric.dot}`} /> {metric.status}
                    </span>
                    <span className="text-white font-bold">
                      {counts[metric.status]} / {roster.length}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm border-t border-slate-800/60 pt-4">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5 text-emerald-400" /> Hours logged
                  </span>
                  <span className="text-white font-bold tabular-nums">{formatHours(totalHours) || "0h"}</span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleViewChange("weekly")}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <CalendarRange className="h-3.5 w-3.5" /> Weekly hours &amp; ESC check
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-6 print:border-0 print:bg-transparent print:p-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, country or skill..."
                    aria-label="Search volunteers"
                    className="w-full pl-9 pr-8 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-500 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      aria-pressed={statusFilter === filter}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        statusFilter === filter
                          ? "bg-slate-900 text-white border-slate-800"
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {filter}
                      <span className="ml-1 text-[10px] text-slate-500">
                        {filter === "All" ? roster.length : counts[filter]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {canManage && selectedVisibleIds.length > 0 && (
                <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
                  <span className="text-xs text-slate-300 font-semibold flex items-center gap-2">
                    <span>
                      Mark <span className="text-white font-bold">{selectedVisibleIds.length}</span> selected volunteer
                      {selectedVisibleIds.length === 1 ? "" : "s"} as
                    </span>
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={bulkStatus !== null}
                      className="text-slate-500 hover:text-white underline underline-offset-2 disabled:opacity-50"
                    >
                      Clear
                    </button>
                    {currentDefaultHours !== undefined && (
                      <span className="hidden sm:inline text-[10px] font-normal text-slate-500">
                        New check-ins log {formatHours(currentDefaultHours)}
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {STATUS_OPTIONS.map(({ value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleBulkMark(value)}
                        disabled={bulkStatus !== null}
                        className={`flex items-center gap-1.5 p-1.5 px-3 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${BULK_BUTTON_CLASSES[value]}`}
                      >
                        {bulkStatus === value && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20 print:text-black">
                      {canManage && (
                        <th className="py-4 px-4 w-10 print:hidden">
                          <input
                            type="checkbox"
                            aria-label="Select all shown volunteers"
                            checked={allVisibleSelected}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = someVisibleSelected;
                              }
                            }}
                            disabled={visibleRows.length === 0 || bulkStatus !== null}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </th>
                      )}
                      <th className="py-4 px-4">Volunteer</th>
                      <th className="py-4 px-4">Country</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-4">Check-in</th>
                      <th className="py-4 px-4">Hours</th>
                      {canManage && <th className="py-4 px-4 text-right print:hidden">Mark</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/40 text-sm">
                    {roster.length === 0 ? (
                      <tr>
                        <td colSpan={columnCount} className="py-12 px-4">
                          <div className="flex flex-col items-center text-center gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <UserPlus className="h-6 w-6 text-emerald-400" />
                            </div>
                            <p className="text-sm font-bold text-white">
                              {volunteers.length === 0 ? "No volunteers yet" : "No active volunteers"}
                            </p>
                            <p className="text-xs text-slate-400 max-w-sm">
                              {volunteers.length === 0
                                ? "Add volunteers to start recording who attends this activity."
                                : "All volunteers are marked inactive. Reactivate them to record their attendance."}
                            </p>
                            {canManage && (
                              <Link
                                href={volunteers.length === 0 ? "/volunteers?new=1" : "/volunteers"}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors print:hidden"
                              >
                                <UserPlus className="h-4 w-4" />
                                {volunteers.length === 0 ? "Add volunteers" : "Manage volunteers"}
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={columnCount} className="py-10 px-4 text-center">
                          <p className="text-xs text-slate-500">No volunteers match your search or filter.</p>
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:text-white print:hidden"
                          >
                            Clear filters
                          </button>
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row) => {
                        const { volunteer, record, status } = row;
                        const isSaving = savingKeys.includes(recordKey(activityId, volunteer._id));
                        const isSelected = selectedSet.has(volunteer._id);
                        const checkIn = formatCheckIn(record?.checkInTime, hydrated, {
                          activityDate: currentActivity.date,
                        });
                        const hours = hoursByVolunteer.get(volunteer._id);
                        return (
                          <tr
                            key={volunteer._id}
                            className={`transition-colors ${isSelected ? "bg-emerald-500/5" : "hover:bg-slate-950/20"}`}
                          >
                            {canManage && (
                              <td className="py-4 px-4 print:hidden">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${fullName(volunteer)}`}
                                  checked={isSelected}
                                  disabled={bulkStatus !== null}
                                  onChange={(e) => handleSelectRow(e.target.checked, volunteer._id)}
                                  className="rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                            )}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 print:hidden">
                                  {initials(volunteer)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white print:text-black flex items-center gap-2">
                                    {fullName(volunteer)}
                                    {!volunteer.active && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-slate-700 bg-slate-800 text-slate-400">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                  {volunteer.email ? (
                                    <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">{volunteer.email}</div>
                                  ) : (
                                    volunteer.skills &&
                                    volunteer.skills.length > 0 && (
                                      <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                                        {volunteer.skills.slice(0, 2).join(", ")}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-slate-400 print:text-black">{volunteer.country || "—"}</td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_BADGE_CLASSES[status]}`}
                                >
                                  {status}
                                </span>
                                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" aria-label="Saving" />}
                              </div>
                              {record?.notes && (
                                <p
                                  className="text-[11px] text-slate-500 italic truncate max-w-[12rem] mt-1 print:whitespace-normal print:text-black"
                                  title={record.notes}
                                >
                                  {record.notes}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-slate-400 font-medium print:text-black">
                              <span title={formatCheckIn(record?.checkInTime, hydrated, { withDate: true }) || undefined}>
                                {checkIn || "—"}
                              </span>
                              {record?.recordedBy && (
                                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                                  by {record.recordedBy}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-slate-300 font-semibold tabular-nums whitespace-nowrap print:text-black">
                              {hours === undefined ? (
                                <span className="text-slate-600 font-medium">—</span>
                              ) : canManage ? (
                                <button
                                  type="button"
                                  onClick={() => openEditor(row, "hours")}
                                  disabled={isSaving}
                                  aria-label={`Edit hours for ${fullName(volunteer)} (${formatHours(hours)})`}
                                  title="Edit hours"
                                  className="group -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {formatHours(hours)}
                                  <Pencil className="h-3 w-3 text-slate-600 group-hover:text-slate-300 print:hidden" />
                                </button>
                              ) : (
                                formatHours(hours)
                              )}
                            </td>
                            {canManage && (
                              <td className="py-4 px-4 text-right print:hidden">
                                <div className="inline-flex items-center gap-1.5">
                                  <div className="inline-flex rounded-lg border border-slate-800 p-0.5 bg-slate-900">
                                    {STATUS_OPTIONS.map(({ value, icon: Icon, activeClass }) => (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() => handleMark(row, value)}
                                        disabled={isSaving}
                                        aria-pressed={status === value}
                                        aria-label={`Mark ${fullName(volunteer)} ${value.toLowerCase()}`}
                                        title={`Mark ${value}`}
                                        className={`p-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                          status === value ? activeClass : "text-slate-500 hover:text-white"
                                        }`}
                                      >
                                        <Icon className="h-4 w-4" />
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openEditor(row)}
                                    disabled={isSaving}
                                    aria-label={`${record?.notes ? "Edit" : "Add"} hours and note for ${fullName(volunteer)}`}
                                    title={record?.notes ? "Edit hours & note" : "Hours & note"}
                                    className={`p-1.5 rounded-lg border border-slate-800 bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                      record?.notes ? "text-emerald-400" : "text-slate-500 hover:text-white"
                                    }`}
                                  >
                                    <StickyNote className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm print:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeEditor();
            }
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-editor-title"
            onSubmit={(e) => {
              e.preventDefault();
              handleEditorSave();
            }}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="attendance-editor-title" className="text-lg font-bold text-white tracking-tight">
                  Attendance details
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {fullName(editor.volunteer)} ·{" "}
                  {activities.find((activity) => activity._id === editor.activityId)?.title ?? "Activity"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                disabled={editor.saving}
                aria-label="Close"
                className="rounded-lg p-1 text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</legend>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map(({ value, icon: Icon, activeClass }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEditor({ ...editor, status: value, error: null, errorField: null })}
                    disabled={editor.saving}
                    aria-pressed={editor.status === value}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-60 ${
                      editor.status === value
                        ? `${activeClass} border-current`
                        : "border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {value}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label
                htmlFor="attendance-hours"
                className="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
              >
                Hours
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-28">
                  <input
                    ref={hoursRef}
                    id="attendance-hours"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={editor.status === "Absent" ? "" : editor.hours}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        hours: e.target.value,
                        error: editor.errorField === "hours" ? null : editor.error,
                        errorField: editor.errorField === "hours" ? null : editor.errorField,
                      })
                    }
                    disabled={editor.saving || editor.status === "Absent"}
                    autoFocus={editor.focus === "hours"}
                    placeholder={
                      editor.status === "Absent"
                        ? "—"
                        : editor.defaultHours !== undefined
                          ? formatHoursNumber(editor.defaultHours)
                          : "0"
                    }
                    aria-invalid={editor.errorField === "hours"}
                    aria-describedby="attendance-hours-hint"
                    className={`w-full bg-slate-950/60 border rounded-xl pl-3 pr-8 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      editor.errorField === "hours"
                        ? "border-rose-500/60 focus:border-rose-500"
                        : "border-slate-800 focus:border-emerald-500/50"
                    }`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    h
                  </span>
                </div>
                {editor.status !== "Absent" &&
                  editor.defaultHours !== undefined &&
                  editor.hours.trim() !== formatHoursNumber(editor.defaultHours) && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          ...editor,
                          hours: formatHoursNumber(editor.defaultHours ?? 0),
                          error: editor.errorField === "hours" ? null : editor.error,
                          errorField: editor.errorField === "hours" ? null : editor.errorField,
                        })
                      }
                      disabled={editor.saving}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Use activity duration ({formatHours(editor.defaultHours)})
                    </button>
                  )}
              </div>
              <p id="attendance-hours-hint" className="text-[11px] text-slate-500">
                {editor.status === "Absent"
                  ? "Absent volunteers don't log hours."
                  : `0–${MAX_HOURS} in 15-minute steps (e.g. 2.5 or 2.75). ${
                      editor.defaultHours !== undefined
                        ? `Leave empty to use the activity's duration (${formatHours(editor.defaultHours)}).`
                        : "This activity has no valid start and end time, so there is no default."
                    }`}
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="attendance-notes"
                className="text-xs font-semibold text-slate-400 uppercase tracking-wider block"
              >
                Notes <span className="normal-case font-normal text-slate-500">(optional, visible to staff only)</span>
              </label>
              <textarea
                ref={notesRef}
                id="attendance-notes"
                rows={4}
                maxLength={MAX_NOTES_LENGTH}
                value={editor.notes}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    notes: e.target.value,
                    error: editor.errorField === "hours" ? editor.error : null,
                    errorField: editor.errorField === "hours" ? "hours" : null,
                  })
                }
                disabled={editor.saving}
                autoFocus={editor.focus === "notes"}
                placeholder="e.g. Left early to help with transport"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-y"
              />
              <p className="text-right text-[10px] text-slate-500">
                {editor.notes.length} / {MAX_NOTES_LENGTH}
              </p>
            </div>

            {editor.error && (
              <p role="alert" className="flex items-start gap-1.5 text-xs text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {editor.error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                disabled={editor.saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editor.saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {editor.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editor.saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
