// Schema for the "partner" document. Fields must match Partner in src/lib/domain.ts.
import type { Partner } from "../../lib/domain";
import type { ValidationRule } from "./types";

interface PartnerValidationRule extends ValidationRule {
  required: () => PartnerValidationRule;
  max: (value: number) => PartnerValidationRule;
  uri: (options?: { scheme?: string[] }) => PartnerValidationRule;
}

export type PartnerType = NonNullable<Partner["type"]>;

/** Allowed values for Partner.type, in display order. */
export const PARTNER_TYPES: readonly PartnerType[] = [
  "sending_org",
  "ngo",
  "school",
  "care_home",
  "orphanage",
  "municipality",
  "other",
];

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  sending_org: "Sending organisation",
  ngo: "NGO / association",
  school: "School",
  care_home: "Care home",
  orphanage: "Orphanage",
  municipality: "Municipality",
  other: "Other",
};

export const partnerSchema = {
  name: "partner",
  title: "Partner",
  type: "document",
  fields: [
    {
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule: PartnerValidationRule) => Rule.required().max(120),
    },
    {
      name: "type",
      title: "Type",
      type: "string",
      options: {
        list: PARTNER_TYPES.map((value) => ({ title: PARTNER_TYPE_LABELS[value], value })),
      },
    },
    {
      name: "country",
      title: "Country",
      type: "string",
      validation: (Rule: PartnerValidationRule) => Rule.max(80),
    },
    {
      name: "website",
      title: "Website",
      type: "url",
      validation: (Rule: PartnerValidationRule) => Rule.uri({ scheme: ["http", "https"] }),
    },
    {
      name: "notes",
      title: "Notes",
      type: "text",
      validation: (Rule: PartnerValidationRule) => Rule.max(2000),
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      readOnly: true,
      initialValue: () => new Date().toISOString(),
    },
  ],
  orderings: [{ title: "Name", name: "nameAsc", by: [{ field: "name", direction: "asc" }] }],
  preview: {
    select: { title: "name", country: "country", type: "type" },
    prepare: ({ title, country, type }: { title?: string; country?: string; type?: PartnerType }) => ({
      title: title || "Unnamed partner",
      subtitle: [type ? PARTNER_TYPE_LABELS[type] : undefined, country].filter(Boolean).join(" · "),
    }),
  },
};
