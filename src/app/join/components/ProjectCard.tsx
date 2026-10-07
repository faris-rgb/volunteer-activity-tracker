"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, Clock, Globe, MapPin, Users } from "lucide-react";
import { daysUntil, formatAgeRange, formatDateRange, formatDay, type PublicProject } from "../joinShared";

const STATUS_BADGES: Record<PublicProject["status"], { label: string; className: string }> = {
  planned: { label: "Coming soon", className: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  open: { label: "Open for applications", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  running: { label: "Running now", className: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
};

const LONG_DESCRIPTION = 220;
const MAX_COUNTRIES_SHOWN = 4;

function deadlineText(deadline: string, today: string): { text: string; urgent: boolean } {
  const days = daysUntil(today, deadline);
  if (days < 0) return { text: `Applications closed on ${formatDay(deadline)}`, urgent: false };
  if (days === 0) return { text: "Last day to apply: today", urgent: true };
  if (days === 1) return { text: "Apply by tomorrow", urgent: true };
  return { text: `Apply by ${formatDay(deadline)} · ${days} days left`, urgent: days <= 7 };
}

function spotsText(spotsLeft: number | null): string | null {
  if (spotsLeft === null) return null;
  if (spotsLeft === 0) return "Full — join the waiting list";
  return spotsLeft === 1 ? "1 place left" : `${spotsLeft} places left`;
}

export default function ProjectCard({
  project,
  today,
  selected,
  onApply,
}: {
  project: PublicProject;
  today: string;
  selected: boolean;
  onApply: (projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const badge = project.acceptingApplications
    ? STATUS_BADGES[project.status]
    : { label: "Applications closed", className: "border-slate-700 bg-slate-800/60 text-slate-400" };
  const ages = formatAgeRange(project.ageMin, project.ageMax);
  const spots = spotsText(project.spotsLeft);
  const deadline = project.applicationDeadline ? deadlineText(project.applicationDeadline, today) : null;
  const countries = project.eligibleCountries ?? [];
  const isLong = (project.description?.length ?? 0) > LONG_DESCRIPTION;
  const descriptionId = `project-${project.id}-description`;
  const titleId = `project-${project.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={`group flex flex-col rounded-2xl border bg-slate-900/70 p-5 shadow-lg shadow-black/20 transition-colors sm:p-6 ${
        selected ? "border-emerald-500/50 ring-1 ring-emerald-500/30" : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
        {spots && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              project.spotsLeft === 0
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-slate-700 bg-slate-800/60 text-slate-300"
            }`}
          >
            {spots}
          </span>
        )}
      </div>

      <h3 id={titleId} className="mt-3 text-lg font-bold leading-snug text-white">
        {project.name}
      </h3>

      <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
        <li className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span>
            <span className="sr-only">Dates: </span>
            {formatDateRange(project.startDate, project.endDate)}
          </span>
        </li>
        {project.location && (
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>
              <span className="sr-only">Location: </span>
              {project.location}
            </span>
          </li>
        )}
        {ages && (
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>{ages}</span>
          </li>
        )}
        {countries.length > 0 && (
          <li className="flex items-start gap-2">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span title={countries.join(", ")}>
              Open to residents of {countries.slice(0, MAX_COUNTRIES_SHOWN).join(", ")}
              {countries.length > MAX_COUNTRIES_SHOWN && ` and ${countries.length - MAX_COUNTRIES_SHOWN} more`}
            </span>
          </li>
        )}
        {deadline && (
          <li className={`flex items-start gap-2 ${deadline.urgent ? "font-semibold text-amber-300" : ""}`}>
            <Clock
              className={`mt-0.5 h-4 w-4 shrink-0 ${deadline.urgent ? "text-amber-300" : "text-emerald-400"}`}
              aria-hidden="true"
            />
            <span>{deadline.text}</span>
          </li>
        )}
      </ul>

      {project.description && (
        <div className="mt-4">
          <p
            id={descriptionId}
            className={`whitespace-pre-line break-words text-sm leading-relaxed text-slate-400 ${
              isLong && !expanded ? "line-clamp-4" : ""
            }`}
          >
            {project.description}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={descriptionId}
              className="mt-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={() => onApply(project.id)}
          disabled={!project.acceptingApplications}
          aria-describedby={titleId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
        >
          {project.acceptingApplications ? (
            <>
              {selected ? "Selected — continue your application" : "Apply for this project"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          ) : (
            "Applications closed"
          )}
        </button>
      </div>
    </article>
  );
}
