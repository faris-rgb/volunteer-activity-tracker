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
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "activity",
      title: "Activity",
      type: "reference",
      to: [{ type: "activity" }],
      validation: (Rule: any) => Rule.required(),
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
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "checkInTime",
      title: "Check-in Time",
      type: "string",
    },
    {
      name: "notes",
      title: "Notes",
      type: "text",
    },
    {
      name: "recordedBy",
      title: "Recorded By",
      type: "string",
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
    },
  ],
};
