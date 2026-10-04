import type { ValidationRule } from "./types";

interface VolunteerValidationRule extends ValidationRule {
  required: () => VolunteerValidationRule;
  email: () => VolunteerValidationRule;
  max: (value: number) => VolunteerValidationRule;
  regex: (pattern: RegExp, options?: { name?: string }) => VolunteerValidationRule;
  unique: () => VolunteerValidationRule;
}

export const volunteerSchema = {
  name: "volunteer",
  title: "Volunteer",
  type: "document",
  fields: [
    {
      name: "firstName",
      title: "First Name",
      type: "string",
      validation: (Rule: VolunteerValidationRule) => Rule.required().max(80),
    },
    {
      name: "lastName",
      title: "Last Name",
      type: "string",
      validation: (Rule: VolunteerValidationRule) => Rule.required().max(80),
    },
    {
      name: "email",
      title: "Email",
      type: "string",
      validation: (Rule: VolunteerValidationRule) => Rule.required().email(),
    },
    {
      name: "phoneNumber",
      title: "Phone Number",
      type: "string",
      validation: (Rule: VolunteerValidationRule) =>
        Rule.max(30).regex(/^\+?[\d\s().-]+$/, { name: "phone number" }),
    },
    {
      name: "country",
      title: "Country",
      type: "string",
      validation: (Rule: VolunteerValidationRule) => Rule.max(80),
    },
    {
      name: "city",
      title: "City",
      type: "string",
      validation: (Rule: VolunteerValidationRule) => Rule.max(80),
    },
    {
      name: "languages",
      title: "Languages",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      validation: (Rule: VolunteerValidationRule) => Rule.unique().max(30),
    },
    {
      name: "skills",
      title: "Skills",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      validation: (Rule: VolunteerValidationRule) => Rule.unique().max(30),
    },
    {
      name: "notes",
      title: "Notes",
      type: "text",
      validation: (Rule: VolunteerValidationRule) => Rule.max(2000),
    },
    {
      name: "active",
      title: "Active",
      type: "boolean",
      initialValue: true,
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
    select: { firstName: "firstName", lastName: "lastName", email: "email" },
    prepare: ({ firstName, lastName, email }: { firstName?: string; lastName?: string; email?: string }) => ({
      title: [firstName, lastName].filter(Boolean).join(" ") || "Unnamed volunteer",
      subtitle: email,
    }),
  },
};
