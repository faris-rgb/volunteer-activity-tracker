"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  Settings,
  Menu,
  X,
  HeartHandshake,
  UserCog,
} from "lucide-react";
import type { AppRole } from "@/lib/roles";
import { ROLE_LABELS, ROUTE_PERMISSIONS } from "@/lib/roles";

interface SidebarProps {
  className?: string;
  role: AppRole;
  displayName: string;
}

const MENU_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Volunteers", href: "/volunteers", icon: Users },
  { name: "Activities", href: "/activities", icon: Calendar },
  { name: "Attendance", href: "/attendance", icon: CheckSquare },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Assign Roles", href: "/admin/assign-roles", icon: UserCog },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({
  className = "",
  role,
  displayName,
}: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    desktopQuery.addEventListener("change", handleViewportChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", handleViewportChange);
    };
  }, [isOpen]);

  const menuItems = MENU_ITEMS.filter((item) => ROUTE_PERMISSIONS[item.href]?.includes(role));

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <header className="lg:hidden print:hidden flex items-center justify-between px-6 py-4 bg-slate-950 text-white border-b border-slate-900 sticky top-0 z-40 w-full">
        <Link href="/" className="flex items-center gap-2">
          <HeartHandshake className="h-6 w-6 text-emerald-400" />
          <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            ServeTrack
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isOpen}
          aria-controls="app-sidebar"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {isOpen && (
        <div
          className="lg:hidden print:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`
          fixed top-0 bottom-0 left-0 z-50 w-64 shrink-0 bg-slate-950 text-slate-300 border-r border-slate-900/80 flex flex-col transition-[translate,visibility] duration-300 ease-in-out
          lg:visible lg:translate-x-0 lg:sticky lg:bottom-auto lg:z-30 lg:h-screen print:hidden
          ${isOpen ? "visible translate-x-0" : "invisible -translate-x-full"}
          ${className}
        `}
      >
        <div className="h-20 shrink-0 flex items-center justify-between px-6 border-b border-slate-900">
          <Link href="/" className="flex items-center gap-2.5" onClick={closeSidebar}>
            <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
              <HeartHandshake className="h-6 w-6 text-emerald-400" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">ServeTrack</span>
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-1.5" aria-label="Main navigation">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Menu
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)]"
                      : "border border-transparent hover:bg-slate-900 hover:text-white hover:border-slate-800/50"
                  }
                `}
              >
                <Icon
                  className={`h-5 w-5 transition-transform duration-200 group-hover:scale-105 ${
                    isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-400"
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 p-4 border-t border-slate-900 bg-slate-950">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/10">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate" title={displayName}>
                {displayName}
              </p>
              <p className="text-xs text-slate-500 truncate">{ROLE_LABELS[role]}</p>
            </div>
            <UserButton />
          </div>
        </div>
      </aside>
    </>
  );
}
