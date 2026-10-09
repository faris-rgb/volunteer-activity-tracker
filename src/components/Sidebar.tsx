"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  FolderKanban,
  PlaneLanding,
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  Settings,
  Menu,
  X,
  UserCog,
  ExternalLink,
} from "lucide-react";
import BrandMark from "@/components/BrandMark";
import type { AppRole } from "@/lib/roles";
import { ROLE_LABELS, ROUTE_PERMISSIONS } from "@/lib/roles";

interface SidebarProps {
  className?: string;
  role: AppRole;
  displayName: string;
}

const MENU_GROUPS = [
  { title: "Overview", items: [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Programme",
    items: [
      { name: "Projects", href: "/projects", icon: FolderKanban },
      { name: "Activities", href: "/activities", icon: Calendar },
      { name: "Attendance", href: "/attendance", icon: CheckSquare },
    ],
  },
  {
    title: "People",
    items: [
      { name: "Volunteers", href: "/volunteers", icon: Users },
      { name: "Stays & Arrivals", href: "/stays", icon: PlaneLanding },
    ],
  },
  {
    title: "Admin",
    items: [
      { name: "Settings", href: "/settings", icon: Settings },
      { name: "Assign Roles", href: "/admin/assign-roles", icon: UserCog },
    ],
  },
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

  const menuGroups = MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => ROUTE_PERMISSIONS[item.href]?.includes(role))
      .map((item) => (role === "owner" && item.href === "/dashboard" ? { ...item, name: "Owner console" } : item)),
  })).filter((group) => group.items.length > 0);
  const canShareJoinPage = ROUTE_PERMISSIONS["/volunteers"]?.includes(role);

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
      <header className="lg:hidden print:hidden flex items-center justify-between px-5 py-3 bg-slate-950/90 backdrop-blur text-white border-b border-slate-800/70 sticky top-0 z-40 w-full">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <BrandMark className="h-9 w-9" />
          <span className="font-bold tracking-tight text-white">Volunteer in Morocco</span>
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
          fixed top-0 bottom-0 left-0 z-50 w-72 shrink-0 bg-slate-950 text-slate-300 border-r border-slate-800/60 flex flex-col transition-[translate,visibility] duration-300 ease-in-out
          lg:visible lg:translate-x-0 lg:sticky lg:bottom-auto lg:z-30 lg:h-screen print:hidden
          ${isOpen ? "visible translate-x-0" : "invisible -translate-x-full"}
          ${className}
        `}
      >
        <div className="relative h-24 shrink-0 flex items-center justify-between px-5 border-b border-slate-800/60 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-zellige opacity-[0.07]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 brand-rainbow" aria-hidden="true" />
          <Link href="/dashboard" className="relative flex items-center gap-3" onClick={closeSidebar}>
            <BrandMark className="h-12 w-12" />
            <span className="leading-tight">
              <span className="block font-extrabold text-[15px] tracking-tight text-white">Volunteer in Morocco</span>
              <span className="block text-[11px] font-medium text-brand-sand/80">Martil · Tetouan</span>
            </span>
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

        <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-5" aria-label="Main navigation">
          {menuGroups.map((group) => (
          <div key={group.title} className="space-y-1">
          <div className="px-3 mb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-[0.14em]">
            {group.title}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                aria-current={isActive ? "page" : undefined}
                className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group
                  ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-300 border border-emerald-500/25 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.6)]"
                      : "border border-transparent text-slate-400 hover:bg-slate-900/80 hover:text-white"
                  }
                `}
              >
                <Icon
                  className={`h-5 w-5 transition-transform duration-200 group-hover:scale-105 ${
                    isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-400"
                  }`}
                />
                {item.name}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-400" aria-hidden="true" />
                )}
              </Link>
            );
          })}
          </div>
          ))}

          {canShareJoinPage && (
            <a
              href="/join"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-1 flex items-center justify-between gap-3 rounded-xl border border-brand-sand/20 bg-brand-sand/5 px-3 py-3 text-sm font-semibold text-brand-sand hover:bg-brand-sand/10 transition-colors"
            >
              <span>
                <span className="block">Public join page</span>
                <span className="block text-[11px] font-normal text-brand-sand/60">Share it on Instagram</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          )}
        </nav>

        <div className="shrink-0 p-4 border-t border-slate-900 bg-slate-950">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 to-brand-sand flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/10">
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
