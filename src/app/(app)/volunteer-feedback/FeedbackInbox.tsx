"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, ExternalLink, MessageSquareHeart, RotateCcw } from "lucide-react";
import { setFeedbackHandledAction } from "@/app/actions/feedback";
import type { FeedbackEntry } from "@/lib/feedbackShared";

type Filter = "open" | "problems" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Not handled" },
  { key: "problems", label: "With problems" },
  { key: "all", label: "All" },
];

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-GB", { timeZone: "Africa/Casablanca", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Answer({ label, text, tone = "default" }: { label: string; text?: string; tone?: "default" | "warn" }) {
  if (!text) return null;
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-wider ${tone === "warn" ? "text-amber-300" : "text-slate-500"}`}>{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-200">{text}</p>
    </div>
  );
}

export default function FeedbackInbox({ initialEntries, loadError }: { initialEntries: FeedbackEntry[]; loadError: boolean }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState<Filter>("open");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const shown = useMemo(
    () =>
      entries.filter((entry) =>
        filter === "open" ? !entry.handled : filter === "problems" ? entry.hadProblems === "yes" || !!entry.problems : true
      ),
    [entries, filter]
  );
  const openCount = entries.filter((entry) => !entry.handled).length;
  const problemCount = entries.filter((entry) => entry.hadProblems === "yes" || !!entry.problems).length;

  const toggle = async (entry: FeedbackEntry) => {
    setPendingId(entry._id);
    setError(null);
    try {
      const result = await setFeedbackHandledAction(entry._id, !entry.handled);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries((current) => current.map((item) => (item._id === entry._id ? { ...item, handled: result.data.handled } : item)));
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <MessageSquareHeart className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" />
            Volunteer feedback
          </h1>
          <p className="text-slate-400 mt-1">What volunteers liked, didn&apos;t like and what we can improve.</p>
        </div>
        <a
          href="/feedback"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10"
        >
          Open feedback form
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            aria-pressed={filter === item.key}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              filter === item.key ? "bg-emerald-500 text-slate-950" : "border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
            }`}
          >
            {item.label}
            {item.key === "open" && ` (${openCount})`}
            {item.key === "problems" && ` (${problemCount})`}
            {item.key === "all" && ` (${entries.length})`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-slate-400 hover:text-white"
          disabled={isRefreshing}
        >
          <RotateCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {(loadError || error) && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError ? "Feedback could not be loaded. Try Refresh." : error}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center">
          <MessageSquareHeart className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            {entries.length === 0
              ? "No feedback yet. Share the form with volunteers at the end of an activity or project."
              : "Nothing here with this filter."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {shown.map((entry) => {
            const hasProblems = entry.hadProblems === "yes" || !!entry.problems;
            return (
              <li
                key={entry._id}
                className={`rounded-2xl border p-5 ${
                  hasProblems && !entry.handled ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-950/50"
                } ${entry.handled ? "opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{entry.name || "Anonymous"}</p>
                    <p className="text-xs text-slate-500">
                      {entry.about ? `${entry.about} · ` : ""}
                      {formatDate(entry.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasProblems && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                        <CircleAlert className="h-3.5 w-3.5" /> Problems reported
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(entry)}
                      disabled={pendingId === entry._id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        entry.handled
                          ? "border border-slate-700 text-slate-300 hover:text-white"
                          : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      }`}
                    >
                      <CircleCheck className="h-3.5 w-3.5" />
                      {entry.handled ? "Mark as not handled" : "Mark as handled"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Answer label="What was fun" text={entry.liked} />
                  <Answer label="What was not fun" text={entry.disliked} />
                  <Answer label="What could be better" text={entry.improve} />
                  <Answer label={entry.hadProblems === "no" ? "Problems: none" : "Which problems"} text={entry.problems} tone="warn" />
                </div>
                {entry.hadProblems === "no" && !entry.problems && <p className="mt-3 text-xs text-slate-500">No problems reported.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
