"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CheckSquare, 
  Settings, 
  Menu, 
  X,
  HeartHandshake
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className = "" }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Volunteers", href: "/volunteers", icon: Users },
    { name: "Activities", href: "/activities", icon: Calendar },
    { name: "Attendance", href: "/attendance", icon: CheckSquare },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Top Navbar */}
      <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-slate-950 text-white border-b border-slate-900 sticky top-0 z-40 w-full">
        <div className="flex items-center gap-2">
          <HeartHandshake className="h-6 w-6 text-emerald-400" />
          <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            ServeTrack
          </span>
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Backdrop for Mobile Sidebar */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed top-0 bottom-0 left-0 z-50 lg:z-30 w-64 bg-slate-950 text-slate-300 border-r border-slate-900/80 flex flex-col justify-between transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:h-screen lg:flex
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${className}
        `}
      >
        {/* Upper portion */}
        <div>
          {/* Logo Section */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-slate-900">
            <Link href="/" className="flex items-center gap-2.5" onClick={() => setIsOpen(false)}>
              <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                <HeartHandshake className="h-6 w-6 text-emerald-400" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white bg-gradient-to-r from-white to-slate-200 bg-clip-text">
                ServeTrack
              </span>
            </Link>
            <button 
              onClick={toggleSidebar}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-4 py-6 space-y-1.5">
            <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Management
            </div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                    ${isActive 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)]" 
                      : "border border-transparent hover:bg-slate-900 hover:text-white hover:border-slate-800/50"
                    }
                  `}
                >
                  <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-400"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer/Profile portion */}
        <div className="p-4 border-t border-slate-900 bg-slate-950">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/10">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">John Doe</p>
              <p className="text-xs text-slate-500 truncate">Administrator</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
