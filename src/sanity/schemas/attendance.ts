import type { ValidationRule } from "./types";

interface AttendanceValidationRule extends ValidationRule {
  required: () => AttendanceValidationRule;
  max: (value: number) => AttendanceValidationRule;
}

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
    },
    prepare: ({
      firstName,
      lastName,
      activity,
      status,
    }: {
      firstName?: string;
      lastName?: string;
      activity?: string;
      status?: string;
    }) => ({
      title: [firstName, lastName].filter(Boolean).join(" ") || "Unknown volunteer",
      subtitle: [activity, status].filter(Boolean).join(" · "),
    }),
  },
};
