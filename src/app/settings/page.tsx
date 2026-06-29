import React from "react";
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Sliders, 
  Globe, 
  Save, 
  Undo
} from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8 text-emerald-400" />
            Portal Settings
          </h1>
          <p className="text-slate-400 mt-1">Configure workspace rules, team credentials, and preferences.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-850 hover:text-white transition-all duration-200">
            <Undo className="h-4 w-4" />
            Reset
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200">
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Settings Grid Structure */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Side: Settings Navigation / Sections explanation */}
        <div className="space-y-4">
          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-400" />
              General Preferences
            </h3>
            <p className="text-xs text-slate-500">Manage administrator account and portal branding options.</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 space-y-1">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-400" />
              Notification Settings
            </h3>
            <p className="text-xs text-slate-500">Select when and how to receive weekly digest logs and reminders.</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 space-y-1">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" />
              Access Controls
            </h3>
            <p className="text-xs text-slate-500">Configure roles and check credential logging standards.</p>
          </div>
        </div>

        {/* Right Side: Form Configuration */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Section 1: Administrator profile */}
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-900/60 pb-3 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-emerald-400" />
              Personal Profile
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Full Name</label>
                <input 
                  type="text" 
                  defaultValue="John Doe" 
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Contact Email</label>
                <input 
                  type="email" 
                  defaultValue="john.doe@example.com" 
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Organization Branding */}
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-900/60 pb-3 flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-400" />
              Organization Preferences
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Organization Name</label>
                <input 
                  type="text" 
                  defaultValue="ServeTrack Global" 
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Attendance Rate Target (%)</label>
                  <input 
                    type="number" 
                    defaultValue="85" 
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Portal Default Country</label>
                  <select className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 appearance-none">
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>France</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Notification Toggles */}
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-900/60 pb-3 flex items-center gap-2">
              <Bell className="h-5 w-5 text-emerald-400" />
              Notifications
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900/20 border border-slate-900 rounded-xl">
                <div>
                  <span className="text-sm font-semibold text-white block">Email Weekly Digest</span>
                  <span className="text-xs text-slate-500 block">Weekly statistics and volunteer hours summary report.</span>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded accent-emerald-500" />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/20 border border-slate-900 rounded-xl">
                <div>
                  <span className="text-sm font-semibold text-white block">New Registration Alerts</span>
                  <span className="text-xs text-slate-500 block">Receive instant emails when a volunteer signs up.</span>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded accent-emerald-500" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
