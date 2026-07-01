import React from "react";
import Link from "next/link";
import { 
  Users, 
  Calendar, 
  Percent, 
  TrendingUp, 
  Plus, 
  Heart,
  ChevronRight,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart2,
  Award
} from "lucide-react";
import { getVolunteersAction } from "@/app/actions/volunteers";
import { getActivitiesAction } from "@/app/actions/activities";
import { getAttendanceRecordsAction } from "@/app/actions/attendance";
import NextActivityCountdown from "@/components/NextActivityCountdown";
import { formatLocalDate, getLocalDateTime } from "@/lib/dates";

export const revalidate = 0; // Fresh stats on reload

export default async function Dashboard() {
  const [volunteers, activities, attendanceRecords] = await Promise.all([
    getVolunteersAction(),
    getActivitiesAction(),
    getAttendanceRecordsAction()
  ]);

  const totalVolunteers = volunteers.length;
  const totalActivities = activities.length;
  const activeActivities = activities.filter((a) => a.status === "Active").length;
  const upcomingActivitiesCount = activities.filter((a) => a.status === "Upcoming").length;

  // Calculate Attendance stats
  const totalRecords = attendanceRecords.length;
  const totalPresent = attendanceRecords.filter((r) => r.status === "Present").length;
  const totalLate = attendanceRecords.filter((r) => r.status === "Late").length;
  const totalAbsent = attendanceRecords.filter((r) => r.status === "Absent").length;

  // Global attendance rate
  const attendanceRate = totalRecords > 0 
    ? Math.round(((totalPresent + totalLate) / totalRecords) * 100)
    : 0;

  // Best attended activity calculation
  const activityRates = activities.map((act) => {
    const actRecords = attendanceRecords.filter((r) => r.activityId === act._id);
    const actTotal = actRecords.length;
    const actPresentLate = actRecords.filter((r) => r.status === "Present" || r.status === "Late").length;
    const rate = actTotal > 0 ? Math.round((actPresentLate / actTotal) * 100) : 0;
    return { title: act.title, rate, totalLogs: actTotal };
  }).filter((item) => item.totalLogs > 0);

  const bestAttended = activityRates.length > 0
    ? [...activityRates].sort((a, b) => b.rate - a.rate)[0]
    : { title: "No campaigns logged yet", rate: 0 };

  const stats = [
    {
      title: "Total Volunteers",
      value: totalVolunteers.toString(),
      change: `+${totalVolunteers} total`,
      changeType: "positive",
      timeframe: "from Sanity CMS",
      icon: Users,
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Active Activities",
      value: activeActivities.toString(),
      change: `+${activeActivities} active`,
      changeType: "positive",
      timeframe: "currently running",
      icon: Activity,
      color: "from-blue-500/10 to-indigo-500/10 text-blue-400 border-blue-500/20",
    },
    {
      title: "Attendance Rate",
      value: `${attendanceRate}%`,
      change: `+${totalPresent + totalLate} checked in`,
      changeType: "positive",
      timeframe: "across all records",
      icon: Percent,
      color: "from-purple-500/10 to-pink-500/10 text-purple-400 border-purple-500/20",
    },
    {
      title: "Upcoming Activities",
      value: upcomingActivitiesCount.toString(),
      change: `${upcomingActivitiesCount} scheduled`,
      changeType: "neutral",
      timeframe: "awaiting start",
      icon: Clock,
      color: "from-amber-500/10 to-orange-500/10 text-amber-400 border-amber-500/20",
    },
  ];

  // Get closest upcoming activity
  const nextActivity = [...activities]
    .filter((a) => a.status === "Upcoming")
    .sort((a, b) => getLocalDateTime(a.date) - getLocalDateTime(b.date))[0];

  // List upcoming activities
  const upcomingList = activities
    .filter((a) => a.status === "Upcoming")
    .slice(0, 3);

  // Take the 3 most recently added volunteers
  const recentSignups = volunteers.slice(0, 3).map((v) => ({
    name: `${v.firstName} ${v.lastName}`,
    email: v.email,
    joined: v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "Just now",
    skills: v.skills || [],
    avatar: `${v.firstName.charAt(0)}${v.lastName.charAt(0)}`,
    avatarColor: v.active 
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
      : "bg-slate-800 text-slate-400 border-slate-700/30",
  }));

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-400 mt-1">Real-time metrics, volunteer engagement, and activity tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/volunteers"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            Manage Volunteers
          </Link>
          <Link 
            href="/activities"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200 font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Activity
          </Link>
        </div>
      </div>

      {/* Countdown Panel */}
      {nextActivity && (
        <NextActivityCountdown 
          activityTitle={nextActivity.title}
          activityDate={nextActivity.date}
          activityTime={nextActivity.startTime}
          location={nextActivity.location}
        />
      )}

      {/* Grid statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div 
              key={idx}
              className="bg-slate-950/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-400">{item.title}</span>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br border ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white tracking-tight">{item.value}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    item.changeType === "positive" 
                      ? "text-emerald-400 bg-emerald-500/10" 
                      : "text-slate-400 bg-slate-800"
                  }`}>
                    {item.change}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  {item.timeframe}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Attendance section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Attendance Breakdown card */}
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Attendance Breakdown</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-white">{totalPresent}</span>
              <span className="text-xs text-slate-400">Present</span>
              <span className="text-2xl font-bold text-white ml-3">{totalLate}</span>
              <span className="text-xs text-slate-400">Late</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-900/60 flex items-center justify-between text-xs text-slate-500">
            <span>Absent count: <span className="text-rose-400 font-bold">{totalAbsent}</span></span>
            <span className="text-emerald-400 font-semibold">{attendanceRate}% success rate</span>
          </div>
        </div>

        {/* Best campaign card */}
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1 flex-1">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Best Attended Campaign</span>
            <span className="text-base font-bold text-white block mt-1.5 truncate max-w-[200px]" title={bestAttended.title}>
              {bestAttended.title}
            </span>
            <span className="text-xs text-emerald-400 font-semibold block">{bestAttended.rate}% average attendance</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Award className="h-5 w-5" />
          </div>
        </div>

        {/* Attendance Trend Line Chart (SVG sparkline) */}
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Attendance Trend</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Stable
            </span>
          </div>
          {/* Beautiful SVG Sparkline */}
          <div className="h-12 w-full mt-2">
            <svg viewBox="0 0 100 30" className="w-full h-full">
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Trend Path */}
              <path 
                d="M0,25 Q15,10 30,18 T60,5 T90,12 L100,8" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="2.5" 
                strokeLinecap="round"
              />
              <path 
                d="M0,25 Q15,10 30,18 T60,5 T90,12 L100,8 L100,30 L0,30 Z" 
                fill="url(#gradient)" 
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Main split section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Upcoming Activities */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-emerald-400" />
              Featured Upcoming Activities
            </h2>
            <Link 
              href="/activities"
              className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
            >
              See all activities
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {upcomingList.length === 0 ? (
              <div className="py-12 border border-slate-900 bg-slate-950/20 rounded-2xl text-center text-slate-500 text-sm">
                No upcoming activities scheduled.
              </div>
            ) : (
              upcomingList.map((act) => {
                const spotsFilled = act.spotsFilled ?? 0;
                return (
                  <div 
                    key={act._id} 
                    className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 hover:border-slate-800 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/50">
                          {act.category}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/20">
                          {act.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white tracking-tight">{act.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400 text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {formatLocalDate(act.date, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {act.startTime} - {act.endTime}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar / Registration metric */}
                    <div className="md:w-48 space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-400">Spots Booked</span>
                        <span className="text-white font-bold">{spotsFilled}/{act.maxVolunteers}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" 
                          style={{ width: `${(spotsFilled / act.maxVolunteers) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Recent Volunteers */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Heart className="h-5 w-5 text-emerald-400" />
              New Volunteers
            </h2>
            <Link 
              href="/volunteers"
              className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
            >
              All volunteers
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 space-y-5">
            {recentSignups.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No volunteers registered yet.</p>
            ) : (
              recentSignups.map((vol, index) => (
                <div 
                  key={index} 
                  className="flex items-start justify-between gap-3 pb-4 last:pb-0 border-b border-slate-900/60 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs border ${vol.avatarColor}`}>
                      {vol.avatar}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-white tracking-tight">{vol.name}</h4>
                      <p className="text-xs text-slate-500">{vol.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {vol.skills.slice(0, 2).map((skill) => (
                          <span 
                            key={skill} 
                            className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800/80"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">{vol.joined}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
