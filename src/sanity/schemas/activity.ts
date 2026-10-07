import type { ValidationRule } from "./types";
import { DEFAULT_ACTIVITY_CATEGORIES, IMPACT_METRICS, type ImpactMetricKey } from "../../lib/domain";

interface ActivityValidationRule extends ValidationRule {
  required: () => ActivityValidationRule;
  min: (value: number) => ActivityValidationRule;
  max: (value: number) => ActivityValidationRule;
  integer: () => ActivityValidationRule;
  regex: (pattern: RegExp, options?: { name?: string }) => ActivityValidationRule;
  custom: (
    validator: (value: unknown, context: { document?: Record<string, unknown>; parent?: unknown }) => true | string
  ) => ActivityValidationRule;
}

const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const IMPACT_METRIC_KEYS: readonly string[] = IMPACT_METRICS.map((metric) => metric.key);

/** Largest impact value accepted by the portal (and Studio), per counter. */
export const MAX_IMPACT_VALUE = 1_000_000;

/** Impact counters that may hold decimals (weights). All other counters are whole numbers. */
export const DECIMAL_IMPACT_METRICS: readonly ImpactMetricKey[] = ["waste_kg"];

/** Maximum number of weekly occurrences the portal creates in one "Repeat weekly" request. */
export const ACTIVITY_MAX_WEEKLY_REPEATS = 12;

function impactMetricLabel(metric: unknown): string {
  return IMPACT_METRICS.find((entry) => entry.key === metric)?.label ?? String(metric ?? "Impact");
}

/** Each impact counter may appear at most once per activity. */
function validateUniqueImpactMetrics(value: unknown): true | string {
  if (!Array.isArray(value)) {
    return true;
  }
  const seen = new Set<string>();
  for (const entry of value) {
    const metric = (entry as { metric?: unknown } | null)?.metric;
    if (typeof metric !== "string") continue;
    if (seen.has(metric)) {
      return `"${impactMetricLabel(metric)}" is listed more than once. Combine the values into one row.`;
    }
    seen.add(metric);
  }
  return true;
}

export const activitySchema = {
  name: "activity",
  title: "Activity",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule: ActivityValidationRule) => Rule.required().max(120),
    },
    {
      name: "description",
      title: "Description",
      type: "text",
      validation: (Rule: ActivityValidationRule) => Rule.max(2000),
    },
    {
      name: "date",
      title: "Date",
      type: "date",
      options: { dateFormat: "YYYY-MM-DD" },
      validation: (Rule: ActivityValidationRule) => Rule.required(),
    },
    {
      name: "startTime",
      title: "Start Time",
      description: '24-hour time, e.g. "09:00"',
      type: "string",
      validation: (Rule: ActivityValidationRule) =>
        Rule.required().regex(TIME_24H_PATTERN, { name: "24-hour time (HH:mm)" }),
    },
    {
      name: "endTime",
      title: "End Time",
      description: '24-hour time, e.g. "13:00"',
      type: "string",
      validation: (Rule: ActivityValidationRule) =>
        Rule.required()
          .regex(TIME_24H_PATTERN, { name: "24-hour time (HH:mm)" })
          .custom((endTime, context) => {
            const startTime = context.document?.startTime;
            if (typeof endTime !== "string" || typeof startTime !== "string") {
              return true;
            }
            return endTime > startTime || "End time must be after the start time";
          }),
    },
    {
      name: "location",
      title: "Location",
      type: "string",
      validation: (Rule: ActivityValidationRule) => Rule.required().max(200),
    },
    {
      name: "maxVolunteers",
      title: "Maximum Volunteers",
      type: "number",
      validation: (Rule: ActivityValidationRule) => Rule.required().integer().min(1).max(10000),
    },
    {
      name: "category",
      title: "Category",
      description: `Usually one of the portal presets (e.g. ${DEFAULT_ACTIVITY_CATEGORIES.slice(0, 3).join(", ")}), or free text.`,
      type: "string",
      validation: (Rule: ActivityValidationRule) => Rule.required().max(60),
    },
    {
      name: "project",
      title: "Project",
      description: "The project this activity belongs to (optional).",
      type: "reference",
      to: [{ type: "project" }],
    },
    {
      name: "impact",
      title: "Impact",
      description: "Impact counters logged for this activity. They are totalled on the dashboard.",
      type: "array",
      of: [
        {
          type: "object",
          name: "impactEntry",
          title: "Impact counter",
          fields: [
            {
              name: "metric",
              title: "Counter",
              type: "string",
              options: {
                list: IMPACT_METRICS.map((metric) => ({ title: `${metric.label} (${metric.unit})`, value: metric.key })),
              },
              validation: (Rule: ActivityValidationRule) =>
                Rule.required().custom((value) =>
                  typeof value !== "string" || IMPACT_METRIC_KEYS.includes(value) ? true : "Unknown impact counter"
                ),
            },
            {
              name: "value",
              title: "Value",
              type: "number",
              validation: (Rule: ActivityValidationRule) =>
                Rule.required()
                  .min(0)
                  .max(MAX_IMPACT_VALUE)
                  .custom((value, context) => {
                    const metric = (context.parent as { metric?: unknown } | undefined)?.metric;
                    if (typeof value !== "number" || Number.isInteger(value)) return true;
                    return DECIMAL_IMPACT_METRICS.some((key) => key === metric) ? true : "Use a whole number for this counter";
                  }),
            },
          ],
          preview: {
            select: { metric: "metric", value: "value" },
            prepare: ({ metric, value }: { metric?: string; value?: number }) => {
              const unit = IMPACT_METRICS.find((entry) => entry.key === metric)?.unit ?? "";
              return {
                title: impactMetricLabel(metric),
                subtitle: typeof value === "number" ? `${value} ${unit}`.trim() : "No value",
              };
            },
          },
        },
      ],
      validation: (Rule: ActivityValidationRule) => Rule.custom((value) => validateUniqueImpactMetrics(value)),
    },
    {
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Upcoming", value: "Upcoming" },
          { title: "Active", value: "Active" },
          { title: "Completed", value: "Completed" },
        ],
        layout: "radio",
      },
      initialValue: "Upcoming",
      validation: (Rule: ActivityValidationRule) => Rule.required(),
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      readOnly: true,
      initialValue: () => new Date().toISOString(),
    },
  ],
  orderings: [
    {
      title: "Date, newest first",
      name: "dateDesc",
      by: [
        { field: "date", direction: "desc" },
        { field: "startTime", direction: "desc" },
      ],
    },
  ],
  preview: {
    select: { title: "title", date: "date", startTime: "startTime", status: "status", project: "project.name" },
    prepare: ({
      title,
      date,
      startTime,
      status,
      project,
    }: {
      title?: string;
      date?: string;
      startTime?: string;
      status?: string;
      project?: string;
    }) => ({
      title: title || "Untitled activity",
      subtitle: [date, startTime, status, project].filter(Boolean).join(" · "),
    }),
  },
};
