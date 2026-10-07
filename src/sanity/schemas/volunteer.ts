import type { ValidationRule } from "./types";
import {
  APPLICATION_SOURCE_LABELS,
  APPLICATION_SOURCES,
  DIET_OPTIONS,
  ESC_RULES,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  VOLUNTEER_TYPE_LABELS,
  VOLUNTEER_TYPES,
  ageOn,
} from "../../lib/domain";

interface VolunteerValidationRule extends ValidationRule {
  required: () => VolunteerValidationRule;
  email: () => VolunteerValidationRule;
  min: (value: number) => VolunteerValidationRule;
  max: (value: number) => VolunteerValidationRule;
  precision: (value: number) => VolunteerValidationRule;
  regex: (pattern: RegExp, options?: { name?: string }) => VolunteerValidationRule;
  unique: () => VolunteerValidationRule;
  custom: (
    fn: (value: unknown, context: { document?: Record<string, unknown> }) => true | string
  ) => VolunteerValidationRule;
  warning: () => VolunteerValidationRule;
}

const PHONE_REGEX = /^\+?[\d\s().-]+$/;

const DIET_LABELS: Record<(typeof DIET_OPTIONS)[number], string> = {
  none: "No restrictions",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  halal: "Halal",
  other: "Other (see notes)",
};

export const volunteerSchema = {
  name: "volunteer",
  title: "Volunteer",
  type: "document",
  groups: [
    { name: "basics", title: "Basics", default: true },
    { name: "profile", title: "Profile" },
    { name: "application", title: "Application" },
    { name: "membership", title: "Membership" },
    { name: "care", title: "Emergency & health" },
  ],
  fields: [
    {
      name: "firstName",
      title: "First Name",
      type: "string",
      group: "basics",
      validation: (Rule: VolunteerValidationRule) => Rule.required().max(80),
    },
    {
      name: "lastName",
      title: "Last Name",
      type: "string",
      group: "basics",
      validation: (Rule: VolunteerValidationRule) => Rule.required().max(80),
    },
    {
      name: "email",
      title: "Email",
      type: "string",
      group: "basics",
      validation: (Rule: VolunteerValidationRule) => Rule.required().email(),
    },
    {
      name: "phoneNumber",
      title: "Phone Number",
      description: "Include the country code (e.g. +212 6 12 34 56 78) so the WhatsApp button works.",
      type: "string",
      group: "basics",
      validation: (Rule: VolunteerValidationRule) => Rule.max(30).regex(PHONE_REGEX, { name: "phone number" }),
    },
    {
      name: "country",
      title: "Country of residence",
      type: "string",
      group: "basics",
      validation: (Rule: VolunteerValidationRule) => Rule.max(80),
    },
    {
      name: "city",
      title: "City",
      type: "string",
      group: "basics",
      validation: (Rule: VolunteerValidationRule) => Rule.max(80),
    },
    {
      name: "notes",
      title: "Notes",
      type: "text",
      group: "basics",
      validation: (Rule: VolunteerValidationRule) => Rule.max(2000),
    },
    {
      name: "active",
      title: "Active",
      type: "boolean",
      group: "basics",
      initialValue: true,
    },

    /* ---------- Profile ---------- */
    {
      name: "volunteerType",
      title: "Volunteer type",
      type: "string",
      group: "profile",
      options: {
        list: VOLUNTEER_TYPES.map((value) => ({ title: VOLUNTEER_TYPE_LABELS[value], value })),
      },
      initialValue: "local",
    },
    {
      name: "dateOfBirth",
      title: "Date of birth",
      description: "ESC volunteers must be 18-30 years old.",
      type: "date",
      group: "profile",
      options: { dateFormat: "YYYY-MM-DD" },
      validation: (Rule: VolunteerValidationRule) =>
        Rule.custom((value, context) => {
          if (typeof value !== "string" || context.document?.volunteerType !== "incoming_esc") {
            return true;
          }
          const age = ageOn(value);
          return age !== null && (age < ESC_RULES.minAge || age > ESC_RULES.maxAge)
            ? `Age ${age} is outside the ESC age range of ${ESC_RULES.minAge}-${ESC_RULES.maxAge}.`
            : true;
        }).warning(),
    },
    {
      name: "nationality",
      title: "Nationality",
      type: "string",
      group: "profile",
      validation: (Rule: VolunteerValidationRule) => Rule.max(80),
    },
    {
      name: "diet",
      title: "Diet",
      type: "string",
      group: "profile",
      options: {
        list: DIET_OPTIONS.map((value) => ({ title: DIET_LABELS[value], value })),
      },
    },
    {
      name: "languages",
      title: "Languages",
      type: "array",
      group: "profile",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      validation: (Rule: VolunteerValidationRule) => Rule.unique().max(30),
    },
    {
      name: "skills",
      title: "Skills",
      type: "array",
      group: "profile",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      validation: (Rule: VolunteerValidationRule) => Rule.unique().max(30),
    },

    /* ---------- Application ---------- */
    {
      name: "pipelineStage",
      title: "Pipeline stage",
      type: "string",
      group: "application",
      options: {
        list: PIPELINE_STAGES.map((value) => ({ title: PIPELINE_STAGE_LABELS[value], value })),
      },
      initialValue: "lead",
    },
    {
      name: "source",
      title: "Application source",
      description: "How the volunteer found the association.",
      type: "string",
      group: "application",
      options: {
        list: APPLICATION_SOURCES.map((value) => ({ title: APPLICATION_SOURCE_LABELS[value], value })),
      },
    },
    {
      name: "appliedProject",
      title: "Applied for project",
      description: "Project chosen on the public join form.",
      type: "reference",
      group: "application",
      to: [{ type: "project" }],
      weak: true,
    },
    {
      name: "motivation",
      title: "Motivation",
      description: "Submitted by the applicant on the public join form.",
      type: "text",
      group: "application",
      readOnly: true,
      validation: (Rule: VolunteerValidationRule) => Rule.max(4000),
    },
    {
      name: "intakeNotes",
      title: "Intake notes",
      description: "Internal notes from the exploratory meeting.",
      type: "text",
      group: "application",
      validation: (Rule: VolunteerValidationRule) => Rule.max(2000),
    },

    /* ---------- Membership ("Vimians") ---------- */
    {
      name: "membership",
      title: "Membership",
      type: "object",
      group: "membership",
      options: { collapsible: false },
      fields: [
        { name: "isMember", title: "Member of the association", type: "boolean", initialValue: false },
        { name: "memberSince", title: "Member since", type: "date", options: { dateFormat: "YYYY-MM-DD" } },
        { name: "paidUntil", title: "Membership paid until", type: "date", options: { dateFormat: "YYYY-MM-DD" } },
        {
          name: "lastPaymentAmount",
          title: "Last payment amount",
          type: "number",
          validation: (Rule: VolunteerValidationRule) => Rule.min(0).max(100000).precision(2),
        },
        {
          name: "lastPaymentCurrency",
          title: "Currency",
          type: "string",
          options: { list: ["MAD", "EUR"], layout: "radio", direction: "horizontal" },
        },
      ],
    },

    /* ---------- Emergency & health (restricted in the portal) ---------- */
    {
      name: "emergencyContact",
      title: "Emergency contact",
      description: "Visible to owners, admins and staff in the portal.",
      type: "object",
      group: "care",
      fields: [
        {
          name: "name",
          title: "Name",
          type: "string",
          validation: (Rule: VolunteerValidationRule) => Rule.max(100),
        },
        {
          name: "phone",
          title: "Phone",
          type: "string",
          validation: (Rule: VolunteerValidationRule) => Rule.max(30).regex(PHONE_REGEX, { name: "phone number" }),
        },
        {
          name: "relation",
          title: "Relation",
          type: "string",
          validation: (Rule: VolunteerValidationRule) => Rule.max(60),
        },
      ],
    },
    {
      name: "medicalNotes",
      title: "Medical notes",
      description: "Allergies, conditions or medication. Visible to owners and admins only in the portal.",
      type: "text",
      group: "care",
      validation: (Rule: VolunteerValidationRule) => Rule.max(2000),
    },
    {
      name: "applicationDetails",
      title: "Application form answers",
      description: "Extra answers from the public Join form (read-only copy of what the applicant sent).",
      type: "object",
      group: "application",
      readOnly: true,
      fields: [
        { name: "submittedAt", title: "Submitted at", type: "datetime" },
        { name: "gender", title: "Gender", type: "string" },
        { name: "address", title: "Address", type: "string" },
        { name: "escPortalId", title: "European Youth Portal registration number", type: "string" },
        { name: "sendingOrganisation", title: "Sending organisation", type: "string" },
        { name: "travelFrom", title: "Travelling from", type: "string" },
        { name: "availableFrom", title: "Available from", type: "date" },
        { name: "availableTo", title: "Available until", type: "date" },
        { name: "occupation", title: "Occupation", type: "string" },
        { name: "education", title: "Education / field of study", type: "string" },
        { name: "previousVolunteering", title: "Previous volunteering", type: "text" },
        { name: "expectations", title: "What they hope to learn", type: "text" },
        { name: "supportNeeds", title: "Support needs", type: "text" },
        { name: "photoConsent", title: "Photo consent", type: "boolean" },
      ],
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
    select: { firstName: "firstName", lastName: "lastName", email: "email", stage: "pipelineStage" },
    prepare: ({
      firstName,
      lastName,
      email,
      stage,
    }: {
      firstName?: string;
      lastName?: string;
      email?: string;
      stage?: string;
    }) => ({
      title: [firstName, lastName].filter(Boolean).join(" ") || "Unnamed volunteer",
      subtitle: [stage && PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS], email]
        .filter(Boolean)
        .join(" · "),
    }),
  },
};
