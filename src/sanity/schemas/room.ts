// Schema for the "room" document. Fields must match Room in src/lib/domain.ts.
import type { ValidationRule } from "./types";
import { DEFAULT_LOCATIONS } from "../../lib/domain";

interface RoomValidationRule extends ValidationRule {
  required: () => RoomValidationRule;
  min: (value: number) => RoomValidationRule;
  max: (value: number) => RoomValidationRule;
  integer: () => RoomValidationRule;
}

export const ROOM_MAX_BEDS = 50;

export const roomSchema = {
  name: "room",
  title: "Room",
  type: "document",
  fields: [
    {
      name: "name",
      title: "Name",
      description: 'For example "Volunteer house – room 1".',
      type: "string",
      validation: (Rule: RoomValidationRule) => Rule.required().max(80),
    },
    {
      name: "location",
      title: "Location",
      type: "string",
      options: { list: DEFAULT_LOCATIONS.map((location) => ({ title: location, value: location })) },
      validation: (Rule: RoomValidationRule) => Rule.max(80),
    },
    {
      name: "beds",
      title: "Beds",
      type: "number",
      initialValue: 2,
      validation: (Rule: RoomValidationRule) => Rule.required().integer().min(1).max(ROOM_MAX_BEDS),
    },
    {
      name: "notes",
      title: "Notes",
      type: "text",
      rows: 3,
      validation: (Rule: RoomValidationRule) => Rule.max(1000),
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
    select: { name: "name", location: "location", beds: "beds" },
    prepare: ({ name, location, beds }: { name?: string; location?: string; beds?: number }) => ({
      title: name || "Unnamed room",
      subtitle: [location, typeof beds === "number" ? `${beds} bed${beds === 1 ? "" : "s"}` : null]
        .filter(Boolean)
        .join(" · "),
    }),
  },
};
