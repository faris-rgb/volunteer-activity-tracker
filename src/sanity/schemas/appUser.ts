import type { ValidationRule } from "./types";

export const appUserSchema = {
  name: "appUser",
  title: "App User",
  type: "document",
  fields: [
    {
      name: "clerkUserId",
      title: "Clerk User ID",
      type: "string",
      readOnly: true,
      validation: (Rule: ValidationRule) => Rule.required(),
    },
    {
      name: "email",
      title: "Email",
      type: "string",
      validation: (Rule: ValidationRule) => Rule.required().email(),
    },
    {
      name: "firstName",
      title: "First Name",
      type: "string",
    },
    {
      name: "lastName",
      title: "Last Name",
      type: "string",
    },
    {
      name: "role",
      title: "Role",
      description: "Empty while the user is waiting for an admin to assign a role.",
      type: "string",
      options: {
        list: [
          { title: "Owner", value: "owner" },
          { title: "Admin", value: "admin" },
          { title: "Staff", value: "staff" },
          { title: "Volunteer", value: "volunteer" },
        ],
      },
    },
    {
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Pending", value: "pending" },
          { title: "Active", value: "active" },
        ],
        layout: "radio",
      },
      initialValue: "pending",
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
    select: { email: "email", firstName: "firstName", lastName: "lastName", role: "role" },
    prepare: ({
      email,
      firstName,
      lastName,
      role,
    }: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    }) => ({
      title: [firstName, lastName].filter(Boolean).join(" ") || email || "Unknown user",
      subtitle: [email, role ?? "pending"].filter(Boolean).join(" · "),
    }),
  },
};
