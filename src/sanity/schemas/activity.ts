import type { ValidationRule } from "./types";

interface ActivityValidationRule extends ValidationRule {
  required: () => ActivityValidationRule;
  min: (value: number) => ActivityValidationRule;
  max: (value: number) => ActivityValidationRule;
  integer: () => ActivityValidationRule;
  regex: (pattern: RegExp, options?: { name?: string }) => ActivityValidationRule;
  custom: (
    validator: (value: unknown, context: { document?: Record<string, unknown> }) => true | string
  ) => ActivityValidationRule;
}

const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
      type: "string",
      validation: (Rule: ActivityValidationRule) => Rule.required().max(60),
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
    select: { title: "title", date: "date", startTime: "startTime", status: "status" },
    prepare: ({ title, date, startTime, status }: { title?: string; date?: string; startTime?: string; status?: string }) => ({
      title: title || "Untitled activity",
      subtitle: [date, startTime, status].filter(Boolean).join(" · "),
    }),
  },
};
