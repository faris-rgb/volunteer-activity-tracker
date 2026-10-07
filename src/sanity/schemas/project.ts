// Schema for the "project" document. Fields must match Project in src/lib/domain.ts.
// Partners are stored as an array of references named "partners" (mapped to Project.partnerIds).
import { ESC_RULES, FUNDING_TYPES, PROJECT_STATUSES, type FundingType, type ProjectStatus } from "../../lib/domain";
import type { ValidationRule } from "./types";

interface ProjectValidationRule extends ValidationRule {
  required: () => ProjectValidationRule;
  min: (value: number) => ProjectValidationRule;
  max: (value: number) => ProjectValidationRule;
  integer: () => ProjectValidationRule;
  unique: () => ProjectValidationRule;
  regex: (pattern: RegExp, options?: { name?: string }) => ProjectValidationRule;
  custom: (
    validator: (value: unknown, context: { document?: Record<string, unknown> }) => true | string
  ) => ProjectValidationRule;
  warning: (message?: string) => ProjectValidationRule;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  open: "Open for applications",
  running: "Running",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FUNDING_TYPE_LABELS: Record<FundingType, string> = {
  esc: "European Solidarity Corps (ESC)",
  self_funded: "Self-funded",
  partner: "Partner-funded",
  other: "Other",
};

/** Loose ESC project code format: letters, digits and dashes (e.g. 2026-1-NL02-ESC51-000123). */
export const ESC_PROJECT_CODE_PATTERN = /^[A-Za-z0-9-]+$/;

export const projectSchema = {
  name: "project",
  title: "Project",
  type: "document",
  fields: [
    {
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule: ProjectValidationRule) => Rule.required().max(120),
    },
    {
      name: "description",
      title: "Description",
      type: "text",
      validation: (Rule: ProjectValidationRule) => Rule.max(2000),
    },
    {
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: PROJECT_STATUSES.map((value) => ({ title: PROJECT_STATUS_LABELS[value], value })),
      },
      initialValue: "planned",
      validation: (Rule: ProjectValidationRule) => Rule.required(),
    },
    {
      name: "startDate",
      title: "Start Date",
      type: "date",
      options: { dateFormat: "YYYY-MM-DD" },
      validation: (Rule: ProjectValidationRule) => Rule.required(),
    },
    {
      name: "endDate",
      title: "End Date",
      type: "date",
      options: { dateFormat: "YYYY-MM-DD" },
      validation: (Rule: ProjectValidationRule) =>
        Rule.required().custom((endDate, context) => {
          const startDate = context.document?.startDate;
          if (typeof endDate !== "string" || typeof startDate !== "string") {
            return true;
          }
          return endDate >= startDate || "End date can't be before the start date";
        }),
    },
    {
      name: "applicationDeadline",
      title: "Application Deadline",
      type: "date",
      options: { dateFormat: "YYYY-MM-DD" },
      validation: (Rule: ProjectValidationRule) =>
        Rule.custom((deadline, context) => {
          const startDate = context.document?.startDate;
          if (typeof deadline !== "string" || typeof startDate !== "string") {
            return true;
          }
          return deadline <= startDate || "The deadline is after the start date";
        }).warning(),
    },
    {
      name: "location",
      title: "Location",
      type: "string",
      validation: (Rule: ProjectValidationRule) => Rule.max(120),
    },
    {
      name: "maxParticipants",
      title: "Maximum Participants",
      type: "number",
      validation: (Rule: ProjectValidationRule) => Rule.integer().min(1).max(10000),
    },
    {
      name: "ageMin",
      title: "Minimum Age",
      type: "number",
      description: `ESC projects: ${ESC_RULES.minAge}`,
      validation: (Rule: ProjectValidationRule) => Rule.integer().min(0).max(120),
    },
    {
      name: "ageMax",
      title: "Maximum Age",
      type: "number",
      description: `ESC projects: ${ESC_RULES.maxAge}`,
      validation: (Rule: ProjectValidationRule) =>
        Rule.integer()
          .min(0)
          .max(120)
          .custom((ageMax, context) => {
            const ageMin = context.document?.ageMin;
            if (typeof ageMax !== "number" || typeof ageMin !== "number") {
              return true;
            }
            return ageMax >= ageMin || "Maximum age can't be lower than the minimum age";
          }),
    },
    {
      name: "eligibleCountries",
      title: "Eligible Countries",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      validation: (Rule: ProjectValidationRule) => Rule.unique().max(60),
    },
    {
      name: "funding",
      title: "Funding",
      type: "string",
      options: {
        list: FUNDING_TYPES.map((value) => ({ title: FUNDING_TYPE_LABELS[value], value })),
      },
    },
    {
      name: "escProjectCode",
      title: "ESC Project Code",
      type: "string",
      validation: (Rule: ProjectValidationRule) =>
        Rule.max(60).regex(ESC_PROJECT_CODE_PATTERN, { name: "letters, digits and dashes" }),
    },
    {
      name: "partners",
      title: "Partners",
      type: "array",
      of: [{ type: "reference", to: [{ type: "partner" }] }],
      validation: (Rule: ProjectValidationRule) => Rule.unique().max(30),
    },
    {
      name: "isPublic",
      title: "Show on the public Join page",
      type: "boolean",
      initialValue: false,
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
    { title: "Start date, newest first", name: "startDateDesc", by: [{ field: "startDate", direction: "desc" }] },
  ],
  preview: {
    select: { title: "name", startDate: "startDate", endDate: "endDate", status: "status" },
    prepare: ({
      title,
      startDate,
      endDate,
      status,
    }: {
      title?: string;
      startDate?: string;
      endDate?: string;
      status?: ProjectStatus;
    }) => ({
      title: title || "Untitled project",
      subtitle: [
        [startDate, endDate].filter(Boolean).join(" → "),
        status ? PROJECT_STATUS_LABELS[status] : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    }),
  },
};
