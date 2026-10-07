"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, Clock, Globe, MapPin, Users } from "lucide-react";
import { daysUntil, formatAgeRange, formatDateRange, formatDay, type PublicProject } from "../joinShared";

const STATUS_BADGES: Record<PublicProject["status"], { label: string; className: string }> = {
  planned: { label: "Coming soon", className: "border-sky-500/30 bg-sky-50 text-sky-300" },
  open: { label: "Open for applications", className: "border-red-200 bg-red-50 text-brand-red" },
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
    : { label: "Applications closed", className: "border-slate-300 bg-slate-800/60 text-slate-600" };
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
      className={`group flex flex-col rounded-2xl border bg-white p-5 shadow-lg shadow-black/20 transition-colors sm:p-6 ${
        selected ? "border-red-300 ring-1 ring-emerald-500/30" : "border-slate-200 hover:border-slate-300"
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
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-300 bg-slate-800/60 text-slate-700"
            }`}
          >
            {spots}
          </span>
        )}
      </div>

      <h3 id={titleId} className="mt-3 text-lg font-bold leading-snug text-slate-900">
        {project.name}
      </h3>

      <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
        <li className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden="true" />
          <span>
            <span className="sr-only">Dates: </span>
            {formatDateRange(project.startDate, project.endDate)}
          </span>
        </li>
        {project.location && (
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden="true" />
            <span>
              <span className="sr-only">Location: </span>
              {project.location}
            </span>
          </li>
        )}
        {ages && (
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden="true" />
            <span>{ages}</span>
          </li>
        )}
        {countries.length > 0 && (
          <li className="flex items-start gap-2">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden="true" />
            <span title={countries.join(", ")}>
              Open to residents of {countries.slice(0, MAX_COUNTRIES_SHOWN).join(", ")}
              {countries.length > MAX_COUNTRIES_SHOWN && ` and ${countries.length - MAX_COUNTRIES_SHOWN} more`}
            </span>
          </li>
        )}
        {deadline && (
          <li className={`flex items-start gap-2 ${deadline.urgent ? "font-semibold text-amber-700" : ""}`}>
            <Clock
              className={`mt-0.5 h-4 w-4 shrink-0 ${deadline.urgent ? "text-amber-700" : "text-brand-red"}`}
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
            className={`whitespace-pre-line break-words text-sm leading-relaxed text-slate-600 ${
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
              className="mt-1.5 text-xs font-semibold text-brand-red transition-colors hover:text-[#a51f24]"
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-[#a51f24] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
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
