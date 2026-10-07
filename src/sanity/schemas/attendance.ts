import type { ValidationRule } from "./types";

interface AttendanceValidationRule extends ValidationRule {
  required: () => AttendanceValidationRule;
  min: (value: number) => AttendanceValidationRule;
  max: (value: number) => AttendanceValidationRule;
  custom: (
    validator: (value: unknown, context: { document?: Record<string, unknown> }) => true | string
  ) => AttendanceValidationRule;
}

const MAX_HOURS = 24;

export const attendanceSchema = {
  name: "attendance",
  title: "Attendance",
  type: "document",
  fields: [
    {
      name: "volunteer",
      title: "Volunteer",
      type: "reference",
      to: [{ type: "volunteer" }],
      validation: (Rule: AttendanceValidationRule) => Rule.required(),
    },
    {
      name: "activity",
      title: "Activity",
      type: "reference",
      to: [{ type: "activity" }],
      validation: (Rule: AttendanceValidationRule) => Rule.required(),
    },
    {
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Present", value: "Present" },
          { title: "Absent", value: "Absent" },
          { title: "Late", value: "Late" },
        ],
        layout: "radio",
      },
      initialValue: "Present",
      validation: (Rule: AttendanceValidationRule) => Rule.required(),
    },
    {
      name: "checkInTime",
      title: "Check-in Time",
      description: "ISO timestamp of the check-in. Empty when the volunteer was absent.",
      type: "string",
    },
    {
      name: "hours",
      title: "Hours",
      description:
        "Hours volunteered at this activity (0–24, in 15-minute steps). Defaults to the activity's duration when the volunteer is checked in; empty when absent.",
      type: "number",
      validation: (Rule: AttendanceValidationRule) =>
        Rule.min(0)
          .max(MAX_HOURS)
          .custom((hours, context) => {
            if (hours === undefined || hours === null) {
              return true;
            }
            if (typeof hours !== "number" || !Number.isInteger(hours * 4)) {
              return "Use 15-minute steps (e.g. 2, 2.25, 2.5 or 2.75).";
            }
            const status = context.document?.status;
            return typeof status === "string" && status.toLowerCase() === "absent"
              ? "Absent volunteers can't log hours. Clear this field or change the status."
              : true;
          }),
    },
    {
      name: "notes",
      title: "Notes",
      type: "text",
      validation: (Rule: AttendanceValidationRule) => Rule.max(1000),
    },
    {
      name: "recordedBy",
      title: "Recorded By",
      description: "Set by the server from the signed-in user who saved the record.",
      type: "string",
      readOnly: true,
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      readOnly: true,
      initialValue: () => new Date().toISOString(),
    },
  ],
  preview: {
    select: {
      firstName: "volunteer.firstName",
      lastName: "volunteer.lastName",
      activity: "activity.title",
      status: "status",
      hours: "hours",
    },
    prepare: ({
      firstName,
      lastName,
      activity,
      status,
      hours,
    }: {
      firstName?: string;
      lastName?: string;
      activity?: string;
      status?: string;
      hours?: number;
    }) => ({
      title: [firstName, lastName].filter(Boolean).join(" ") || "Unknown volunteer",
      subtitle: [activity, status, typeof hours === "number" ? `${hours}h` : undefined].filter(Boolean).join(" · "),
    }),
  },
};
