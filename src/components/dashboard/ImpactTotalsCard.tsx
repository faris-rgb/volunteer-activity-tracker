import Link from "next/link";
import { ChevronRight, Sprout, Users } from "lucide-react";
import type { ImpactEntry } from "@/lib/domain";
import { formatImpactValue, impactMetricInfo, totalImpact } from "@/app/(app)/activities/activityShared";
import { IMPACT_ICONS } from "@/app/(app)/activities/components/ImpactChips";
import { CARD_CLASS, CardHeading, CardLoadError, TEXT_LINK } from "./DashboardCard";

/** Sums the impact logged on every activity, per IMPACT_METRICS key (metrics without a total are hidden). */
export default function ImpactTotalsCard({
  activities,
  failed,
  canManage,
}: {
  activities: { impact?: ImpactEntry[] }[];
  failed: boolean;
  canManage: boolean;
}) {
  const totals = totalImpact(activities.map((activity) => activity.impact));
  const loggedOn = activities.filter((activity) => (activity.impact ?? []).some((entry) => entry.value > 0)).length;

  return (
    <section aria-labelledby="impact-totals-heading" className={`${CARD_CLASS} flex flex-col gap-4`}>
      <CardHeading
        id="impact-totals-heading"
        icon={Sprout}
        title="Community Impact"
        iconClassName="text-teal-400"
        href={canManage && totals.length > 0 ? "/activities" : undefined}
        linkLabel="Activities"
      />

      {failed ? (
        <CardLoadError>Activities could not be loaded, so impact totals are unavailable.</CardLoadError>
      ) : totals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <div className="h-11 w-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Sprout className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-300">No impact logged yet.</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Families helped, clothes handed out, kilos of waste collected on the beach — totals add up here.
            </p>
          </div>
          {canManage ? (
            <Link href="/activities" className={TEXT_LINK}>
              Log impact on an activity
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <p className="text-xs text-slate-500">Log impact on an activity to see it here.</p>
          )}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3">
            {totals.map((entry) => {
              const info = impactMetricInfo(entry.metric);
              const Icon = IMPACT_ICONS[entry.metric] ?? Users;
              return (
                <li key={entry.metric} className="rounded-xl border border-slate-900 bg-slate-900/40 p-3 min-w-0">
                  <div className="flex items-center gap-2 text-teal-300">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                      {info.label}
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-white tabular-nums">{formatImpactValue(entry.value)}</span>
                    <span className="text-xs text-slate-500">{info.unit}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-slate-500">
            Logged on {loggedOn} {loggedOn === 1 ? "activity" : "activities"}
          </p>
        </>
      )}
    </section>
  );
}
