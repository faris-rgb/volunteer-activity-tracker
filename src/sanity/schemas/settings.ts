import type { ValidationRule } from "./types";

interface SettingsValidationRule extends ValidationRule {
  required: () => SettingsValidationRule;
  min: (value: number) => SettingsValidationRule;
  max: (value: number) => SettingsValidationRule;
  integer: () => SettingsValidationRule;
  custom: (validator: (value: unknown) => true | string) => SettingsValidationRule;
}

export const PORTAL_SETTINGS_ID = "portalSettings";

export const PORTAL_COUNTRIES = [
  "Australia",
  "Belgium",
  "Canada",
  "France",
  "Germany",
  "Ireland",
  "Italy",
  "Netherlands",
  "Poland",
  "Spain",
  "Ukraine",
  "United Kingdom",
  "United States",
] as const;

function isPortalSettingsDocument(value: unknown): boolean {
  const id = (value as { _id?: unknown } | undefined)?._id;
  return typeof id !== "string" || id === PORTAL_SETTINGS_ID || id.endsWith(`.${PORTAL_SETTINGS_ID}`);
}

export const portalSettingsSchema = {
  name: "portalSettings",
  title: "Portal Settings",
  type: "document",
  validation: (Rule: SettingsValidationRule) =>
    Rule.custom((document) =>
      isPortalSettingsDocument(document)
        ? true
        : `The portal only uses the settings document with ID "${PORTAL_SETTINGS_ID}". Edit that document instead, or save Settings once in the portal to create it.`
    ),
  fields: [
    {
      name: "organizationName",
      title: "Organization Name",
      type: "string",
      validation: (Rule: SettingsValidationRule) => Rule.required().max(100),
    },
    {
      name: "attendanceTarget",
      title: "Attendance Rate Target (%)",
      type: "number",
      initialValue: 85,
      validation: (Rule: SettingsValidationRule) => Rule.required().integer().min(0).max(100),
    },
    {
      name: "defaultCountry",
      title: "Default Country",
      type: "string",
      options: {
        list: PORTAL_COUNTRIES.map((country) => ({ title: country, value: country })),
      },
      validation: (Rule: SettingsValidationRule) => Rule.required(),
    },
    {
      name: "weeklyDigest",
      title: "Weekly Digest Emails",
      type: "boolean",
      initialValue: false,
    },
    {
      name: "registrationAlerts",
      title: "New Registration Alerts",
      type: "boolean",
      initialValue: false,
    },
    {
      name: "updatedAt",
      title: "Updated At",
      type: "datetime",
      readOnly: true,
    },
    {
      name: "updatedBy",
      title: "Updated By",
      type: "string",
      readOnly: true,
    },
    {
      name: "portalRevision",
      title: "Portal Revision",
      type: "string",
      readOnly: true,
      hidden: true,
    },
  ],
};
