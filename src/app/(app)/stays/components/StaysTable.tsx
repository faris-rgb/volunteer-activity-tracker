"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Award, Plus, Search, SearchX, SquarePen, Trash, UserPlus, X } from "lucide-react";
import { STAY_STATUSES, type Stay, type StayStatus } from "@/lib/domain";
import type { Lookups } from "./ArrivalsTab";
import {
  STAY_STATUS_BADGES,
  STAY_STATUS_LABELS,
  VISA_BADGES,
  YOUTHPASS_STATUS_LABELS,
  documentsChecklist,
  documentsCompleteness,
  shortDate,
  stayLength,
  visaCounter,
  volunteerName,
  type StayProjectOption,
} from "./stayUtils";
import { Badge, ICON_BUTTON, PRIMARY_BUTTON, SELECT_FILTER_CLASS } from "./ui";

export type StatusFilter = "all" | StayStatus;
export type SortOrder = "arrival-desc" | "arrival-asc" | "name";

export interface StayFilters {
  search: string;
  project: string; // "all" | "none" | project id
  status: StatusFilter;
  sort: SortOrder;
}

const YOUTHPASS_BADGES = {
  not_applicable: "text-slate-400 bg-slate-800 border-slate-700/50",
  requested: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  issued: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
} as const;

export default function StaysTable({
  stays,
  lookups,
  projects,
  today,
  filters,
  hasVolunteers,
  onFiltersChange,
  onEdit,
  onDelete,
  onCreate,
}: {
  stays: Stay[];
  lookups: Lookups;
  projects: StayProjectOption[];
  today: string;
  filters: StayFilters;
  hasVolunteers: boolean;
  onFiltersChange: (filters: StayFilters) => void;
  onEdit: (stay: Stay) => void;
  onDelete: (stay: Stay) => void;
  onCreate: () => void;
}) {
  const setFilter = <K extends keyof StayFilters>(key: K, value: StayFilters[K]) => onFiltersChange({ ...filters, [key]: value });
  const hasFilters = filters.search.trim() !== "" || filters.project !== "all" || filters.status !== "all";

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const result = stays.filter((stay) => {
      if (filters.status !== "all" && stay.status !== filters.status) return false;
      if (filters.project === "none" && stay.projectId) return false;
      if (filters.project !== "all" && filters.project !== "none" && stay.projectId !== filters.project) return false;
      if (!query) return true;
      const volunteer = lookups.volunteers.get(stay.volunteerId);
      const project = stay.projectId ? lookups.projects.get(stay.projectId) : undefined;
      const room = stay.roomId ? lookups.rooms.get(stay.roomId) : undefined;
      return [volunteerName(volunteer), volunteer?.nationality, project?.name, room?.name, stay.flightNumber, stay.pickupBy, stay.notes]
        .some((field) => field?.toLowerCase().includes(query));
    });
    result.sort((a, b) => {
      if (filters.sort === "name") {
        return volunteerName(lookups.volunteers.get(a.volunteerId)).localeCompare(
          volunteerName(lookups.volunteers.get(b.volunteerId)),
          "en",
          { sensitivity: "base" }
        );
      }
      const left = a.arrivalDate ?? "";
      const right = b.arrivalDate ?? "";
      if (!left || !right) return left ? -1 : right ? 1 : 0; // undated stays last
      return filters.sort === "arrival-asc" ? left.localeCompare(right) : right.localeCompare(left);
    });
    return result;
  }, [stays, filters, lookups]);

  const clearFilters = () => onFiltersChange({ ...filters, search: "", project: "all", status: "all" });

  if (stays.length === 0) {
    return (
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl px-6 py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
          <Plus className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-white">No stays yet</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
          A stay records when a volunteer is in Morocco: dates, project, room, documents, allowances and Youthpass.
        </p>
        {hasVolunteers ? (
          <button type="button" onClick={onCreate} className={`mt-6 ${PRIMARY_BUTTON}`}>
            <Plus className="h-4 w-4" />
            Add the first stay
          </button>
        ) : (
          <Link href="/volunteers?new=1" className={`mt-6 ${PRIMARY_BUTTON}`}>
            <UserPlus className="h-4 w-4" />
            Add your first volunteer
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => setFilter("search", event.target.value)}
            placeholder="Search name, flight, room, notes..."
            aria-label="Search stays"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-2 lg:justify-end">
          <select
            value={filters.project}
            onChange={(event) => setFilter("project", event.target.value)}
            aria-label="Filter by project"
            className={`${SELECT_FILTER_CLASS} lg:min-w-[180px]`}
          >
            <option value="all">All projects</option>
            <option value="none">No project</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) => setFilter("status", event.target.value as StatusFilter)}
            aria-label="Filter by status"
            className={`${SELECT_FILTER_CLASS} lg:min-w-[150px]`}
          >
            <option value="all">All statuses</option>
            {STAY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STAY_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            value={filters.sort}
            onChange={(event) => setFilter("sort", event.target.value as SortOrder)}
            aria-label="Sort stays"
            className={`${SELECT_FILTER_CLASS} lg:min-w-[170px]`}
          >
            <option value="arrival-desc">Arrival: newest first</option>
            <option value="arrival-asc">Arrival: oldest first</option>
            <option value="name">Volunteer: A to Z</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20">
                <th className="py-3.5 px-4">Volunteer</th>
                <th className="py-3.5 px-4">Project</th>
                <th className="py-3.5 px-4">Dates</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Room</th>
                <th className="py-3.5 px-4">Documents</th>
                <th className="py-3.5 px-4">90 days</th>
                <th className="py-3.5 px-4">Youthpass</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <SearchX className="h-8 w-8 text-slate-600 mx-auto" />
                    <p className="mt-3 text-sm text-slate-400">No stays match your search or filters.</p>
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
                filtered.map((stay) => {
                  const volunteer = lookups.volunteers.get(stay.volunteerId);
                  const project = stay.projectId ? lookups.projects.get(stay.projectId) : undefined;
                  const room = stay.roomId ? lookups.rooms.get(stay.roomId) : undefined;
                  const name = volunteerName(volunteer);
                  const docs = documentsCompleteness(stay.documents);
                  const missing = documentsChecklist(stay.documents).filter((item) => !item.done).map((item) => item.label);
                  const visa = visaCounter(stay, volunteer, today);
                  const nights = stayLength(stay);
                  return (
                    <tr key={stay._id} className="hover:bg-slate-950/20 transition-colors align-top">
                      <td className="py-3.5 px-4">
                        <div className="text-sm font-bold text-white">{name}</div>
                        {volunteer?.nationality && <div className="text-xs text-slate-500">{volunteer.nationality}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-slate-300 max-w-[180px]">
                        {project ? (
                          <span className="line-clamp-2">{project.name}</span>
                        ) : (
                          <span className="text-slate-600">{stay.projectId ? "Deleted project" : "—"}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-slate-300 whitespace-nowrap">
                        {stay.arrivalDate || stay.departureDate ? (
                          <>
                            <div>
                              {shortDate(stay.arrivalDate)} → {shortDate(stay.departureDate)}
                            </div>
                            {nights !== null && <div className="text-xs text-slate-500">{nights} nights</div>}
                          </>
                        ) : (
                          <span className="text-slate-600">Dates not set</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge className={STAY_STATUS_BADGES[stay.status]}>{STAY_STATUS_LABELS[stay.status]}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-sm text-slate-300">
                        {room ? room.name : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-24" title={missing.length > 0 ? `Missing: ${missing.join(", ")}` : "All documents complete"}>
                          <div className="flex items-center justify-between text-xs">
                            <span className={docs === 100 ? "text-emerald-400 font-semibold" : "text-slate-300"}>{docs}%</span>
                          </div>
                          <div
                            className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"
                            role="progressbar"
                            aria-valuenow={docs}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Documents ${docs}% complete`}
                          >
                            <div
                              className={`h-full rounded-full ${docs === 100 ? "bg-emerald-500" : docs >= 60 ? "bg-amber-400" : "bg-rose-400"}`}
                              style={{ width: `${docs}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {visa ? (
                          <Badge
                            className={VISA_BADGES[visa.level]}
                            title={visa.level === "over" ? "Over the 90 visa-free days" : visa.level === "warning" ? "Approaching the 90-day limit" : "Days in Morocco"}
                          >
                            Day {visa.day}/90
                          </Badge>
                        ) : (
                          <span className="text-slate-600 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {stay.youthpassStatus ? (
                          <Badge className={YOUTHPASS_BADGES[stay.youthpassStatus]}>{YOUTHPASS_STATUS_LABELS[stay.youthpassStatus]}</Badge>
                        ) : (
                          <span className="text-slate-600 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/certificates/${encodeURIComponent(stay._id)}`}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-emerald-400 hover:bg-slate-900 transition-colors"
                            title="Certificate of participation"
                            aria-label={`Certificate for ${name}`}
                          >
                            <Award className="h-4 w-4" />
                            <span className="hidden xl:inline">Certificate</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => onEdit(stay)}
                            className={ICON_BUTTON}
                            title="Edit stay"
                            aria-label={`Edit stay of ${name}`}
                          >
                            <SquarePen className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(stay)}
                            className={`${ICON_BUTTON} hover:text-rose-400`}
                            title="Delete stay"
                            aria-label={`Delete stay of ${name}`}
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-900/80 text-sm text-slate-500">
          Showing <span className="text-slate-300 font-semibold">{filtered.length}</span> of{" "}
          <span className="text-slate-300 font-semibold">{stays.length}</span> stays
        </div>
      </div>
    </div>
  );
}
