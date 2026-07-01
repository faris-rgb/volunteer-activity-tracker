"use client";

import React, { useState, useMemo, startTransition } from "react";
import { 
  CheckSquare, 
  Search, 
  Calendar, 
  Clock, 
  Users, 
  Check, 
  X,
  RefreshCw,
  Award,
  Download,
  Printer,
  ChevronDown,
  UserCheck,
  UserMinus,
  AlertCircle
} from "lucide-react";
import { VolunteerData } from "@/app/actions/volunteers";
import { ActivityData } from "@/app/actions/activities";
import { 
  AttendanceRecord, 
  recordAttendanceAction, 
  bulkRecordAttendanceAction 
} from "@/app/actions/attendance";
import { useRouter } from "next/navigation";
import { formatLocalDate } from "@/lib/dates";

interface AttendanceClientProps {
  volunteers: VolunteerData[];
  activities: ActivityData[];
  initialRecords: AttendanceRecord[];
}

export default function AttendanceClient({ 
  volunteers, 
  activities, 
  initialRecords 
}: AttendanceClientProps) {
  const router = useRouter();
  
  // Selected Activity ID State (default to first active/upcoming activity)
  const [selectedActivityId, setSelectedActivityId] = useState<string>(
    activities.length > 0 ? activities[0]._id || "" : ""
  );

  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // All, Present, Absent, Late, Unmarked
  const [loading, setLoading] = useState(false);

  // Selected row checkboxes for bulk action
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);

  // Filter activities to get current selected title and date
  const currentActivity = useMemo(() => {
    return activities.find((a) => a._id === selectedActivityId);
  }, [activities, selectedActivityId]);

  // Compute active records matching selected activity ID
  const activeRecordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records
      .filter((rec) => rec.activityId === selectedActivityId)
      .forEach((rec) => {
        map.set(rec.volunteerId, rec);
      });
    return map;
  }, [records, selectedActivityId]);

  // Handle checkmark updates (optimistic states)
  const handleRecordStatus = async (volunteerId: string, status: "Present" | "Absent" | "Late") => {
    // Determine checkin time
    const checkInTimeStr = status === "Present" || status === "Late"
      ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "";

    // Optimistic Update local state immediately
    const optimisticRecord: AttendanceRecord = {
      volunteerId,
      activityId: selectedActivityId,
      status,
      checkInTime: checkInTimeStr,
    };

    setRecords((prev) => {
      const idx = prev.findIndex(
        (rec) => rec.volunteerId === volunteerId && rec.activityId === selectedActivityId
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], status, checkInTime: checkInTimeStr };
        return copy;
      } else {
        return [...prev, optimisticRecord];
      }
    });

    try {
      await recordAttendanceAction(optimisticRecord);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      alert("Failed to save check-in state.");
    }
  };

  // Bulk actions updates
  const handleBulkStatus = async (status: "Present" | "Absent" | "Late") => {
    if (selectedVolunteers.length === 0) return;
    setLoading(true);

    const checkInTimeStr = status === "Present" || status === "Late"
      ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "";

    // Optimistic UI updates
    setRecords((prev) => {
      const copy = [...prev];
      selectedVolunteers.forEach((vId) => {
        const idx = copy.findIndex((rec) => rec.volunteerId === vId && rec.activityId === selectedActivityId);
        if (idx >= 0) {
          copy[idx] = { ...copy[idx], status, checkInTime: checkInTimeStr };
        } else {
          copy.push({
            volunteerId: vId,
            activityId: selectedActivityId,
            status,
            checkInTime: checkInTimeStr,
          });
        }
      });
      return copy;
    });

    try {
      await bulkRecordAttendanceAction(selectedActivityId, selectedVolunteers, status);
      setSelectedVolunteers([]);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      alert("Bulk marking failed.");
    } finally {
      setLoading(false);
    }
  };

  // Rows computation matching search, sorting & filters
  const attendanceList = useMemo(() => {
    const list = volunteers.map((vol) => {
      const record = activeRecordsMap.get(vol._id || "");
      return {
        volunteer: vol,
        status: record ? record.status : "Unmarked",
        checkInTime: record?.checkInTime || "--",
      };
    });

    // Filter by search queries
    let result = list;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.volunteer.firstName.toLowerCase().includes(q) ||
          item.volunteer.lastName.toLowerCase().includes(q) ||
          (item.volunteer.skills && item.volunteer.skills.some((s) => s.toLowerCase().includes(q)))
      );
    }

    // Filter by attendance status
    if (statusFilter !== "All") {
      result = result.filter((item) => item.status === statusFilter);
    }

    return result;
  }, [volunteers, activeRecordsMap, search, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const list = volunteers.map((vol) => activeRecordsMap.get(vol._id || "")?.status || "Unmarked");
    const total = volunteers.length;
    const present = list.filter((s) => s === "Present").length;
    const absent = list.filter((s) => s === "Absent").length;
    const late = list.filter((s) => s === "Late").length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, absent, late, rate };
  }, [volunteers, activeRecordsMap]);

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVolunteers(attendanceList.map((item) => item.volunteer._id || ""));
    } else {
      setSelectedVolunteers([]);
    }
  };

  const handleSelectRow = (checked: boolean, vId: string) => {
    if (checked) {
      setSelectedVolunteers((prev) => [...prev, vId]);
    } else {
      setSelectedVolunteers((prev) => prev.filter((id) => id !== vId));
    }
  };

  // Data Export Logic
  const exportToCSV = () => {
    const headers = ["Volunteer Name,Email,Country,Status,Check-in Time\n"];
    const rows = attendanceList.map(
      (item) =>
        `"${item.volunteer.firstName} ${item.volunteer.lastName}","${item.volunteer.email}","${item.volunteer.country || ""}","${item.status}","${item.checkInTime}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Attendance_${currentActivity?.title || "Log"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const headers = ["Name\tEmail\tCountry\tStatus\tCheck-in Time\n"];
    const rows = attendanceList.map(
      (item) =>
        `${item.volunteer.firstName} ${item.volunteer.lastName}\t${item.volunteer.email}\t${item.volunteer.country || ""}\t${item.status}\t${item.checkInTime}\n`
    );
    const blob = new Blob([...headers, ...rows], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Attendance_${currentActivity?.title || "Log"}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerPDFPrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full print:p-0 print:bg-white print:text-black">
      {/* Upper header (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-emerald-400" />
            Attendance Recorder
          </h1>
          <p className="text-slate-400 mt-1">Record volunteer participation and log service hours.</p>
        </div>

        {/* Exports panel */}
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-850 hover:text-white transition-all duration-200"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-850 hover:text-white transition-all duration-200"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
          <button 
            onClick={triggerPDFPrint}
            className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-750 transition-all duration-200"
          >
            <Printer className="h-4 w-4" /> PDF Print
          </button>
        </div>
      </div>

      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Stats Summary (1 col) */}
        <div className="space-y-6">
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white tracking-tight">Attendance Metrics</h2>
            
            {/* HSL Circular Progress Ring */}
            <div className="flex flex-col items-center py-4">
              <div className="relative h-32 w-32 flex items-center justify-center">
                <svg className="absolute transform -rotate-90 w-full h-full">
                  <circle 
                    cx="64" cy="64" r="54" 
                    className="stroke-slate-800" 
                    strokeWidth="10" 
                    fill="transparent" 
                  />
                  <circle 
                    cx="64" cy="64" r="54" 
                    className="stroke-emerald-400 transition-all duration-500 ease-out" 
                    strokeWidth="10" 
                    fill="transparent" 
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 * (1 - stats.rate / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="text-center space-y-0.5">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{stats.rate}%</span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Rate</span>
                </div>
              </div>
            </div>

            {/* Metric Bars */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Present
                </span>
                <span className="text-white font-bold">{stats.present} / {stats.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Late
                </span>
                <span className="text-white font-bold">{stats.late} / {stats.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Absent
                </span>
                <span className="text-white font-bold">{stats.absent} / {stats.total}</span>
              </div>
            </div>
          </div>

          {/* Selector Dropdown (Hidden on PDF print) */}
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-4 print:hidden">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Target Campaign</label>
            <div className="relative">
              <select 
                value={selectedActivityId}
                onChange={(e) => setSelectedActivityId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer font-medium"
              >
                {activities.map((act) => (
                  <option key={act._id} value={act._id}>{act.title}</option>
                ))}
              </select>
            </div>
            {currentActivity && (
              <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block">DATE SCHEDULED</span>
                <span className="text-xs text-slate-300 font-semibold block">{formatLocalDate(currentActivity.date)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Volunteers Checklists (takes 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-6">
            
            {/* Filter actions bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search attendee by name..." 
                  className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Status checkboxes filters */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: "All", label: "All" },
                  { value: "Present", label: "Present" },
                  { value: "Late", label: "Late" },
                  { value: "Absent", label: "Absent" },
                  { value: "Unmarked", label: "Unmarked" },
                ].map((tab) => (
                  <button 
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      statusFilter === tab.value 
                        ? "bg-slate-900 text-white border-slate-800" 
                        : "border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk actions tools */}
            {selectedVolunteers.length > 0 && (
              <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
                <span className="text-xs text-slate-300 font-semibold">
                  Bulk modify <span className="text-white font-bold">{selectedVolunteers.length}</span> selected volunteers
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleBulkStatus("Present")}
                    className="flex items-center gap-1 p-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  >
                    Mark Present
                  </button>
                  <button 
                    onClick={() => handleBulkStatus("Late")}
                    className="flex items-center gap-1 p-1.5 px-3 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
                  >
                    Mark Late
                  </button>
                  <button 
                    onClick={() => handleBulkStatus("Absent")}
                    className="flex items-center gap-1 p-1.5 px-3 rounded-lg text-xs font-bold bg-rose-500 text-white hover:bg-rose-400"
                  >
                    Mark Absent
                  </button>
                </div>
              </div>
            )}

            {/* Attendees list table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20">
                    <th className="py-4 px-4 w-10 print:hidden">
                      <input 
                        type="checkbox" 
                        checked={attendanceList.length > 0 && selectedVolunteers.length === attendanceList.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded accent-emerald-500" 
                      />
                    </th>
                    <th className="py-4 px-4">Volunteer</th>
                    <th className="py-4 px-4">Country</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4">Check-in</th>
                    <th className="py-4 px-4 text-right print:hidden">Check-in Quick Switch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40 text-sm">
                  {attendanceList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        No matches found.
                      </td>
                    </tr>
                  ) : (
                    attendanceList.map((item) => (
                      <tr key={item.volunteer._id} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-4 px-4 print:hidden">
                          <input 
                            type="checkbox" 
                            checked={selectedVolunteers.includes(item.volunteer._id || "")}
                            onChange={(e) => handleSelectRow(e.target.checked, item.volunteer._id || "")}
                            className="rounded accent-emerald-500" 
                          />
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {item.volunteer.firstName.charAt(0)}{item.volunteer.lastName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-white">{item.volunteer.firstName} {item.volunteer.lastName}</div>
                              {item.volunteer.skills && item.volunteer.skills.length > 0 && (
                                <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">{item.volunteer.skills.slice(0, 2).join(", ")}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-400">
                          {item.volunteer.country || "—"}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                            item.status === "Present" 
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                              : item.status === "Late" 
                              ? "text-amber-400 bg-amber-500/10 border-amber-500/20" 
                              : item.status === "Absent" 
                              ? "text-rose-400 bg-rose-500/10 border-rose-500/20" 
                              : "text-slate-400 bg-slate-800 border-slate-700/50"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-400 font-medium">
                          {item.checkInTime}
                        </td>
                        <td className="py-4 px-4 text-right print:hidden">
                          <div className="inline-flex rounded-lg border border-slate-800 p-0.5 bg-slate-900">
                            <button 
                              onClick={() => handleRecordStatus(item.volunteer._id || "", "Present")}
                              className={`p-1 rounded-md transition-colors ${item.status === "Present" ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 hover:text-white"}`}
                              title="Mark Present"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleRecordStatus(item.volunteer._id || "", "Late")}
                              className={`p-1 rounded-md transition-colors ${item.status === "Late" ? "text-amber-400 bg-amber-500/10" : "text-slate-500 hover:text-white"}`}
                              title="Mark Late"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleRecordStatus(item.volunteer._id || "", "Absent")}
                              className={`p-1 rounded-md transition-colors ${item.status === "Absent" ? "text-rose-400 bg-rose-500/10" : "text-slate-500 hover:text-white"}`}
                              title="Mark Absent"
                            >
                              <X className="h-4 w-4" />
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
        </div>

      </div>
    </div>
  );
}
