"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { CircleCheck, TriangleAlert, X } from "lucide-react";
import type { ActionResult } from "@/lib/actionResult";
import { formatDateKey } from "@/lib/dates";

export interface Notice {
  type: "success" | "error";
  message: string;
}

export const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

/** Runs a server action and turns a network failure into an ActionResult error. */
export async function callAction<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch (error) {
    console.error(error);
    return { ok: false, error: NETWORK_ERROR };
  }
}

export function inputClassName(error?: string | null) {
  return `w-full bg-slate-950 border rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors disabled:opacity-60 ${
    error ? "border-rose-500/60 focus:border-rose-400" : "border-slate-800 focus:border-emerald-500/50"
  }`;
}

export const SELECT_FILTER_CLASS =
  "bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50";

export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200";

export const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-colors";

export const ICON_BUTTON =
  "p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-50 transition-colors";

export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <label htmlFor={id} className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Badge({ className, children, title }: { className: string; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export function WarningBox({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "rose" }) {
  const toneClass =
    tone === "rose"
      ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
      : "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${toneClass}`}>
      <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Centered modal shell matching the volunteers/activities dialogs. */
export function Modal({
  titleId,
  title,
  onClose,
  busy,
  size = "md",
  role = "dialog",
  children,
}: {
  titleId: string;
  title: ReactNode;
  onClose: () => void;
  busy?: boolean;
  size?: "md" | "lg" | "xl";
  role?: "dialog" | "alertdialog";
  children: ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const width = size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-slate-900 border border-slate-800 rounded-2xl w-full ${width} max-h-[95vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200`}
      >
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex justify-between items-center gap-3 bg-slate-950/40 shrink-0">
          <h3 id={titleId} className="text-lg font-bold text-white min-w-0 truncate">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, notice.type === "success" ? 4000 : 8000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;
  return (
    <div
      role={notice.type === "error" ? "alert" : "status"}
      className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[60] sm:max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
        notice.type === "success"
          ? "border-emerald-500/30 bg-slate-900/95 text-emerald-300"
          : "border-rose-500/30 bg-slate-900/95 text-rose-300"
      }`}
    >
      {notice.type === "success" ? (
        <CircleCheck className="h-4 w-4 mt-0.5 shrink-0" />
      ) : (
        <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <span className="flex-1">{notice.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-slate-500 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function subscribeToDayChanges(callback: () => void) {
  const timer = window.setInterval(callback, 60_000);
  return () => window.clearInterval(timer);
}

function getDeviceToday(): string {
  return formatDateKey(new Date());
}

/** Today's "YYYY-MM-DD" on this device; uses the server's value while rendering on the server and hydrating. */
export function useTodayKey(serverToday: string): string {
  return useSyncExternalStore(subscribeToDayChanges, getDeviceToday, () => serverToday);
}
