"use client";

import React, { useState, useMemo, startTransition } from "react";
import { 
  Calendar, 
  Search, 
  Plus, 
  MapPin, 
  Clock, 
  Users, 
  Tag, 
  SlidersHorizontal,
  Bookmark,
  Grid,
  List,
  Edit,
  Trash,
  X,
  AlertTriangle,
  Layers,
  ChevronRight,
  TrendingUp,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { 
  ActivityData, 
  createActivityAction, 
  updateActivityAction, 
  deleteActivityAction 
} from "@/app/actions/activities";
import { useRouter } from "next/navigation";
import { formatLocalDate, getLocalDateTime } from "@/lib/dates";

interface ActivitiesClientProps {
  initialActivities: ActivityData[];
}

export default function ActivitiesClient({ initialActivities }: ActivitiesClientProps) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityData[]>(initialActivities);

  // Layout View State: 'card' or 'table'
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Search, Filter, Sort State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingTitle, setDeletingTitle] = useState("");

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [maxVolunteers, setMaxVolunteers] = useState(10);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"Upcoming" | "Active" | "Completed">("Upcoming");

  const [loading, setLoading] = useState(false);

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setLocation("");
    setMaxVolunteers(10);
    setCategory("");
    setStatus("Upcoming");
    setEditingActivity(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (act: ActivityData) => {
    setEditingActivity(act);
    setTitle(act.title);
    setDescription(act.description || "");
    setDate(act.date);
    setStartTime(act.startTime);
    setEndTime(act.endTime);
    setLocation(act.location);
    setMaxVolunteers(act.maxVolunteers);
    setCategory(act.category);
    setStatus(act.status);
    setIsModalOpen(true);
  };

  const handleOpenDeleteModal = (id: string, titleStr: string) => {
    setDeletingId(id);
    setDeletingTitle(titleStr);
    setIsDeleteOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !startTime || !endTime || !location || !category) return;

    setLoading(true);
    const payload: ActivityData = {
      title,
      description,
      date,
      startTime,
      endTime,
      location,
      maxVolunteers,
      category,
      status,
    };

    try {
      if (editingActivity && editingActivity._id) {
        const updated = await updateActivityAction(editingActivity._id, payload);
        setVolunteers((prev) =>
          prev.map((a) => (a._id === editingActivity._id ? { ...payload, _id: editingActivity._id, spotsFilled: a.spotsFilled } : a))
        );
      } else {
        const created = await createActivityAction(payload);
        setVolunteers((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
      resetForm();

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      alert("Save failed. Make sure write tokens are valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setLoading(true);

    try {
      await deleteActivityAction(deletingId);
      setVolunteers((prev) => prev.filter((a) => a._id !== deletingId));
      setIsDeleteOpen(false);
      setDeletingId(null);

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    } finally {
      setLoading(false);
    }
  };

  // Helper setVolunteers
  const setVolunteers = (callback: (prev: ActivityData[]) => ActivityData[]) => {
    setActivities(callback);
  };

  // Filter & Sort Calculation
  const filteredAndSortedActivities = useMemo(() => {
    let result = [...activities];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)) ||
          a.location.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter((a) => a.status === statusFilter);
    }

    // Sorting by date
    result.sort((a, b) => {
      const dateA = getLocalDateTime(a.date);
      const dateB = getLocalDateTime(b.date);
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [activities, search, statusFilter, sortOrder]);

  const stats = useMemo(() => {
    const total = activities.length;
    const upcoming = activities.filter((a) => a.status === "Upcoming").length;
    const activeCount = activities.filter((a) => a.status === "Active").length;
    const completed = activities.filter((a) => a.status === "Completed").length;
    return { total, upcoming, activeCount, completed };
  }, [activities]);

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Calendar className="h-8 w-8 text-emerald-400" />
            Activities & Campaigns
          </h1>
          <p className="text-slate-400 mt-1">Schedule and monitor ongoing volunteering activities.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Add Activity
        </button>
      </div>

      {/* Tabs summary counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Total Campaigns</span>
          <span className="text-2xl font-bold text-white block mt-1">{stats.total}</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Upcoming</span>
          <span className="text-2xl font-bold text-amber-400 block mt-1">{stats.upcoming}</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Active</span>
          <span className="text-2xl font-bold text-emerald-400 block mt-1">{stats.activeCount}</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Completed</span>
          <span className="text-2xl font-bold text-purple-400 block mt-1">{stats.completed}</span>
        </div>
      </div>

      {/* Selector controls, Search & Layout Switches */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities by title, location, category..." 
            className="w-full pl-11 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Filters and Layout Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          
          {/* Status Select */}
          <div className="relative">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 appearance-none min-w-[130px]"
            >
              <option value="All">All Statuses</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Sort date Select */}
          <div className="relative">
            <select 
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 appearance-none min-w-[155px]"
            >
              <option value="asc">Date: Closest first</option>
              <option value="desc">Date: Latest first</option>
            </select>
          </div>

          {/* Layout switches */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-0.5 flex items-center">
            <button 
              onClick={() => setViewMode("card")}
              className={`p-2 rounded-lg transition-colors ${viewMode === "card" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
              title="Card Grid View"
            >
              <Grid className="h-4.5 w-4.5" />
            </button>
            <button 
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-colors ${viewMode === "table" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
              title="Spreadsheet Table View"
            >
              <List className="h-4.5 w-4.5" />
            </button>
          </div>

        </div>
      </div>

      {/* Main activities rendering */}
      {filteredAndSortedActivities.length === 0 ? (
        <div className="py-12 border border-slate-900 bg-slate-950/20 rounded-2xl text-center text-slate-500 text-sm">
          No activities match your filters. Try checking spelling or create a new activity!
        </div>
      ) : viewMode === "card" ? (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedActivities.map((act) => {
            const spotsFilled = act.spotsFilled ?? 0;
            return (
              <div 
                key={act._id} 
                className="bg-slate-950/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                      <Tag className="h-3 w-3 text-emerald-400" />
                      {act.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      act.status === "Upcoming" 
                        ? "text-amber-400 bg-amber-500/10 border-amber-500/20" 
                        : act.status === "Active" 
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                        : "text-slate-400 bg-slate-800 border-slate-700/50"
                    }`}>
                      {act.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white tracking-tight hover:text-emerald-400 transition-colors">
                      {act.title}
                    </h3>
                    {act.description && (
                      <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{act.description}</p>
                    )}
                  </div>

                  {/* Event Metadata */}
                  <div className="space-y-2 pt-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{act.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span>{formatLocalDate(act.date, { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span>{act.startTime} - {act.endTime}</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar / Registration footer */}
                <div className="mt-6 pt-5 border-t border-slate-900/80 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Spots Booked</span>
                      <span className="text-white font-bold">{spotsFilled}/{act.maxVolunteers}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" 
                        style={{ width: `${(spotsFilled / act.maxVolunteers) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-end gap-1.5">
                    <button 
                      onClick={() => handleOpenEditModal(act)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleOpenDeleteModal(act._id || "", act.title)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                      title="Delete"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE SPREADSHEET VIEW */
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20">
                  <th className="py-4 px-6">Campaign / Title</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Date & Location</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Cap Limit</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-sm">
                {filteredAndSortedActivities.map((act) => (
                  <tr key={act._id} className="hover:bg-slate-950/20 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">{act.title}</div>
                      <div className="text-slate-500 text-xs mt-0.5 line-clamp-1 max-w-xs">{act.description}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-300 font-medium">{act.category}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-white font-medium">
                        {formatLocalDate(act.date, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {act.location}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold border ${
                        act.status === "Upcoming" 
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/20" 
                          : act.status === "Active" 
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                          : "text-slate-400 bg-slate-800 border-slate-700/50"
                      }`}>
                        {act.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-300">
                      {act.spotsFilled ?? 0} / {act.maxVolunteers} spots
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenEditModal(act)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenDeleteModal(act._id || "", act.title)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRUD Add/Edit Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="text-lg font-bold text-white">
                {editingActivity ? "Edit Activity Campaign" : "Schedule New Activity"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Activity Title *</label>
                <input 
                  type="text" 
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Date *</label>
                  <input 
                    type="date" 
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 text-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Start Time *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 09:00 AM"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">End Time *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 01:00 PM"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Location / Site *</label>
                  <input 
                    type="text" 
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Category *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Environment, Elderly Care"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Maximum Volunteers Limit *</label>
                  <input 
                    type="number" 
                    required
                    value={maxVolunteers}
                    onChange={(e) => setMaxVolunteers(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Campaign Status *</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "Upcoming" | "Active" | "Completed")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 appearance-none"
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-850 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving..." : "Save Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {isDeleteOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 space-y-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-white">Delete Campaign</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to cancel and delete the activity <span className="font-semibold text-white">{deletingTitle}</span>? This is permanent.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button 
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-850 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Deleting..." : "Delete Activity"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
