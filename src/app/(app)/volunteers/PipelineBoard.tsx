"use client";

import { ArrowRight, FolderKanban, LoaderCircle, SquarePen } from "lucide-react";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGES, type PipelineStage } from "@/lib/domain";
import type { VolunteerData } from "@/app/actions/volunteers";
import { AgeBadge, MembershipBadge, TypeBadge } from "./VolunteerBadges";
import WhatsAppMenu from "./WhatsAppMenu";
import {
  PIPELINE_STAGE_STYLES,
  SHORT_SOURCE_LABELS,
  fullName,
  getNextStage,
  initials,
  type VolunteerPresets,
} from "./volunteerUtils";

type ColumnKey = PipelineStage | "none";

interface PipelineBoardProps {
  volunteers: VolunteerData[];
  today: string;
  canManage: boolean;
  busyIds: ReadonlySet<string>;
  presets: VolunteerPresets;
  onMove: (volunteer: VolunteerData, stage: PipelineStage) => void;
  onEdit: (volunteer: VolunteerData) => void;
  onWhatsAppOpened: (message: string) => void;
}

/** Kanban-style view of the application pipeline: one column per stage. */
export default function PipelineBoard({
  volunteers,
  today,
  canManage,
  busyIds,
  presets,
  onMove,
  onEdit,
  onWhatsAppOpened,
}: PipelineBoardProps) {
  const columns = new Map<ColumnKey, VolunteerData[]>(PIPELINE_STAGES.map((stage) => [stage, []]));
  const unstaged: VolunteerData[] = [];
  for (const vol of volunteers) {
    if (vol.pipelineStage) columns.get(vol.pipelineStage)?.push(vol);
    else unstaged.push(vol);
  }
  const columnKeys: ColumnKey[] = unstaged.length > 0 ? ["none", ...PIPELINE_STAGES] : [...PIPELINE_STAGES];
  if (unstaged.length > 0) columns.set("none", unstaged);

  return (
    <div className="overflow-x-auto pb-2 -mx-1 px-1" role="region" aria-label="Application pipeline">
      <div className="flex gap-4 w-max min-w-full snap-x">
        {columnKeys.map((key) => {
          const items = columns.get(key) ?? [];
          const label = key === "none" ? "No stage" : PIPELINE_STAGE_LABELS[key];
          const dot = key === "none" ? "bg-slate-600" : PIPELINE_STAGE_STYLES[key].dot;
          return (
            <section
              key={key}
              aria-labelledby={`pipeline-column-${key}`}
              className="w-[17rem] shrink-0 snap-start bg-slate-950/40 border border-slate-900 rounded-2xl flex flex-col max-h-[70vh]"
            >
              <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-900/80">
                <h3 id={`pipeline-column-${key}`} className="flex items-center gap-2 text-sm font-bold text-white">
                  <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
                  {label}
                </h3>
                <span className="text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </header>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-600">
                    No volunteers in this stage
                  </div>
                ) : (
                  items.map((vol) => (
                    <PipelineCard
                      key={vol._id}
                      volunteer={vol}
                      today={today}
                      canManage={canManage}
                      isBusy={busyIds.has(vol._id)}
                      presets={presets}
                      onMove={onMove}
                      onEdit={onEdit}
                      onWhatsAppOpened={onWhatsAppOpened}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PipelineCard({
  volunteer: vol,
  today,
  canManage,
  isBusy,
  presets,
  onMove,
  onEdit,
  onWhatsAppOpened,
}: {
  volunteer: VolunteerData;
  today: string;
  canManage: boolean;
  isBusy: boolean;
  presets: VolunteerPresets;
  onMove: (volunteer: VolunteerData, stage: PipelineStage) => void;
  onEdit: (volunteer: VolunteerData) => void;
  onWhatsAppOpened: (message: string) => void;
}) {
  const name = fullName(vol);
  const next = getNextStage(vol.pipelineStage);
  const selectId = `stage-select-${vol._id}`;

  return (
    <article className={`rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2.5 ${isBusy ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center font-bold border text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
          {initials(vol)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate" title={name}>
            {name}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {[vol.nationality, vol.source ? `via ${SHORT_SOURCE_LABELS[vol.source]}` : null].filter(Boolean).join(" · ") ||
              vol.email ||
              "—"}
          </p>
        </div>
        <div className="flex items-center shrink-0 -mr-1 -mt-1">
          <WhatsAppMenu
            firstName={vol.firstName}
            name={name}
            phone={vol.phoneNumber}
            templates={presets.whatsappTemplates}
            organizationName={presets.organizationName}
            onOpened={onWhatsAppOpened}
          />
          {canManage && (
            <button
              type="button"
              onClick={() => onEdit(vol)}
              disabled={isBusy}
              aria-label={`Edit ${name}`}
              title="Edit"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <TypeBadge type={vol.volunteerType} />
        <AgeBadge dateOfBirth={vol.dateOfBirth} volunteerType={vol.volunteerType} today={today} />
        <MembershipBadge membership={vol.membership} today={today} />
      </div>

      {vol.appliedProjectName && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate" title={vol.appliedProjectName}>
          <FolderKanban className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
          {vol.appliedProjectName}
        </p>
      )}

      {canManage && (
        <div className="flex items-center gap-2 pt-1">
          <label htmlFor={selectId} className="sr-only">
            Change stage for {name}
          </label>
          <select
            id={selectId}
            value={vol.pipelineStage ?? ""}
            disabled={isBusy}
            onChange={(event) => {
              const stage = event.target.value as PipelineStage;
              if (stage) onMove(vol, stage);
            }}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
          >
            {!vol.pipelineStage && <option value="">No stage</option>}
            {PIPELINE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {PIPELINE_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
          {next && (
            <button
              type="button"
              onClick={() => onMove(vol, next)}
              disabled={isBusy}
              aria-label={`Move ${name} to ${PIPELINE_STAGE_LABELS[next]}`}
              title={`Move to ${PIPELINE_STAGE_LABELS[next]}`}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
            >
              {isBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              Next
            </button>
          )}
        </div>
      )}
    </article>
  );
}
