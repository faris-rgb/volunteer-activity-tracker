"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  FolderKanban,
  Languages,
  List,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  SquareKanban,
  SquarePen,
  Trash,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import {
  deleteVolunteerAction,
  setVolunteerActiveAction,
  updateVolunteerStageAction,
  type VolunteerData,
} from "@/app/actions/volunteers";
import {
  ESC_RULES,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  VOLUNTEER_TYPE_LABELS,
  VOLUNTEER_TYPES,
  type PipelineStage,
  type VolunteerType,
} from "@/lib/domain";
import { formatDateKey, toDateKey } from "@/lib/dates";
import VolunteerFormDialog from "./VolunteerFormDialog";
import PipelineBoard from "./PipelineBoard";
import WhatsAppMenu from "./WhatsAppMenu";
import { AgeBadge, MembershipBadge, StageBadge, TypeBadge } from "./VolunteerBadges";
import {
  DIET_LABELS,
  MEMBERSHIP_STATE_LABELS,
  SHORT_SOURCE_LABELS,
  callAction,
  fullName,
  getAge,
  getMembershipState,
  hasEscAgeIssue,
  initials,
  plural,
  type VolunteerPresets,
} from "./volunteerUtils";

export type VolunteerView = "list" | "pipeline";

interface VolunteersClientProps {
  initialVolunteers: VolunteerData[];
  canManage: boolean;
  /** Emergency contact details (owner, admin, staff). */
  canViewEmergency: boolean;
  /** Medical notes (owner, admin). */
  canViewMedical: boolean;
  loadError?: string | null;
  defaultCountry: string;
  presets: VolunteerPresets;
  /** Today's date (YYYY-MM-DD) in Morocco, used for ages and membership states. */
  today: string;
  initialView: VolunteerView;
  openCreateOnLoad: boolean;
}

type StatusFilter = "all" | "active" | "inactive";
type TypeFilter = "all" | VolunteerType | "unset";
type StageFilter = "all" | "open" | PipelineStage | "unset";
type MembershipFilter = "all" | "paid" | "attention" | "expired" | "unpaid" | "none";
type SortOrder = "name-asc" | "name-desc" | "newest" | "oldest";

interface Notice {
  type: "success" | "error";
  message: string;
  link?: { href: string; label: string };
}

const PAGE_SIZE = 10;
/** Stages of applications that still need a decision or preparation. */
const OPEN_STAGES: PipelineStage[] = ["lead", "meeting", "accepted"];

const MEMBERSHIP_FILTER_LABELS: Record<MembershipFilter, string> = {
  all: "All memberships",
  paid: "Members · paid",
  attention: "Expired or unpaid",
  expired: "Expired only",
  unpaid: "Unpaid only",
  none: "Not a member",
};

const FILTER_SELECT_CLASS =
  "w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50";

/**
 * Quotes a CSV value and prefixes it with an apostrophe when a spreadsheet would otherwise
 * evaluate it as a formula (CSV injection) or, with `forceText`, convert it to a number.
 */
function csvCell(value: string | number | undefined | null, { forceText = false } = {}): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text) || (forceText && text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/** Incoming ESC volunteer outside 18-30 who is still in (or before) their placement. */
function needsAgeCheck(vol: VolunteerData, today: string) {
  return vol.pipelineStage !== "withdrawn" && vol.pipelineStage !== "completed" && hasEscAgeIssue(vol, today);
}

function matchesMembership(vol: VolunteerData, filter: MembershipFilter, today: string) {
  if (filter === "all") return true;
  const state = getMembershipState(vol.membership, today);
  switch (filter) {
    case "paid":
      return state === "active";
    case "attention":
      return state === "expired" || state === "unpaid";
    default:
      return state === filter;
  }
}

function matchesStage(vol: VolunteerData, filter: StageFilter) {
  if (filter === "all") return true;
  if (filter === "open") return !!vol.pipelineStage && OPEN_STAGES.includes(vol.pipelineStage);
  if (filter === "unset") return !vol.pipelineStage;
  return vol.pipelineStage === filter;
}

function replaceUrlParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export default function VolunteersClient({
  initialVolunteers,
  canManage,
  canViewEmergency,
  canViewMedical,
  loadError,
  defaultCountry,
  presets,
  today,
  initialView,
  openCreateOnLoad,
}: VolunteersClientProps) {
  const router = useRouter();
  const [volunteers, setVolunteers] = useState<VolunteerData[]>(initialVolunteers);
  const [syncedVolunteers, setSyncedVolunteers] = useState<VolunteerData[]>(initialVolunteers);
  if (initialVolunteers !== syncedVolunteers) {
    setSyncedVolunteers(initialVolunteers);
    setVolunteers(initialVolunteers);
  }

  const [view, setView] = useState<VolunteerView>(initialView);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>("all");
  const [ageIssueOnly, setAgeIssueOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("name-asc");
  const [page, setPage] = useState(1);

  const [isFormOpen, setIsFormOpen] = useState(openCreateOnLoad);
  /** Snapshot of the volunteer being edited (null while registering a new one). */
  const [formVolunteer, setFormVolunteer] = useState<VolunteerData | null>(null);
  const [formKey, setFormKey] = useState(0);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteTarget = deleteTargetId ? volunteers.find((vol) => vol._id === deleteTargetId) ?? null : null;

  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const [syncedOpenCreate, setSyncedOpenCreate] = useState(openCreateOnLoad);
  if (openCreateOnLoad !== syncedOpenCreate) {
    setSyncedOpenCreate(openCreateOnLoad);
    if (openCreateOnLoad && !isFormOpen) {
      setFormVolunteer(null);
      setFormKey((key) => key + 1);
      setIsFormOpen(true);
    }
  }

  useEffect(() => {
    if (openCreateOnLoad) replaceUrlParam("new", null);
  }, [openCreateOnLoad]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(
      () => setNotice(null),
      notice.type === "success" && !notice.link ? 4000 : 8000
    );
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!deleteTarget) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) setDeleteTargetId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget, isDeleting]);

  const upsertVolunteer = (vol: VolunteerData) => {
    setVolunteers((prev) =>
      prev.some((item) => item._id === vol._id)
        ? prev.map((item) => (item._id === vol._id ? vol : item))
        : [vol, ...prev]
    );
  };

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openCreateForm = () => {
    setFormVolunteer(null);
    setFormKey((key) => key + 1);
    setIsFormOpen(true);
  };

  const openEditForm = (vol: VolunteerData) => {
    setFormVolunteer(vol);
    setFormKey((key) => key + 1);
    setIsFormOpen(true);
  };

  const closeForm = () => setIsFormOpen(false);

  const handleSaved = (vol: VolunteerData, created: boolean) => {
    upsertVolunteer(vol);
    setIsFormOpen(false);
    const ageNote = hasEscAgeIssue(vol, today)
      ? ` Note: outside the ESC age range (${ESC_RULES.minAge}-${ESC_RULES.maxAge}).`
      : "";
    setNotice({
      type: "success",
      message: created
        ? `${fullName(vol)} was added to the directory.${ageNote}`
        : `Saved changes to ${fullName(vol)}.${ageNote}`,
    });
  };

  const handleToggleActive = async (vol: VolunteerData) => {
    if (busyIds.has(vol._id)) return;

    setBusy(vol._id, true);
    const result = await callAction(() => setVolunteerActiveAction(vol._id, !vol.active));
    setBusy(vol._id, false);

    if (!result.ok) {
      setNotice({ type: "error", message: result.error });
      return;
    }

    upsertVolunteer(result.data);
    setNotice({
      type: "success",
      message: `${fullName(result.data)} is now ${result.data.active ? "active" : "inactive"}.`,
    });
  };

  const handleMoveStage = async (vol: VolunteerData, stage: PipelineStage) => {
    if (busyIds.has(vol._id) || vol.pipelineStage === stage) return;

    setBusy(vol._id, true);
    const result = await callAction(() => updateVolunteerStageAction(vol._id, stage));
    setBusy(vol._id, false);

    if (!result.ok) {
      setNotice({ type: "error", message: result.error });
      return;
    }

    const moved = result.data;
    upsertVolunteer(moved);
    const ageNote =
      stage === "accepted" && hasEscAgeIssue(moved, today)
        ? ` Check eligibility: outside the ESC age range (${ESC_RULES.minAge}-${ESC_RULES.maxAge}).`
        : "";
    const needsStay =
      (stage === "accepted" || stage === "arrived") &&
      (moved.volunteerType === "incoming_esc" || moved.volunteerType === "domestic");
    setNotice({
      type: "success",
      message: `${fullName(moved)} moved to ${PIPELINE_STAGE_LABELS[stage]}.${ageNote}`,
      link: needsStay ? { href: "/stays", label: "Plan their stay" } : undefined,
    });
  };

  const openDeleteDialog = (vol: VolunteerData) => {
    setDeleteError(null);
    setDeleteTargetId(vol._id);
  };

  const closeDeleteDialog = () => {
    if (!isDeleting) setDeleteTargetId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    const target = deleteTarget;

    setDeleteError(null);
    setIsDeleting(true);
    const result = await callAction(() => deleteVolunteerAction(target._id, target.attendanceCount ?? 0));
    setIsDeleting(false);

    if (!result.ok) {
      if ("attendanceCount" in result) {
        const { attendanceCount } = result;
        setVolunteers((prev) => prev.map((vol) => (vol._id === target._id ? { ...vol, attendanceCount } : vol)));
      }
      setDeleteError(result.error);
      return;
    }

    setVolunteers((prev) => prev.filter((vol) => vol._id !== result.data.id));
    setDeleteTargetId(null);
    const removed = result.data.removedAttendance;
    setNotice({
      type: "success",
      message: `${fullName(target)} was deleted${removed > 0 ? ` along with ${plural(removed, "attendance record")}` : ""}.`,
    });
  };

  const handleDeactivateInstead = () => {
    if (!deleteTarget || isDeleting) return;
    const target = deleteTarget;
    setDeleteTargetId(null);
    void handleToggleActive(target);
  };

  const handleRetry = () => {
    startRefresh(() => router.refresh());
  };

  const handleWhatsAppOpened = (message: string) => {
    setNotice({ type: "success", message });
  };

  const changeView = (next: VolunteerView) => {
    setView(next);
    replaceUrlParam("view", next === "pipeline" ? "pipeline" : null);
  };

  /** Every filter except the stage (the pipeline view shows all stages as columns). */
  const baseFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = volunteers.filter((vol) => {
      if (statusFilter === "active" && !vol.active) return false;
      if (statusFilter === "inactive" && vol.active) return false;
      if (typeFilter === "unset" ? !!vol.volunteerType : typeFilter !== "all" && vol.volunteerType !== typeFilter) {
        return false;
      }
      if (!matchesMembership(vol, membershipFilter, today)) return false;
      if (ageIssueOnly && !needsAgeCheck(vol, today)) return false;
      if (!query) return true;
      return [
        fullName(vol),
        vol.email,
        vol.phoneNumber,
        vol.city,
        vol.country,
        vol.nationality,
        vol.appliedProjectName,
        ...(vol.skills ?? []),
        ...(vol.languages ?? []),
      ].some((field) => field?.toLowerCase().includes(query));
    });

    result.sort((a, b) => {
      if (sortOrder === "newest") return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      if (sortOrder === "oldest") return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
      const comparison = fullName(a).localeCompare(fullName(b), "en", { sensitivity: "base" });
      return sortOrder === "name-asc" ? comparison : -comparison;
    });

    return result;
  }, [volunteers, search, statusFilter, typeFilter, membershipFilter, ageIssueOnly, sortOrder, today]);

  const filteredVolunteers = useMemo(
    () => (view === "list" ? baseFiltered.filter((vol) => matchesStage(vol, stageFilter)) : baseFiltered),
    [baseFiltered, stageFilter, view]
  );

  const stats = useMemo(() => {
    let activeCount = 0;
    let openCount = 0;
    let renewCount = 0;
    let ageIssueCount = 0;
    for (const vol of volunteers) {
      if (vol.active) activeCount += 1;
      if (matchesStage(vol, "open")) openCount += 1;
      if (matchesMembership(vol, "attention", today)) renewCount += 1;
      if (needsAgeCheck(vol, today)) ageIssueCount += 1;
    }
    return { total: volunteers.length, activeCount, openCount, renewCount, ageIssueCount };
  }, [volunteers, today]);

  const totalPages = Math.max(1, Math.ceil(filteredVolunteers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageVolunteers = filteredVolunteers.slice(pageStart, pageStart + PAGE_SIZE);
  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    (view === "list" && stageFilter !== "all") ||
    membershipFilter !== "all" ||
    ageIssueOnly;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setStageFilter("all");
    setMembershipFilter("all");
    setAgeIssueOnly(false);
    setPage(1);
  };

  const handleExport = () => {
    if (filteredVolunteers.length === 0) return;

    const header = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "City",
      "Country",
      "Nationality",
      "Type",
      "Date of Birth",
      "Age",
      "Pipeline Stage",
      "Source",
      "Applied Project",
      "Membership",
      "Member Since",
      "Paid Until",
      "Diet",
      "Status",
      "Skills",
      "Languages",
      "Attendance Records",
      "Registered",
    ];
    const rows = filteredVolunteers.map((vol) => [
      csvCell(vol.firstName),
      csvCell(vol.lastName),
      csvCell(vol.email),
      csvCell(vol.phoneNumber, { forceText: true }),
      csvCell(vol.city),
      csvCell(vol.country),
      csvCell(vol.nationality),
      csvCell(vol.volunteerType ? VOLUNTEER_TYPE_LABELS[vol.volunteerType] : ""),
      csvCell(vol.dateOfBirth),
      csvCell(getAge(vol.dateOfBirth, today) ?? ""),
      csvCell(vol.pipelineStage ? PIPELINE_STAGE_LABELS[vol.pipelineStage] : ""),
      csvCell(vol.source ? SHORT_SOURCE_LABELS[vol.source] : ""),
      csvCell(vol.appliedProjectName),
      csvCell(MEMBERSHIP_STATE_LABELS[getMembershipState(vol.membership, today)]),
      csvCell(vol.membership?.memberSince),
      csvCell(vol.membership?.paidUntil),
      csvCell(vol.diet ? DIET_LABELS[vol.diet] : ""),
      csvCell(vol.active ? "Active" : "Inactive"),
      csvCell((vol.skills ?? []).join("; ")),
      csvCell((vol.languages ?? []).join("; ")),
      csvCell(vol.attendanceCount),
      csvCell(toDateKey(vol.createdAt)),
    ]);
    const csv = [header.map((label) => csvCell(label)), ...rows].map((row) => row.join(",")).join("\r\n");

    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `volunteers-${formatDateKey(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);

    setNotice({ type: "success", message: `Exported ${plural(rows.length, "volunteer")} to CSV.` });
  };

  const statCards: {
    key: string;
    label: string;
    value: number;
    valueClass: string;
    pressed: boolean;
    onClick: () => void;
  }[] = [
    {
      key: "total",
      label: "Total Registered",
      value: stats.total,
      valueClass: "text-white",
      pressed: !hasFilters,
      onClick: clearFilters,
    },
    {
      key: "active",
      label: "Active",
      value: stats.activeCount,
      valueClass: "text-emerald-400",
      pressed: statusFilter === "active",
      onClick: () => {
        setStatusFilter((prev) => (prev === "active" ? "all" : "active"));
        setPage(1);
      },
    },
    {
      key: "open",
      label: "Open Applications",
      value: stats.openCount,
      valueClass: "text-sky-300",
      pressed: view === "list" && stageFilter === "open",
      onClick: () => {
        const turnOn = !(view === "list" && stageFilter === "open");
        setStageFilter(turnOn ? "open" : "all");
        if (turnOn) changeView("list");
        setPage(1);
      },
    },
    {
      key: "renew",
      label: "Membership to Renew",
      value: stats.renewCount,
      valueClass: stats.renewCount > 0 ? "text-amber-300" : "text-slate-400",
      pressed: membershipFilter === "attention",
      onClick: () => {
        setMembershipFilter((prev) => (prev === "attention" ? "all" : "attention"));
        setPage(1);
      },
    },
  ];

  const deleteAttendanceCount = deleteTarget?.attendanceCount ?? 0;

  const renderRowActions = (vol: VolunteerData) => {
    const name = fullName(vol);
    const isBusy = busyIds.has(vol._id);
    return (
      <div className="flex items-center justify-end gap-1">
        <WhatsAppMenu
          firstName={vol.firstName}
          name={name}
          phone={vol.phoneNumber}
          templates={presets.whatsappTemplates}
          organizationName={presets.organizationName}
          onOpened={handleWhatsAppOpened}
        />
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => handleToggleActive(vol)}
              disabled={isBusy}
              className={`p-1.5 rounded-lg text-slate-400 hover:bg-slate-900 disabled:opacity-50 transition-colors ${
                vol.active ? "hover:text-amber-400" : "hover:text-emerald-400"
              }`}
              title={vol.active ? "Deactivate" : "Activate"}
              aria-label={`${vol.active ? "Deactivate" : "Activate"} ${name}`}
            >
              {isBusy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : vol.active ? (
                <UserX className="h-4 w-4" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => openEditForm(vol)}
              disabled={isBusy}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
              title="Edit"
              aria-label={`Edit ${name}`}
            >
              <SquarePen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openDeleteDialog(vol)}
              disabled={isBusy}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 disabled:opacity-50 transition-colors"
              title="Delete"
              aria-label={`Delete ${name}`}
            >
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    );
  };

  const activeBadge = (vol: VolunteerData) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
        vol.active
          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          : "text-slate-400 bg-slate-800 border-slate-700/50"
      }`}
    >
      {vol.active ? <CircleCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {vol.active ? "Active" : "Inactive"}
    </span>
  );

  const contactLinks = (vol: VolunteerData) => (
    <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-slate-500 text-xs mt-0.5 min-w-0">
      {vol.email && (
        <a
          href={`mailto:${vol.email}`}
          className="flex items-center gap-1 hover:text-emerald-400 transition-colors min-w-0"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{vol.email}</span>
        </a>
      )}
      {vol.phoneNumber && (
        <a
          href={`tel:${vol.phoneNumber.replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {vol.phoneNumber}
        </a>
      )}
    </div>
  );

  const emptyDirectory = (
    <div className="px-6 py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
        <UserPlus className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-lg font-bold text-white">
        {loadError ? "Volunteer data is unavailable" : "No volunteers yet"}
      </h2>
      <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
        {loadError
          ? "The directory could not be loaded right now. Retry once the connection is restored."
          : canManage
            ? "Register your first volunteer, or share the join page so applicants land here as “Applied” in the pipeline."
            : "Volunteers registered by your team will appear here."}
      </p>
      {loadError ? (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isRefreshing}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Retrying..." : "Retry"}
        </button>
      ) : (
        canManage && (
          <button
            type="button"
            onClick={openCreateForm}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Add your first volunteer
          </button>
        )
      )}
    </div>
  );

  const noMatches = (
    <div className="py-12 px-6 text-center">
      <SearchX className="h-8 w-8 text-slate-600 mx-auto" />
      <p className="mt-3 text-sm text-slate-400">No volunteers match your search or filters.</p>
      <button
        type="button"
        onClick={clearFilters}
        className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
      >
        Clear filters
      </button>
    </div>
  );

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400 shrink-0" />
            Volunteer Directory
          </h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Applications, profiles, memberships and contact details in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredVolunteers.length === 0}
            title="Download the volunteers currently shown as a CSV file"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              Add Volunteer
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      {/* Summary Metrics (click to filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <button
            key={card.key}
            type="button"
            aria-pressed={card.pressed}
            onClick={card.onClick}
            className={`text-left bg-slate-950/40 border rounded-xl p-4 transition-colors ${
              card.pressed ? "border-emerald-500/40" : "border-slate-900 hover:border-slate-800"
            }`}
          >
            <span className="text-[11px] sm:text-xs text-slate-500 uppercase tracking-wider block font-semibold">
              {card.label}
            </span>
            <span className={`text-2xl font-bold block mt-1 ${card.valueClass}`}>{card.value}</span>
          </button>
        ))}
      </div>

      {stats.ageIssueCount > 0 && !ageIssueOnly && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" />
            {stats.ageIssueCount === 1
              ? "1 international (ESC) volunteer is"
              : `${stats.ageIssueCount} international (ESC) volunteers are`}{" "}
            outside the ESC age range of {ESC_RULES.minAge}-{ESC_RULES.maxAge}.
          </span>
          <button
            type="button"
            onClick={() => {
              setAgeIssueOnly(true);
              setPage(1);
            }}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 text-amber-200 hover:bg-amber-500/20 transition-colors"
          >
            Show them
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email, nationality, skill, language..."
              aria-label="Search volunteers"
              className="w-full pl-11 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              >
                <X className="h-4 w-4" />
                Clear filters
              </button>
            )}
            <div
              className="bg-slate-900 border border-slate-800 rounded-xl p-0.5 flex items-center ml-auto sm:ml-0"
              role="group"
              aria-label="View"
            >
              <button
                type="button"
                onClick={() => changeView("list")}
                aria-pressed={view === "list"}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  view === "list" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                <List className="h-4 w-4" aria-hidden="true" />
                List
              </button>
              <button
                type="button"
                onClick={() => changeView("pipeline")}
                aria-pressed={view === "pipeline"}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  view === "pipeline" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                <SquareKanban className="h-4 w-4" aria-hidden="true" />
                Pipeline
              </button>
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-3 ${view === "list" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            aria-label="Filter by status"
            className={FILTER_SELECT_CLASS}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as TypeFilter);
              setPage(1);
            }}
            aria-label="Filter by volunteer type"
            className={FILTER_SELECT_CLASS}
          >
            <option value="all">All types</option>
            {VOLUNTEER_TYPES.map((type) => (
              <option key={type} value={type}>
                {VOLUNTEER_TYPE_LABELS[type]}
              </option>
            ))}
            <option value="unset">Type not set</option>
          </select>

          {view === "list" && (
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value as StageFilter);
                setPage(1);
              }}
              aria-label="Filter by pipeline stage"
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All stages</option>
              <option value="open">Open applications</option>
              {PIPELINE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {PIPELINE_STAGE_LABELS[stage]}
                </option>
              ))}
              <option value="unset">No stage</option>
            </select>
          )}

          <select
            value={membershipFilter}
            onChange={(e) => {
              setMembershipFilter(e.target.value as MembershipFilter);
              setPage(1);
            }}
            aria-label="Filter by membership"
            className={FILTER_SELECT_CLASS}
          >
            {(Object.keys(MEMBERSHIP_FILTER_LABELS) as MembershipFilter[]).map((key) => (
              <option key={key} value={key}>
                {MEMBERSHIP_FILTER_LABELS[key]}
              </option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as SortOrder);
              setPage(1);
            }}
            aria-label="Sort volunteers"
            className={FILTER_SELECT_CLASS}
          >
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {ageIssueOnly && (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-200">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Outside ESC age {ESC_RULES.minAge}-{ESC_RULES.maxAge}
              <button
                type="button"
                onClick={() => {
                  setAgeIssueOnly(false);
                  setPage(1);
                }}
                aria-label="Remove the ESC age filter"
                className="p-0.5 rounded-full hover:bg-amber-500/20 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Directory */}
      {view === "pipeline" ? (
        volunteers.length === 0 ? (
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">{emptyDirectory}</div>
        ) : filteredVolunteers.length === 0 ? (
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">{noMatches}</div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              {canManage
                ? "Use “Next” or the stage menu on a card to move a volunteer through the application process."
                : "Where each volunteer is in the application process."}
            </p>
            <PipelineBoard
              volunteers={filteredVolunteers}
              today={today}
              canManage={canManage}
              busyIds={busyIds}
              presets={presets}
              onMove={handleMoveStage}
              onEdit={openEditForm}
              onWhatsAppOpened={handleWhatsAppOpened}
            />
          </div>
        )
      ) : (
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">
          {volunteers.length === 0 ? (
            emptyDirectory
          ) : (
            <>
              {/* Phone layout: one card per volunteer */}
              <ul className="md:hidden divide-y divide-slate-900/60" aria-label="Volunteers">
                {pageVolunteers.length === 0 ? (
                  <li>{noMatches}</li>
                ) : (
                  pageVolunteers.map((vol) => (
                    <li key={vol._id} className={`p-4 space-y-3 ${busyIds.has(vol._id) ? "opacity-70" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-bold border text-sm bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {initials(vol)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white text-sm truncate">{fullName(vol)}</div>
                          {contactLinks(vol)}
                        </div>
                        <div className="shrink-0 -mr-1.5 -mt-1">{renderRowActions(vol)}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {!vol.active && activeBadge(vol)}
                        <StageBadge stage={vol.pipelineStage} />
                        <TypeBadge type={vol.volunteerType} />
                        <AgeBadge dateOfBirth={vol.dateOfBirth} volunteerType={vol.volunteerType} today={today} />
                        <MembershipBadge membership={vol.membership} today={today} />
                      </div>
                      {(vol.city || vol.country || vol.nationality) && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          {[[vol.city, vol.country].filter(Boolean).join(", "), vol.nationality]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </li>
                  ))
                )}
              </ul>

              {/* Tablet / desktop layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20">
                      <th scope="col" className="py-4 px-5">Volunteer</th>
                      <th scope="col" className="py-4 px-5">Profile</th>
                      <th scope="col" className="py-4 px-5">Application</th>
                      <th scope="col" className="py-4 px-5">Membership</th>
                      <th scope="col" className="py-4 px-5">Status</th>
                      <th scope="col" className="py-4 px-5 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/40">
                    {pageVolunteers.length === 0 ? (
                      <tr>
                        <td colSpan={6}>{noMatches}</td>
                      </tr>
                    ) : (
                      pageVolunteers.map((vol) => {
                        const skills = vol.skills ?? [];
                        return (
                          <tr
                            key={vol._id}
                            className={`hover:bg-slate-950/20 transition-colors group align-top ${
                              busyIds.has(vol._id) ? "opacity-70" : ""
                            }`}
                          >
                            <td className="py-4 px-5 max-w-[19rem]">
                              <div className="flex items-start gap-3">
                                <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-bold border text-sm bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                  {initials(vol)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white group-hover:text-emerald-400 transition-colors text-sm">
                                    {fullName(vol)}
                                  </div>
                                  {contactLinks(vol)}
                                  {(vol.volunteerType || vol.dateOfBirth) && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      <TypeBadge type={vol.volunteerType} />
                                      <AgeBadge
                                        dateOfBirth={vol.dateOfBirth}
                                        volunteerType={vol.volunteerType}
                                        today={today}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-5 text-sm max-w-[16rem]">
                              <div className="space-y-1.5">
                                {vol.city || vol.country ? (
                                  <span className="flex items-center gap-1.5 text-slate-400">
                                    <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                    {[vol.city, vol.country].filter(Boolean).join(", ")}
                                  </span>
                                ) : null}
                                {vol.nationality && (
                                  <span className="block text-xs text-slate-500">{vol.nationality}</span>
                                )}
                                {skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {skills.slice(0, 3).map((skill) => (
                                      <span
                                        key={skill}
                                        className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                    {skills.length > 3 && (
                                      <span
                                        className="text-[10px] text-slate-500 px-1 py-0.5"
                                        title={skills.slice(3).join(", ")}
                                      >
                                        +{skills.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                                {vol.languages && vol.languages.length > 0 && (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <Languages className="h-3 w-3 text-slate-600 shrink-0" />
                                    <span>{vol.languages.join(", ")}</span>
                                  </div>
                                )}
                                {!vol.city && !vol.country && !vol.nationality && skills.length === 0 &&
                                  (vol.languages?.length ?? 0) === 0 && <span className="text-slate-600">—</span>}
                              </div>
                            </td>

                            <td className="py-4 px-5">
                              <StageBadge stage={vol.pipelineStage} />
                              {vol.source && (
                                <span className="block text-[11px] text-slate-500 mt-1">
                                  via {SHORT_SOURCE_LABELS[vol.source]}
                                </span>
                              )}
                              {vol.appliedProjectName && (
                                <span
                                  className="flex items-center gap-1 text-[11px] text-slate-400 mt-1 max-w-[12rem] truncate"
                                  title={vol.appliedProjectName}
                                >
                                  <FolderKanban className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
                                  {vol.appliedProjectName}
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-5">
                              <MembershipBadge membership={vol.membership} today={today} showNone />
                            </td>

                            <td className="py-4 px-5">
                              {activeBadge(vol)}
                              {vol.attendanceCount !== undefined && (
                                <span className="block text-[11px] text-slate-500 mt-1">
                                  {plural(vol.attendanceCount, "attendance record")}
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-5 text-right">{renderRowActions(vol)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {filteredVolunteers.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-slate-900/80 text-sm text-slate-500">
                  <span>
                    Showing <span className="text-slate-300 font-semibold">{pageStart + 1}</span>–
                    <span className="text-slate-300 font-semibold">{pageStart + pageVolunteers.length}</span> of{" "}
                    <span className="text-slate-300 font-semibold">{filteredVolunteers.length}</span>
                    {hasFilters && ` (filtered from ${volunteers.length})`}
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>
                      <span className="px-2 text-slate-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {isFormOpen && canManage && (
        <VolunteerFormDialog
          key={formKey}
          volunteer={formVolunteer}
          defaultCountry={defaultCountry}
          presets={presets}
          canViewEmergency={canViewEmergency}
          canViewMedical={canViewMedical}
          volunteers={volunteers}
          today={today}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && canManage && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeleteDialog();
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-volunteer-title"
            aria-describedby="delete-volunteer-description"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            <div className="p-6 space-y-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                <TriangleAlert className="h-6 w-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 id="delete-volunteer-title" className="text-lg font-bold text-white">
                  Delete Volunteer
                </h3>
                <p id="delete-volunteer-description" className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-white">{fullName(deleteTarget)}</span>? This action is permanent
                  and cannot be undone.
                </p>
              </div>

              {deleteAttendanceCount > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 leading-relaxed">
                  This also permanently deletes{" "}
                  <span className="font-semibold">{plural(deleteAttendanceCount, "attendance record")}</span> for this
                  volunteer.
                  {deleteTarget.active && " To keep their history, deactivate them instead."}
                </div>
              )}

              {deleteError && (
                <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
                  {deleteError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  autoFocus
                  onClick={closeDeleteDialog}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                {deleteAttendanceCount > 0 && deleteTarget.active && (
                  <button
                    type="button"
                    onClick={handleDeactivateInstead}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
                  >
                    Deactivate Instead
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50 transition-colors"
                >
                  {isDeleting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {isDeleting ? "Deleting..." : "Delete Profile"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback toast */}
      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[60] sm:max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
            notice.type === "success"
              ? "border-emerald-500/30 bg-slate-900/95 text-emerald-300"
              : "border-rose-500/30 bg-slate-900/95 text-rose-300"
          }`}
        >
          {notice.type === "success" ? (
            <CircleCheck className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span className="flex-1">
            {notice.message}
            {notice.link && (
              <Link
                href={notice.link.href}
                className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-white hover:text-emerald-300 transition-colors"
              >
                {notice.link.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
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
