"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  Languages,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SearchX,
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
  createVolunteerAction,
  deleteVolunteerAction,
  setVolunteerActiveAction,
  updateVolunteerAction,
  type VolunteerData,
  type VolunteerInput,
} from "@/app/actions/volunteers";
import type { ActionResult } from "@/lib/actionResult";
import { formatDateKey, toDateKey } from "@/lib/dates";

interface VolunteersClientProps {
  initialVolunteers: VolunteerData[];
  canManage: boolean;
  loadError?: string | null;
  defaultCountry: string;
  openCreateOnLoad: boolean;
}

type StatusFilter = "all" | "active" | "inactive";
type SortOrder = "name-asc" | "name-desc" | "newest" | "oldest";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  city: string;
  country: string;
  skills: string;
  languages: string;
  notes: string;
  active: boolean;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

interface Notice {
  type: "success" | "error";
  message: string;
}

const PAGE_SIZE = 10;
const MAX_LIST_ITEMS = 30;
const MAX_NOTES_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  city: "",
  country: "",
  skills: "",
  languages: "",
  notes: "",
  active: true,
};

const FIELD_ORDER: (keyof FormState)[] = ["firstName", "lastName", "email", "phoneNumber", "skills", "languages", "notes"];

function inputClassName(error?: string) {
  return `w-full bg-slate-950 border rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
    error ? "border-rose-500/60 focus:border-rose-400" : "border-slate-800 focus:border-emerald-500/50"
  }`;
}

function fullName(vol: Pick<VolunteerData, "firstName" | "lastName">) {
  return `${vol.firstName} ${vol.lastName}`.trim();
}

function initials(vol: Pick<VolunteerData, "firstName" | "lastName">) {
  return `${vol.firstName.charAt(0)}${vol.lastName.charAt(0)}`.toUpperCase() || "?";
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function parseList(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function toFormState(vol: VolunteerData): FormState {
  return {
    firstName: vol.firstName,
    lastName: vol.lastName,
    email: vol.email,
    phoneNumber: vol.phoneNumber ?? "",
    city: vol.city ?? "",
    country: vol.country ?? "",
    skills: (vol.skills ?? []).join(", "),
    languages: (vol.languages ?? []).join(", "),
    notes: vol.notes ?? "",
    active: vol.active,
  };
}

function validateList(value: string, label: string): string | undefined {
  const items = parseList(value);
  if (items.length > MAX_LIST_ITEMS) return `Add at most ${MAX_LIST_ITEMS} ${label}.`;
  if (items.some((item) => item.length > 50)) return `Each entry must be at most 50 characters.`;
  return undefined;
}

function validateForm(form: FormState, volunteers: VolunteerData[], editingId: string | null): FormErrors {
  const errors: FormErrors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";

  const email = form.email.trim().toLowerCase();
  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  } else if (volunteers.some((vol) => vol._id !== editingId && vol.email.toLowerCase() === email)) {
    errors.email = "A volunteer with this email address already exists.";
  }

  const phone = form.phoneNumber.trim();
  if (phone && (!PHONE_PATTERN.test(phone) || phone.replace(/\D/g, "").length < 6)) {
    errors.phoneNumber = "Enter a valid phone number (digits, spaces, +, -, parentheses).";
  }

  const skillsError = validateList(form.skills, "skills");
  if (skillsError) errors.skills = skillsError;
  const languagesError = validateList(form.languages, "languages");
  if (languagesError) errors.languages = languagesError;

  if (form.notes.trim().length > MAX_NOTES_LENGTH) {
    errors.notes = `Notes must be at most ${MAX_NOTES_LENGTH} characters.`;
  }
  return errors;
}

async function callAction<R extends ActionResult<unknown>>(
  action: () => Promise<R>
): Promise<R | { ok: false; error: string }> {
  try {
    return await action();
  } catch (error) {
    console.error(error);
    return { ok: false, error: NETWORK_ERROR };
  }
}

/**
 * Quotes a CSV value and prefixes it with an apostrophe when a spreadsheet would otherwise
 * evaluate it as a formula (CSV injection) or, with `forceText`, convert it to a number.
 */
function csvCell(value: string | number | undefined, { forceText = false } = {}): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text) || (forceText && text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-600">{hint}</p>
      ) : null}
    </div>
  );
}

export default function VolunteersClient({
  initialVolunteers,
  canManage,
  loadError,
  defaultCountry,
  openCreateOnLoad,
}: VolunteersClientProps) {
  const router = useRouter();
  const [volunteers, setVolunteers] = useState<VolunteerData[]>(initialVolunteers);
  const [syncedVolunteers, setSyncedVolunteers] = useState<VolunteerData[]>(initialVolunteers);
  if (initialVolunteers !== syncedVolunteers) {
    setSyncedVolunteers(initialVolunteers);
    setVolunteers(initialVolunteers);
  }

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("name-asc");
  const [page, setPage] = useState(1);

  const createForm = useMemo<FormState>(() => ({ ...EMPTY_FORM, country: defaultCountry }), [defaultCountry]);
  const [isFormOpen, setIsFormOpen] = useState(openCreateOnLoad);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(createForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      setEditingId(null);
      setForm(createForm);
      setFormErrors({});
      setFormError(null);
      setIsFormOpen(true);
    }
  }

  useEffect(() => {
    if (openCreateOnLoad) {
      window.history.replaceState(null, "", "/volunteers");
    }
  }, [openCreateOnLoad]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.type === "success" ? 4000 : 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!isFormOpen && !deleteTarget) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deleteTarget) {
        if (!isDeleting) setDeleteTargetId(null);
      } else if (!isSaving) {
        setIsFormOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFormOpen, deleteTarget, isSaving, isDeleting]);

  const upsertVolunteer = (vol: VolunteerData) => {
    setVolunteers((prev) =>
      prev.some((item) => item._id === vol._id)
        ? prev.map((item) => (item._id === vol._id ? vol : item))
        : [vol, ...prev]
    );
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(createForm);
    setFormErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (vol: VolunteerData) => {
    setEditingId(vol._id);
    setForm(toFormState(vol));
    setFormErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (!isSaving) setIsFormOpen(false);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const errors = validateForm(form, volunteers, editingId);
    setFormErrors(errors);
    const firstInvalid = FIELD_ORDER.find((key) => errors[key]);
    if (firstInvalid) {
      setFormError(null);
      document.getElementById(`volunteer-${firstInvalid}`)?.focus();
      return;
    }

    const payload: VolunteerInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phoneNumber: form.phoneNumber.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      skills: parseList(form.skills),
      languages: parseList(form.languages),
      notes: form.notes.trim(),
      active: form.active,
    };

    setFormError(null);
    setIsSaving(true);
    const result = await callAction(() =>
      editingId ? updateVolunteerAction(editingId, payload) : createVolunteerAction(payload)
    );
    setIsSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    upsertVolunteer(result.data);
    setIsFormOpen(false);
    setNotice({
      type: "success",
      message: editingId
        ? `Saved changes to ${fullName(result.data)}.`
        : `${fullName(result.data)} was added to the directory.`,
    });
  };

  const handleToggleActive = async (vol: VolunteerData) => {
    if (busyIds.has(vol._id)) return;

    setBusyIds((prev) => new Set(prev).add(vol._id));
    const result = await callAction(() => setVolunteerActiveAction(vol._id, !vol.active));
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(vol._id);
      return next;
    });

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

  const filteredVolunteers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = volunteers.filter((vol) => {
      if (statusFilter === "active" && !vol.active) return false;
      if (statusFilter === "inactive" && vol.active) return false;
      if (!query) return true;
      return [
        fullName(vol),
        vol.email,
        vol.phoneNumber,
        vol.city,
        vol.country,
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
  }, [volunteers, search, statusFilter, sortOrder]);

  const stats = useMemo(() => {
    const total = volunteers.length;
    const activeCount = volunteers.filter((vol) => vol.active).length;
    return { total, activeCount, inactiveCount: total - activeCount };
  }, [volunteers]);

  const totalPages = Math.max(1, Math.ceil(filteredVolunteers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageVolunteers = filteredVolunteers.slice(pageStart, pageStart + PAGE_SIZE);
  const hasFilters = search.trim() !== "" || statusFilter !== "all";
  const columnCount = canManage ? 5 : 4;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
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

  const statCards: { filter: StatusFilter; label: string; value: number; valueClass: string }[] = [
    { filter: "all", label: "Total Registered", value: stats.total, valueClass: "text-white" },
    { filter: "active", label: "Active", value: stats.activeCount, valueClass: "text-emerald-400" },
    { filter: "inactive", label: "Inactive", value: stats.inactiveCount, valueClass: "text-slate-400" },
  ];

  const deleteAttendanceCount = deleteTarget?.attendanceCount ?? 0;

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-emerald-400" />
            Volunteer Directory
          </h1>
          <p className="text-slate-400 mt-1">Manage registration details, contributions, and active status.</p>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const selected = statusFilter === card.filter;
          return (
            <button
              key={card.filter}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setStatusFilter(card.filter);
                setPage(1);
              }}
              className={`text-left bg-slate-950/40 border rounded-xl p-4 transition-colors ${
                selected ? "border-emerald-500/40" : "border-slate-900 hover:border-slate-800"
              }`}
            >
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">{card.label}</span>
              <span className={`text-2xl font-bold block mt-1 ${card.valueClass}`}>{card.value}</span>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, location, skill, or language..."
            aria-label="Search volunteers"
            className="w-full pl-11 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
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
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 min-w-[140px]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as SortOrder);
              setPage(1);
            }}
            aria-label="Sort volunteers"
            className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 min-w-[160px]"
          >
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">
        {volunteers.length === 0 ? (
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
                  ? "Register your first volunteer to start planning activities and tracking attendance."
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
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20">
                    <th className="py-4 px-6">Volunteer</th>
                    <th className="py-4 px-6">Location</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Skills / Langs</th>
                    {canManage && <th className="py-4 px-6 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40">
                  {pageVolunteers.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="py-12 text-center">
                        <SearchX className="h-8 w-8 text-slate-600 mx-auto" />
                        <p className="mt-3 text-sm text-slate-400">No volunteers match your search or filters.</p>
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          Clear filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    pageVolunteers.map((vol) => {
                      const name = fullName(vol);
                      const isBusy = busyIds.has(vol._id);
                      return (
                        <tr key={vol._id} className="hover:bg-slate-950/20 transition-colors group">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-bold border text-sm bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                {initials(vol)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-white group-hover:text-emerald-400 transition-colors text-sm">
                                  {name}
                                </div>
                                <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-slate-500 text-xs mt-0.5">
                                  {vol.email && (
                                    <a
                                      href={`mailto:${vol.email}`}
                                      className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                                    >
                                      <Mail className="h-3.5 w-3.5" />
                                      {vol.email}
                                    </a>
                                  )}
                                  {vol.phoneNumber && (
                                    <a
                                      href={`tel:${vol.phoneNumber.replace(/[^\d+]/g, "")}`}
                                      className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                      {vol.phoneNumber}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-slate-400 text-sm">
                            {vol.city || vol.country ? (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                {[vol.city, vol.country].filter(Boolean).join(", ")}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          <td className="py-4 px-6">
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
                            {vol.attendanceCount !== undefined && (
                              <span className="block text-[11px] text-slate-500 mt-1">
                                {plural(vol.attendanceCount, "attendance record")}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-6 max-w-xs">
                            {(vol.skills?.length ?? 0) === 0 && (vol.languages?.length ?? 0) === 0 ? (
                              <span className="text-slate-600 text-sm">—</span>
                            ) : (
                              <div className="space-y-1">
                                {vol.skills && vol.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {vol.skills.map((skill) => (
                                      <span
                                        key={skill}
                                        className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {vol.languages && vol.languages.length > 0 && (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <Languages className="h-3 w-3 text-slate-600" />
                                    <span>{vol.languages.join(", ")}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {canManage && (
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-1">
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

            {filteredVolunteers.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-900/80 text-sm text-slate-500">
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

      {/* Add/Edit Dialog */}
      {isFormOpen && canManage && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="volunteer-form-title"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 id="volunteer-form-title" className="text-lg font-bold text-white">
                {editingId ? "Edit Volunteer Profile" : "Register New Volunteer"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
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
                  className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                >
                  <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="volunteer-firstName" label="First Name *" error={formErrors.firstName}>
                  <input
                    id="volunteer-firstName"
                    type="text"
                    autoFocus
                    autoComplete="given-name"
                    maxLength={80}
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    aria-invalid={!!formErrors.firstName}
                    aria-describedby={formErrors.firstName ? "volunteer-firstName-error" : undefined}
                    className={inputClassName(formErrors.firstName)}
                  />
                </FormField>
                <FormField id="volunteer-lastName" label="Last Name *" error={formErrors.lastName}>
                  <input
                    id="volunteer-lastName"
                    type="text"
                    autoComplete="family-name"
                    maxLength={80}
                    value={form.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    aria-invalid={!!formErrors.lastName}
                    aria-describedby={formErrors.lastName ? "volunteer-lastName-error" : undefined}
                    className={inputClassName(formErrors.lastName)}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="volunteer-email" label="Email Address *" error={formErrors.email}>
                  <input
                    id="volunteer-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    aria-invalid={!!formErrors.email}
                    aria-describedby={formErrors.email ? "volunteer-email-error" : undefined}
                    className={inputClassName(formErrors.email)}
                  />
                </FormField>
                <FormField id="volunteer-phoneNumber" label="Phone Number" error={formErrors.phoneNumber}>
                  <input
                    id="volunteer-phoneNumber"
                    type="tel"
                    autoComplete="tel"
                    maxLength={30}
                    value={form.phoneNumber}
                    onChange={(e) => updateField("phoneNumber", e.target.value)}
                    placeholder="e.g. +31 6 1234 5678"
                    aria-invalid={!!formErrors.phoneNumber}
                    aria-describedby={formErrors.phoneNumber ? "volunteer-phoneNumber-error" : undefined}
                    className={inputClassName(formErrors.phoneNumber)}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="volunteer-city" label="City">
                  <input
                    id="volunteer-city"
                    type="text"
                    autoComplete="address-level2"
                    maxLength={80}
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className={inputClassName()}
                  />
                </FormField>
                <FormField id="volunteer-country" label="Country">
                  <input
                    id="volunteer-country"
                    type="text"
                    autoComplete="country-name"
                    maxLength={80}
                    value={form.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    className={inputClassName()}
                  />
                </FormField>
              </div>

              <FormField
                id="volunteer-skills"
                label="Skills (comma separated)"
                error={formErrors.skills}
                hint="Separate multiple skills with commas."
              >
                <input
                  id="volunteer-skills"
                  type="text"
                  value={form.skills}
                  onChange={(e) => updateField("skills", e.target.value)}
                  placeholder="e.g. Teaching, Event Planning, Social Media"
                  aria-invalid={!!formErrors.skills}
                  aria-describedby={formErrors.skills ? "volunteer-skills-error" : undefined}
                  className={inputClassName(formErrors.skills)}
                />
              </FormField>

              <FormField id="volunteer-languages" label="Languages (comma separated)" error={formErrors.languages}>
                <input
                  id="volunteer-languages"
                  type="text"
                  value={form.languages}
                  onChange={(e) => updateField("languages", e.target.value)}
                  placeholder="e.g. English, Spanish"
                  aria-invalid={!!formErrors.languages}
                  aria-describedby={formErrors.languages ? "volunteer-languages-error" : undefined}
                  className={inputClassName(formErrors.languages)}
                />
              </FormField>

              <FormField
                id="volunteer-notes"
                label="Notes"
                error={formErrors.notes}
                hint={`${form.notes.length}/${MAX_NOTES_LENGTH} characters`}
              >
                <textarea
                  id="volunteer-notes"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={3}
                  maxLength={MAX_NOTES_LENGTH}
                  aria-invalid={!!formErrors.notes}
                  aria-describedby={formErrors.notes ? "volunteer-notes-error" : undefined}
                  className={`${inputClassName(formErrors.notes)} p-4 resize-none`}
                />
              </FormField>

              <label
                htmlFor="volunteer-active"
                className="flex items-center justify-between gap-4 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer"
              >
                <span>
                  <span className="text-sm font-semibold text-white block">Active Status</span>
                  <span className="text-xs text-slate-500 block">
                    Determine if this volunteer can be assigned to active events.
                  </span>
                </span>
                <input
                  id="volunteer-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => updateField("active", e.target.checked)}
                  className="h-4.5 w-4.5 shrink-0 rounded accent-emerald-500"
                />
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                >
                  {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {isSaving ? "Saving..." : editingId ? "Save Changes" : "Add Volunteer"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
          className={`fixed bottom-6 right-6 z-[60] max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
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
          <span className="flex-1">{notice.message}</span>
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
