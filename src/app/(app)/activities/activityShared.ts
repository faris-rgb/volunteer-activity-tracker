import { IMPACT_METRICS, type ImpactEntry, type ImpactMetricKey, type ProjectStatus } from "@/lib/domain";

/** The project fields the activities page needs (from getProjectsAction). */
export interface ActivityProjectOption {
  _id: string;
  name: string;
  status: ProjectStatus;
  location?: string;
  startDate?: string;
  endDate?: string;
}

/** Project filter value: "All", "none" (activities without a project) or a project id. */
export type ProjectFilter = string;
export const PROJECT_FILTER_ALL = "All";
export const PROJECT_FILTER_NONE = "none";

/** Projects that can still get new activities are listed first in the form. */
export const OPEN_PROJECT_STATUSES: readonly ProjectStatus[] = ["planned", "open", "running"];

const IMPACT_CHIP_LABELS: Record<ImpactMetricKey, { one: string; other: string }> = {
  participants: { one: "participant", other: "participants" },
  families: { one: "family", other: "families" },
  clothes: { one: "clothing item", other: "clothing items" },
  waste_kg: { one: "kg waste", other: "kg waste" },
  bikes: { one: "bike repaired", other: "bikes repaired" },
  lessons: { one: "lesson", other: "lessons" },
  institutions: { one: "institution visit", other: "institution visits" },
};

const METRIC_ORDER = new Map<string, number>(IMPACT_METRICS.map((metric, index) => [metric.key, index]));

export function impactMetricInfo(metric: ImpactMetricKey) {
  return IMPACT_METRICS.find((entry) => entry.key === metric) ?? IMPACT_METRICS[0];
}

export function formatImpactValue(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** "120 kg waste", "1 family", "35 families". */
export function formatImpactEntry(entry: ImpactEntry): string {
  const labels = IMPACT_CHIP_LABELS[entry.metric];
  const word = labels ? (entry.value === 1 ? labels.one : labels.other) : impactMetricInfo(entry.metric).label;
  return `${formatImpactValue(entry.value)} ${word}`;
}

/** Entries sorted in the IMPACT_METRICS order. */
export function sortImpact(entries: ImpactEntry[] | undefined): ImpactEntry[] {
  return [...(entries ?? [])].sort((a, b) => (METRIC_ORDER.get(a.metric) ?? 99) - (METRIC_ORDER.get(b.metric) ?? 99));
}

/** "120 kg waste · 35 families" */
export function summarizeImpact(entries: ImpactEntry[] | undefined): string {
  return sortImpact(entries).map(formatImpactEntry).join(" · ");
}

/** Sums impact per metric over several activities (zero totals are omitted). */
export function totalImpact(lists: (ImpactEntry[] | undefined)[]): ImpactEntry[] {
  const totals = new Map<ImpactMetricKey, number>();
  for (const list of lists) {
    for (const entry of list ?? []) {
      totals.set(entry.metric, (totals.get(entry.metric) ?? 0) + entry.value);
    }
  }
  return sortImpact(
    Array.from(totals, ([metric, value]) => ({ metric, value: Math.round(value * 100) / 100 })).filter(
      (entry) => entry.value > 0
    )
  );
}

/** Adds whole days to a "YYYY-MM-DD" date (calendar arithmetic, time-zone free). Returns "" for invalid input. */
export function addDaysToDateKey(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  if (Number.isNaN(shifted.getTime())) return "";
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Keeps preset lists clean: trimmed, non-empty, unique, in the given order. */
export function cleanOptions(values: readonly (string | null | undefined)[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values ?? []) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}
