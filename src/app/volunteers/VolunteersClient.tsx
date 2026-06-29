"use client";

import React, { useState, useMemo, startTransition } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Mail, 
  Phone, 
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Edit,
  Trash,
  Check,
  MapPin,
  Languages,
  BookOpen
} from "lucide-react";
import { 
  VolunteerData, 
  createVolunteerAction, 
  updateVolunteerAction, 
  deleteVolunteerAction 
} from "@/app/actions/volunteers";
import { useRouter } from "next/navigation";

interface VolunteersClientProps {
  initialVolunteers: VolunteerData[];
}

export default function VolunteersClient({ initialVolunteers }: VolunteersClientProps) {
  const router = useRouter();
  const [volunteers, setVolunteers] = useState<VolunteerData[]>(initialVolunteers);
  
  // Search, Filter, Sort State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<VolunteerData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState("");

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [languagesInput, setLanguagesInput] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  // Active Dropdowns state (per row)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // Reset form helper
  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
    setCountry("");
    setCity("");
    setLanguagesInput("");
    setSkillsInput("");
    setNotes("");
    setActive(true);
    setEditingVolunteer(null);
  };

  // Open modal for Create
  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (vol: VolunteerData) => {
    setEditingVolunteer(vol);
    setFirstName(vol.firstName);
    setLastName(vol.lastName);
    setEmail(vol.email);
    setPhoneNumber(vol.phoneNumber || "");
    setCountry(vol.country || "");
    setCity(vol.city || "");
    setLanguagesInput(vol.languages ? vol.languages.join(", ") : "");
    setSkillsInput(vol.skills ? vol.skills.join(", ") : "");
    setNotes(vol.notes || "");
    setActive(vol.active);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  // Open delete confirm modal
  const handleOpenDeleteModal = (id: string, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
    setIsDeleteOpen(true);
    setActiveMenuId(null);
  };

  // Handle Save (Create / Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email) return;

    setLoading(true);
    const languages = languagesInput.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    const skills = skillsInput.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

    const payload: VolunteerData = {
      firstName,
      lastName,
      email,
      phoneNumber,
      country,
      city,
      languages,
      skills,
      notes,
      active,
    };

    try {
      if (editingVolunteer && editingVolunteer._id) {
        const updated = await updateVolunteerAction(editingVolunteer._id, payload);
        // Optimistic UI state update immediately
        setVolunteers((prev) =>
          prev.map((v) => (v._id === editingVolunteer._id ? { ...payload, _id: editingVolunteer._id, createdAt: v.createdAt } : v))
        );
      } else {
        const created = await createVolunteerAction(payload);
        // Optimistic UI state update immediately
        setVolunteers((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
      resetForm();
      
      // Re-sync with server
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      alert("CRUD operation failed. Make sure write tokens are valid.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!deletingId) return;
    setLoading(true);

    try {
      await deleteVolunteerAction(deletingId);
      // Optimistic update state immediately
      setVolunteers((prev) => prev.filter((v) => v._id !== deletingId));
      setIsDeleteOpen(false);
      setDeletingId(null);

      // Re-sync with server
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      alert("Delete operation failed.");
    } finally {
      setLoading(false);
    }
  };

  // Filter and Sort Computation
  const filteredAndSortedVolunteers = useMemo(() => {
    let result = [...volunteers];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.firstName.toLowerCase().includes(q) ||
          v.lastName.toLowerCase().includes(q) ||
          v.email.toLowerCase().includes(q) ||
          (v.skills && v.skills.some((sk) => sk.toLowerCase().includes(q)))
      );
    }

    // Active status filter
    if (statusFilter !== "All") {
      const isActive = statusFilter === "Active";
      result = result.filter((v) => v.active === isActive);
    }

    // Alphabetical Sorting
    result.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      if (nameA < nameB) return sortOrder === "asc" ? -1 : 1;
      if (nameA > nameB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [volunteers, search, statusFilter, sortOrder]);

  const stats = useMemo(() => {
    const total = volunteers.length;
    const activeCount = volunteers.filter((v) => v.active).length;
    const inactiveCount = total - activeCount;
    return { total, activeCount, inactiveCount };
  }, [volunteers]);

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
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Add Volunteer
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Total Registered</span>
          <span className="text-2xl font-bold text-white block mt-1">{stats.total}</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Active Now</span>
          <span className="text-2xl font-bold text-emerald-400 block mt-1">{stats.activeCount}</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Inactive</span>
          <span className="text-2xl font-bold text-slate-400 block mt-1">{stats.inactiveCount}</span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search volunteers by name, email, or skill..." 
            className="w-full pl-11 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="relative">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 appearance-none min-w-[120px]"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          <div className="relative">
            <select 
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 appearance-none min-w-[140px]"
            >
              <option value="asc">Name: A to Z</option>
              <option value="desc">Name: Z to A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20">
                <th className="py-4 px-6">Volunteer</th>
                <th className="py-4 px-6">Location</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Skills / Langs</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/40">
              {filteredAndSortedVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                    No volunteers found. Try clearing your filters or add a new volunteer.
                  </td>
                </tr>
              ) : (
                filteredAndSortedVolunteers.map((vol) => (
                  <tr key={vol._id} className="hover:bg-slate-950/20 transition-colors group">
                    {/* Bio cell */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold border text-sm bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {vol.firstName.charAt(0)}{vol.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-emerald-400 transition-colors text-sm">
                            {vol.firstName} {vol.lastName}
                          </div>
                          <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-slate-500 text-xs mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {vol.email}
                            </span>
                            {vol.phoneNumber && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {vol.phoneNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-4 px-6 text-slate-400 text-sm">
                      {vol.city || vol.country ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-500" />
                          {[vol.city, vol.country].filter(Boolean).join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Status Cell */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        vol.active 
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                          : "text-slate-400 bg-slate-800 border-slate-700/50"
                      }`}>
                        {vol.active ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            Inactive
                          </>
                        )}
                      </span>
                    </td>

                    {/* Skills and Languages */}
                    <td className="py-4 px-6 max-w-xs">
                      <div className="space-y-1">
                        {vol.skills && vol.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {vol.skills.map((s) => (
                              <span key={s} className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                {s}
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
                    </td>

                    {/* Action Trigger */}
                    <td className="py-4 px-6 text-right relative">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleOpenEditModal(vol)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenDeleteModal(vol._id || "", `${vol.firstName} ${vol.lastName}`)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                          title="Delete"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD Add/Edit Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="text-lg font-bold text-white">
                {editingVolunteer ? "Edit Volunteer Profile" : "Register New Volunteer"}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">First Name *</label>
                  <input 
                    type="text" 
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Last Name *</label>
                  <input 
                    type="text" 
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Email Address *</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Phone Number</label>
                  <input 
                    type="text" 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">City</label>
                  <input 
                    type="text" 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Country</label>
                  <input 
                    type="text" 
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Skills (comma separated)</label>
                <input 
                  type="text" 
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="e.g. Teaching, Event Planning, Social Media"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Languages (comma separated)</label>
                <input 
                  type="text" 
                  value={languagesInput}
                  onChange={(e) => setLanguagesInput(e.target.value)}
                  placeholder="e.g. English, Spanish"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-sm font-semibold text-white block">Active Status</span>
                  <span className="text-xs text-slate-500 block">Determine if this volunteer can be assigned to active events.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4.5 w-4.5 rounded accent-emerald-500" 
                />
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
                  {loading ? "Saving..." : "Save Volunteer"}
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
                <h3 className="text-lg font-bold text-white">Delete Volunteer</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-white">{deletingName}</span>? This action is permanent and cannot be undone.
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
                  {loading ? "Deleting..." : "Delete Profile"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
