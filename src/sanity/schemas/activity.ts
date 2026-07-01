import type { ValidationRule } from "./types";

export const activitySchema = {
  name: "activity",
  title: "Activity",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule: ValidationRule) => Rule.required(),
    },
    {
      name: "description",
      title: "Description",
      type: "text",
    },
    {
      name: "date",
      title: "Date",
      type: "date",
      validation: (Rule: ValidationRule) => Rule.required(),
    },
    {
      name: "startTime",
      title: "Start Time",
      type: "string",
      placeholder: "e.g. 09:00 AM",
      validation: (Rule: ValidationRule) => Rule.required(),
    },
    {
      name: "endTime",
      title: "End Time",
      type: "string",
      placeholder: "e.g. 01:00 PM",
      validation: (Rule: ValidationRule) => Rule.required(),
    },
    {
      name: "location",
      title: "Location",
      type: "string",
      validation: (Rule: ValidationRule) => Rule.required(),
    },
    {
      name: "maxVolunteers",
      title: "Maximum Volunteers",
      type: "number",
      validation: (Rule: ValidationRule) => Rule.required().min(1),
    },
    {
      name: "category",
      title: "Category",
      type: "string",
      validation: (Rule: ValidationRule) => Rule.required(),
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
      },
      initialValue: "Upcoming",
      validation: (Rule: ValidationRule) => Rule.required(),
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
    },
  ],
};
