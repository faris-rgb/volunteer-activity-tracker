import React from "react";
import { Bike, BookOpen, Building2, House, Recycle, Shirt, Users, type LucideIcon } from "lucide-react";
import type { ImpactEntry, ImpactMetricKey } from "@/lib/domain";
import { formatImpactEntry, formatImpactValue, impactMetricInfo, sortImpact, summarizeImpact } from "../activityShared";

export const IMPACT_ICONS: Record<ImpactMetricKey, LucideIcon> = {
  participants: Users,
  families: House,
  clothes: Shirt,
  waste_kg: Recycle,
  bikes: Bike,
  lessons: BookOpen,
  institutions: Building2,
};

interface ImpactChipsProps {
  impact: ImpactEntry[] | undefined;
  size?: "sm" | "md";
  className?: string;
}

/** Compact impact summary, e.g. "120 kg waste" "35 families". Renders nothing when there is no impact. */
export default function ImpactChips({ impact, size = "sm", className = "" }: ImpactChipsProps) {
  const entries = sortImpact(impact);
  if (entries.length === 0) {
    return null;
  }
  const sizeClass = size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label={`Impact: ${summarizeImpact(entries)}`}>
      {entries.map((entry) => {
        const Icon = IMPACT_ICONS[entry.metric] ?? Users;
        const info = impactMetricInfo(entry.metric);
        return (
          <li
            key={entry.metric}
            title={`${info.label}: ${formatImpactValue(entry.value)} ${info.unit}`}
            className={`inline-flex items-center gap-1 rounded-md border border-teal-500/20 bg-teal-500/10 font-semibold text-teal-300 whitespace-nowrap ${sizeClass}`}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            {formatImpactEntry(entry)}
          </li>
        );
      })}
    </ul>
  );
}
