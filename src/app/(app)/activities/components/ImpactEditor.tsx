"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { IMPACT_METRICS, type ImpactEntry, type ImpactMetricKey } from "@/lib/domain";
import { DECIMAL_IMPACT_METRICS, MAX_IMPACT_VALUE } from "@/sanity/schemas/activity";
import { formatImpactValue, impactMetricInfo, sortImpact } from "../activityShared";
import { IMPACT_ICONS } from "./ImpactChips";

/** One editable impact row. `value` is the raw input text so the field can be empty while typing. */
export interface ImpactRow {
  key: number;
  metric: ImpactMetricKey;
  value: string;
}

export function impactToRows(impact: ImpactEntry[] | undefined): ImpactRow[] {
  return sortImpact(impact).map((entry, index) => ({ key: index + 1, metric: entry.metric, value: String(entry.value) }));
}

/** Adds a row for the first metric not used yet; returns the rows unchanged when every metric is used. */
export function addImpactRow(rows: ImpactRow[]): ImpactRow[] {
  const used = new Set(rows.map((row) => row.metric));
  const next = IMPACT_METRICS.find((metric) => !used.has(metric.key));
  if (!next) return rows;
  const key = rows.reduce((max, row) => Math.max(max, row.key), 0) + 1;
  return [...rows, { key, metric: next.key, value: "" }];
}

export function impactInputId(index: number): string {
  return `activity-impact-value-${index}`;
}

/** Validates the rows; returns the entries or the index and message of the first invalid row. */
export function parseImpactRows(
  rows: ImpactRow[]
): { ok: true; impact: ImpactEntry[] } | { ok: false; index: number; message: string } {
  const seen = new Set<ImpactMetricKey>();
  const impact: ImpactEntry[] = [];
  for (const [index, row] of rows.entries()) {
    const { label } = impactMetricInfo(row.metric);
    if (seen.has(row.metric)) {
      return { ok: false, index, message: `"${label}" is listed more than once. Combine the values into one row.` };
    }
    seen.add(row.metric);
    const text = row.value.trim();
    if (!text) {
      return { ok: false, index, message: `Enter a value for "${label}" or remove the row.` };
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, index, message: `"${label}" must be a number of 0 or more.` };
    }
    if (value > MAX_IMPACT_VALUE) {
      return { ok: false, index, message: `"${label}" cannot exceed ${formatImpactValue(MAX_IMPACT_VALUE)}.` };
    }
    if (!DECIMAL_IMPACT_METRICS.includes(row.metric) && !Number.isInteger(value)) {
      return { ok: false, index, message: `"${label}" must be a whole number.` };
    }
    impact.push({ metric: row.metric, value });
  }
  return { ok: true, impact };
}

interface ImpactEditorProps {
  rows: ImpactRow[];
  onChange: (rows: ImpactRow[]) => void;
  invalidIndex: number | null;
  disabled?: boolean;
  inputClassName: (invalid: boolean, extra?: string) => string;
  /** Shown under the heading, e.g. that impact is only stored on the first weekly occurrence. */
  note?: React.ReactNode;
}

/** Editable list of impact counters (metric + value). */
export default function ImpactEditor({ rows, onChange, invalidIndex, disabled = false, inputClassName, note }: ImpactEditorProps) {
  const allUsed = rows.length >= IMPACT_METRICS.length;

  const updateRow = (key: number, patch: Partial<Omit<ImpactRow, "key">>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4" disabled={disabled}>
      <legend className="sr-only">Impact</legend>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Impact</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Log results once the activity is under way or finished. Totals appear on the dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(addImpactRow(rows))}
          disabled={allUsed}
          title={allUsed ? "Every impact counter is already listed" : undefined}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add counter
        </button>
      </div>

      {note && <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">{note}</div>}

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 italic">
          No impact logged yet, e.g. kg of waste collected, clothes distributed or families helped.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const info = impactMetricInfo(row.metric);
            const Icon = IMPACT_ICONS[row.metric];
            const usedElsewhere = new Set(rows.filter((other) => other.key !== row.key).map((other) => other.metric));
            const allowsDecimals = DECIMAL_IMPACT_METRICS.includes(row.metric);
            const invalid = invalidIndex === index;
            return (
              <li key={row.key} className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  {Icon && (
                    <Icon
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-teal-400 pointer-events-none"
                      aria-hidden="true"
                    />
                  )}
                  <select
                    value={row.metric}
                    aria-label={`Impact counter ${index + 1}`}
                    onChange={(event) => updateRow(row.key, { metric: event.target.value as ImpactMetricKey })}
                    className={inputClassName(false, "py-2 pl-9 pr-3 text-slate-200")}
                  >
                    {IMPACT_METRICS.filter((metric) => metric.key === row.metric || !usedElsewhere.has(metric.key)).map(
                      (metric) => (
                        <option key={metric.key} value={metric.key}>
                          {metric.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="relative w-28 sm:w-36 shrink-0">
                  <input
                    id={impactInputId(index)}
                    type="number"
                    min={0}
                    max={MAX_IMPACT_VALUE}
                    step={allowsDecimals ? "0.01" : "1"}
                    inputMode={allowsDecimals ? "decimal" : "numeric"}
                    value={row.value}
                    onChange={(event) => updateRow(row.key, { value: event.target.value })}
                    placeholder="0"
                    aria-label={`${info.label} (${info.unit})`}
                    aria-invalid={invalid ? true : undefined}
                    className={inputClassName(invalid, "py-2 pl-3 pr-12 text-white")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">
                    {info.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((other) => other.key !== row.key))}
                  aria-label={`Remove ${info.label}`}
                  title="Remove counter"
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
