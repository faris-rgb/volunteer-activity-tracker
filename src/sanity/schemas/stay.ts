// Schema for the "stay" document. Fields must match Stay in src/lib/domain.ts
// (volunteer, project and room are stored as references; the actions expose them as *Id).
import type { ValidationRule } from "./types";
import {
  ALLOWANCE_TYPES,
  ARRIVAL_AIRPORTS,
  PICKUP_STATUSES,
  STAY_STATUSES,
  YOUTHPASS_STATUSES,
  type AllowanceType,
  type PickupStatus,
  type StayStatus,
  type YouthpassStatus,
} from "../../lib/domain";

interface StayValidationRule extends ValidationRule {
  required: () => StayValidationRule;
  min: (value: number) => StayValidationRule;
  max: (value: number) => StayValidationRule;
  precision: (value: number) => StayValidationRule;
  regex: (pattern: RegExp, options?: { name?: string }) => StayValidationRule;
  custom: (
    validator: (value: unknown, context: { document?: Record<string, unknown> }) => true | string
  ) => StayValidationRule;
}

const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const STAY_STATUS_TITLES: Record<StayStatus, string> = {
  planned: "Planned",
  confirmed: "Confirmed",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PICKUP_STATUS_TITLES: Record<PickupStatus, string> = {
  not_needed: "Not needed",
  scheduled: "Scheduled",
  picked_up: "Picked up",
  no_show: "No-show",
  changed: "Changed",
};

const YOUTHPASS_STATUS_TITLES: Record<YouthpassStatus, string> = {
  not_applicable: "Not applicable",
  requested: "Requested",
  issued: "Issued",
};

const ALLOWANCE_TYPE_TITLES: Record<AllowanceType, string> = {
  pocket_money: "Pocket money",
  food: "Food",
  travel: "Travel",
};

function options<T extends string>(values: readonly T[], titles: Record<T, string>) {
  return values.map((value) => ({ title: titles[value], value }));
}

export const staySchema = {
  name: "stay",
  title: "Stay",
  type: "document",
  groups: [
    { name: "stay", title: "Stay", default: true },
    { name: "arrival", title: "Arrival & pickup" },
    { name: "documents", title: "Documents" },
    { name: "allowances", title: "Allowances" },
  ],
  fields: [
    {
      name: "volunteer",
      title: "Volunteer",
      type: "reference",
      to: [{ type: "volunteer" }],
      group: "stay",
      validation: (Rule: StayValidationRule) => Rule.required(),
    },
    {
      name: "project",
      title: "Project",
      type: "reference",
      to: [{ type: "project" }],
      group: "stay",
    },
    {
      name: "status",
      title: "Status",
      type: "string",
      group: "stay",
      options: { list: options(STAY_STATUSES, STAY_STATUS_TITLES), layout: "radio" },
      initialValue: "planned",
      validation: (Rule: StayValidationRule) => Rule.required(),
    },
    {
      name: "arrivalDate",
      title: "Arrival Date",
      type: "date",
      group: "stay",
      options: { dateFormat: "YYYY-MM-DD" },
    },
    {
      name: "departureDate",
      title: "Departure Date",
      type: "date",
      group: "stay",
      options: { dateFormat: "YYYY-MM-DD" },
      validation: (Rule: StayValidationRule) =>
        Rule.custom((departure, context) => {
          const arrival = context.document?.arrivalDate;
          if (typeof departure !== "string" || typeof arrival !== "string") {
            return true;
          }
          return departure > arrival || "Departure must be after the arrival date";
        }),
    },
    {
      name: "room",
      title: "Room",
      type: "reference",
      to: [{ type: "room" }],
      group: "stay",
    },
    {
      name: "youthpassStatus",
      title: "Youthpass",
      type: "string",
      group: "stay",
      options: { list: options(YOUTHPASS_STATUSES, YOUTHPASS_STATUS_TITLES) },
      initialValue: "not_applicable",
    },
    {
      name: "notes",
      title: "Notes",
      type: "text",
      rows: 3,
      group: "stay",
      validation: (Rule: StayValidationRule) => Rule.max(2000),
    },
    {
      name: "arrivalTime",
      title: "Arrival Time",
      description: '24-hour time, e.g. "14:35"',
      type: "string",
      group: "arrival",
      validation: (Rule: StayValidationRule) => Rule.regex(TIME_24H_PATTERN, { name: "24-hour time (HH:mm)" }),
    },
    {
      name: "arrivalAirport",
      title: "Arrival Airport",
      type: "string",
      group: "arrival",
      options: { list: ARRIVAL_AIRPORTS.map((airport) => ({ title: airport.label, value: airport.code })) },
    },
    {
      name: "flightNumber",
      title: "Flight Number",
      type: "string",
      group: "arrival",
      validation: (Rule: StayValidationRule) => Rule.max(20),
    },
    {
      name: "pickupBy",
      title: "Pickup By",
      description: "Team member picking the volunteer up.",
      type: "string",
      group: "arrival",
      validation: (Rule: StayValidationRule) => Rule.max(80),
    },
    {
      name: "pickupStatus",
      title: "Pickup Status",
      type: "string",
      group: "arrival",
      options: { list: options(PICKUP_STATUSES, PICKUP_STATUS_TITLES) },
    },
    {
      name: "documents",
      title: "Documents",
      type: "object",
      group: "documents",
      fields: [
        { name: "passportChecked", title: "Passport checked", type: "boolean", initialValue: false },
        { name: "passportExpiry", title: "Passport expiry", type: "date", options: { dateFormat: "YYYY-MM-DD" } },
        {
          name: "insuranceProvider",
          title: "Insurance provider",
          type: "string",
          validation: (Rule: StayValidationRule) => Rule.max(100),
        },
        {
          name: "insurancePolicyNumber",
          title: "Insurance policy number",
          type: "string",
          validation: (Rule: StayValidationRule) => Rule.max(60),
        },
        {
          name: "criminalRecordDate",
          title: "Criminal record certificate date",
          type: "date",
          options: { dateFormat: "YYYY-MM-DD" },
        },
        { name: "agreementSigned", title: "Volunteer agreement signed", type: "boolean", initialValue: false },
        { name: "photoConsent", title: "Photo consent given", type: "boolean", initialValue: false },
      ],
    },
    {
      name: "allowances",
      title: "Allowance Payments",
      type: "array",
      group: "allowances",
      of: [
        {
          name: "allowancePayment",
          title: "Payment",
          type: "object",
          fields: [
            {
              name: "type",
              title: "Type",
              type: "string",
              options: { list: options(ALLOWANCE_TYPES, ALLOWANCE_TYPE_TITLES) },
              validation: (Rule: StayValidationRule) => Rule.required(),
            },
            {
              name: "date",
              title: "Date",
              type: "date",
              options: { dateFormat: "YYYY-MM-DD" },
              validation: (Rule: StayValidationRule) => Rule.required(),
            },
            {
              name: "amount",
              title: "Amount",
              type: "number",
              validation: (Rule: StayValidationRule) => Rule.required().min(0.01).max(1_000_000).precision(2),
            },
            {
              name: "currency",
              title: "Currency",
              type: "string",
              options: {
                list: [
                  { title: "MAD", value: "MAD" },
                  { title: "EUR", value: "EUR" },
                ],
                layout: "radio",
              },
              initialValue: "MAD",
              validation: (Rule: StayValidationRule) => Rule.required(),
            },
            {
              name: "note",
              title: "Note",
              type: "string",
              validation: (Rule: StayValidationRule) => Rule.max(200),
            },
          ],
          preview: {
            select: { type: "type", date: "date", amount: "amount", currency: "currency" },
            prepare: ({
              type,
              date,
              amount,
              currency,
            }: {
              type?: AllowanceType;
              date?: string;
              amount?: number;
              currency?: string;
            }) => ({
              title: `${type ? ALLOWANCE_TYPE_TITLES[type] ?? type : "Payment"} · ${amount ?? 0} ${currency ?? ""}`.trim(),
              subtitle: date,
            }),
          },
        },
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
  orderings: [
    { title: "Arrival, newest first", name: "arrivalDesc", by: [{ field: "arrivalDate", direction: "desc" }] },
  ],
  preview: {
    select: {
      firstName: "volunteer.firstName",
      lastName: "volunteer.lastName",
      project: "project.name",
      arrivalDate: "arrivalDate",
      status: "status",
    },
    prepare: ({
      firstName,
      lastName,
      project,
      arrivalDate,
      status,
    }: {
      firstName?: string;
      lastName?: string;
      project?: string;
      arrivalDate?: string;
      status?: StayStatus;
    }) => ({
      title: [firstName, lastName].filter(Boolean).join(" ") || "Unknown volunteer",
      subtitle: [project, arrivalDate, status ? STAY_STATUS_TITLES[status] ?? status : null].filter(Boolean).join(" · "),
    }),
  },
};
