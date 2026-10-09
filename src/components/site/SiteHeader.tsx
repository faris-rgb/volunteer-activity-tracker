"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Menu, X } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { NAV_LINKS } from "@/lib/siteContent";
import type { Locale } from "@/i18n/locales";
import type { SiteDictionary } from "@/i18n/site/en";
import LanguageSwitcher from "./LanguageSwitcher";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader({
  organizationName,
  locale,
  t,
}: {
  organizationName: string;
  locale: Locale;
  t: Pick<SiteDictionary, "nav" | "header">;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="h-1 brand-rainbow" aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${organizationName} — ${t.header.homeLabel}`}>
          <BrandMark className="h-10 w-10" />
          <span className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">{organizationName}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 text-[15px] lg:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 font-medium transition-colors ${
                  active ? "bg-red-50 text-brand-red" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {t.nav[link.key]}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 md:inline-flex"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {t.header.staff}
          </Link>
          <div className="hidden sm:block">
            <LanguageSwitcher locale={locale} />
          </div>
          <Link
            href="/join"
            className="inline-flex items-center rounded-full bg-brand-red px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-red-500/25 transition-colors hover:bg-[#a51f24] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            {t.header.joinUs}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-mobile-menu"
            aria-label={open ? t.header.closeMenu : t.header.openMenu}
            className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="site-mobile-menu" aria-label="Main" className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 lg:hidden">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-xl px-4 py-3 text-base font-semibold ${
                      active ? "bg-red-50 text-brand-red" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {t.nav[link.key]}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/sign-in"
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-medium text-slate-500 hover:bg-slate-100"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {t.header.staffSignIn}
              </Link>
            </li>
            <li className="px-2 pt-2 sm:hidden">
              <LanguageSwitcher locale={locale} compact />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
