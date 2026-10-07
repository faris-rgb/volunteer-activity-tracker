import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, CircleAlert, type LucideIcon } from "lucide-react";

export const CARD_CLASS = "bg-slate-950/40 border border-slate-900 rounded-2xl p-5";

export const PRIMARY_LINK =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all duration-200";

export const TEXT_LINK =
  "inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 hover:underline transition-colors";

/** Card title row: icon + title (+ count) on the left, an optional "see more" link on the right. */
export function CardHeading({
  icon: Icon,
  title,
  id,
  count,
  href,
  linkLabel,
  iconClassName = "text-emerald-400",
}: {
  icon: LucideIcon;
  title: string;
  id?: string;
  count?: number;
  href?: string;
  linkLabel?: string;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-base font-bold text-white min-w-0">
        <Icon className={`h-5 w-5 shrink-0 ${iconClassName}`} aria-hidden="true" />
        <span className="truncate">{title}</span>
        {count !== undefined && (
          <span className="text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5">
            {count}
          </span>
        )}
      </h2>
      {href && linkLabel && (
        <Link href={href} className="shrink-0 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5">
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/** Shown inside a card when its data source failed to load. */
export function CardLoadError({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-3 text-sm text-slate-300">
      <CircleAlert className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" aria-hidden="true" />
      <span>
        {children} <span className="text-slate-500">Reload the page to try again.</span>
      </span>
    </p>
  );
}
