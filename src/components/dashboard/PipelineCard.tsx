import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { PIPELINE_STAGE_LABELS } from "@/lib/domain";
import { PIPELINE_STAGE_STYLES } from "@/app/(app)/volunteers/volunteerUtils";
import { CARD_CLASS, CardHeading, CardLoadError, TEXT_LINK } from "./DashboardCard";
import type { PipelineSummary } from "./dashboardData";

const PIPELINE_HREF = "/volunteers?view=pipeline";

/** Volunteer counts per pipeline stage (managers only). `summary` is null when volunteers failed to load. */
export default function PipelineCard({ summary }: { summary: PipelineSummary | null }) {
  const total = summary ? summary.inPipeline + summary.unstaged : 0;
  const max = summary ? Math.max(1, ...summary.counts.map((entry) => entry.count)) : 1;

  return (
    <section aria-labelledby="pipeline-heading" className={`${CARD_CLASS} flex flex-col gap-4`}>
      <CardHeading
        id="pipeline-heading"
        icon={Workflow}
        title="Recruitment Pipeline"
        iconClassName="text-indigo-400"
        href={summary && total > 0 ? PIPELINE_HREF : undefined}
        linkLabel="Open pipeline"
      />

      {!summary ? (
        <CardLoadError>Volunteers could not be loaded.</CardLoadError>
      ) : total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <div className="h-11 w-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Workflow className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-300">No applicants yet.</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Applications from the join page land in &ldquo;{PIPELINE_STAGE_LABELS.lead}&rdquo;. Share the link on
              Instagram or add someone you met yourself.
            </p>
          </div>
          <Link href="/volunteers?new=1" className={TEXT_LINK}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add volunteer
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {summary.counts.map(({ stage, count }) => (
              <li key={stage}>
                <Link
                  href={PIPELINE_HREF}
                  aria-label={`${PIPELINE_STAGE_LABELS[stage]}: ${count}. Open the pipeline.`}
                  className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 text-slate-300 group-hover:text-white min-w-0">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${PIPELINE_STAGE_STYLES[stage].dot}`} aria-hidden="true" />
                      <span className="truncate">{PIPELINE_STAGE_LABELS[stage]}</span>
                    </span>
                    <span className={`font-bold tabular-nums ${count > 0 ? "text-white" : "text-slate-600"}`}>{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${PIPELINE_STAGE_STYLES[stage].dot} opacity-80 group-hover:opacity-100`}
                      style={{ width: `${count === 0 ? 0 : Math.max(4, Math.round((count / max) * 100))}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="pt-3 border-t border-slate-900/60 text-[11px] text-slate-500">
            {summary.inPipeline} in the pipeline
            {summary.unstaged > 0 && ` · ${summary.unstaged} without a stage yet`}
          </p>
        </>
      )}
    </section>
  );
}
