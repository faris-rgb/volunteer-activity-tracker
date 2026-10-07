"use client";

import React, { useEffect, useId, useState, useSyncExternalStore } from "react";
import { CircleCheck, CircleX, LoaderCircle, X } from "lucide-react";
import { formatDateKey, formatDateLabel } from "@/lib/dates";
import type { FundingType, ProjectStatus } from "@/lib/domain";

/* ---------- Shared constants ---------- */

export const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

export const INPUT_CLASS =
  "w-full bg-slate-950 border rounded-xl px-4 text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]";

export const LABEL_CLASS = "text-xs font-semibold text-slate-400 uppercase tracking-wider block";

export const PRIMARY_BUTTON =
  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-colors";

export const SECONDARY_BUTTON =
  "px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors";

export const FILTER_SELECT =
  "bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50";

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planned: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  open: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  running: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  completed: "text-slate-400 bg-slate-800 border-slate-700/50",
  cancelled: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

/** Short labels for badges and filters (the schema exports the long ones). */
export const PROJECT_STATUS_SHORT: Record<ProjectStatus, string> = {
  planned: "Planned",
  open: "Open",
  running: "Running",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FUNDING_SHORT: Record<FundingType, string> = {
  esc: "ESC",
  self_funded: "Self-funded",
  partner: "Partner-funded",
  other: "Other funding",
};

/** Suggestions for eligible countries / partner countries: ESC programme and partner countries. */
export const COUNTRY_SUGGESTIONS = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "Ireland",
  "Italy",
  "Latvia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Morocco",
  "Netherlands",
  "North Macedonia",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Tunisia",
  "Türkiye",
  "Ukraine",
  "United Kingdom",
];

/* ---------- Helpers ---------- */

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatShortDate(date: string | undefined): string {
  return formatDateLabel(date, { month: "short", day: "numeric", year: "numeric" }, "No date");
}

/** Whole days from one "YYYY-MM-DD" key to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const toDay = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  return Math.round(toDay(to) - toDay(from));
}

function subscribeToDay(callback: () => void) {
  const timer = window.setInterval(callback, 60_000);
  return () => window.clearInterval(timer);
}

function getTodaySnapshot(): string {
  return formatDateKey(new Date());
}

function getServerTodaySnapshot(): null {
  return null;
}

/** Today's "YYYY-MM-DD" in the viewer's time zone, or null while rendering on the server and hydrating. */
export function useTodayKey(): string | null {
  return useSyncExternalStore(subscribeToDay, getTodaySnapshot, getServerTodaySnapshot);
}

/* ---------- Toast ---------- */

export interface ToastMessage {
  id: number;
  kind: "success" | "error";
  message: string;
}

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (kind: ToastMessage["kind"], message: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, kind, message }));
  };

  return { toast, showToast, dismissToast: () => setToast(null) };
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-[60] sm:max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 bg-slate-900 ${
        toast.kind === "success" ? "border-emerald-500/30 text-emerald-300" : "border-rose-500/30 text-rose-300"
      }`}
    >
      {toast.kind === "success" ? (
        <CircleCheck className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <CircleX className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <span className="flex-1">{toast.message}</span>
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

/* ---------- Modal shell ---------- */

interface ModalProps {
  title: string;
  onClose: () => void;
  /** While busy, Escape, the backdrop and the close button do nothing. */
  busy?: boolean;
  size?: "md" | "lg" | "xl";
  role?: "dialog" | "alertdialog";
  describedBy?: string;
  /** Hide the header (used by compact confirmation dialogs that render their own heading). */
  bare?: boolean;
  children: React.ReactNode;
}

const MODAL_WIDTH = { md: "max-w-md", lg: "max-w-lg", xl: "max-w-3xl" };

export function Modal({ title, onClose, busy = false, size = "lg", role = "dialog", describedBy, bare, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className={`bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full ${MODAL_WIDTH[size]} max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200`}
      >
        {bare ? (
          <h3 id={titleId} className="sr-only">
            {title}
          </h3>
        ) : (
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center gap-4 bg-slate-950/40 shrink-0">
            <h3 id={titleId} className="text-lg font-bold text-white">
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
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------- Switch ---------- */

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  pending?: boolean;
  id?: string;
  describedBy?: string;
  size?: "sm" | "md";
}

export function Switch({ checked, onChange, label, disabled, pending, id, describedBy, size = "md" }: SwitchProps) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${track} shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-wait disabled:opacity-60 ${
        checked ? "bg-emerald-500 border-emerald-400" : "bg-slate-800 border-slate-700"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center ${knob} rounded-full bg-white shadow transition-transform ${
          checked ? shift : "translate-x-0.5"
        }`}
      >
        {pending && <LoaderCircle className="h-3 w-3 text-slate-500 animate-spin" />}
      </span>
    </button>
  );
}

/* ---------- Tag input ---------- */

interface TagInputProps {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  invalid?: boolean;
  maxItems?: number;
  maxLength?: number;
  itemLabel?: string;
}

/** Free-text tags: Enter, comma or leaving the field adds the typed value; Backspace on an empty field removes the last tag. */
export function TagInput({
  id,
  values,
  onChange,
  suggestions = [],
  placeholder,
  invalid,
  maxItems = 60,
  maxLength = 60,
  itemLabel = "item",
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const listId = `${id}-suggestions`;
  const lowerValues = values.map((value) => value.toLowerCase());

  const commit = (raw: string) => {
    const additions = raw
      .split(",")
      .map((part) => part.trim().replace(/\s+/g, " ").slice(0, maxLength))
      .filter(Boolean);
    if (additions.length === 0) {
      setDraft("");
      return;
    }
    const next = [...values];
    for (const addition of additions) {
      if (next.length >= maxItems) break;
      if (!next.some((value) => value.toLowerCase() === addition.toLowerCase())) {
        next.push(addition);
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div
      className={`w-full bg-slate-950 border rounded-xl px-2 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:border-emerald-500/50 ${
        invalid ? "border-rose-500/60" : "border-slate-800"
      }`}
    >
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700 pl-2 pr-1 py-0.5 text-xs text-slate-200"
        >
          {value}
          <button
            type="button"
            onClick={() => onChange(values.filter((entry) => entry !== value))}
            aria-label={`Remove ${itemLabel} ${value}`}
            className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        list={suggestions.length > 0 ? listId : undefined}
        maxLength={maxLength * 3}
        placeholder={values.length === 0 ? placeholder : "Add more..."}
        disabled={values.length >= maxItems}
        onChange={(event) => {
          const text = event.target.value;
          const inputType = (event.nativeEvent as InputEvent).inputType;
          // Picking a datalist suggestion replaces the text in one go (no inputType in some browsers).
          const pickedSuggestion =
            (!inputType || inputType === "insertReplacementText") &&
            suggestions.some((suggestion) => suggestion.toLowerCase() === text.trim().toLowerCase());
          if (text.includes(",") || pickedSuggestion) commit(text);
          else setDraft(text);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          } else if (event.key === "Backspace" && !draft && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        className="flex-1 min-w-[8rem] bg-transparent px-2 py-1 text-sm text-white placeholder-slate-600 focus:outline-none"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions
            .filter((suggestion) => !lowerValues.includes(suggestion.toLowerCase()))
            .map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
        </datalist>
      )}
    </div>
  );
}
