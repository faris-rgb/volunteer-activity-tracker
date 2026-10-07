"use server";

import { revalidatePath } from "next/cache";
import { assertActionRole } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { MANAGER_ROLES } from "@/lib/roles";
import { isSanityConfigured, sanityClient, sanityWriteClient } from "@/lib/sanity";
import type { Room } from "@/lib/domain";
import { ROOM_MAX_BEDS } from "@/sanity/schemas/room";
import { getStaysAction } from "@/app/actions/stays";

export type RoomInput = Omit<Room, "_id">;

/** Errors whose message is safe and useful to show to the user. */
class RoomError extends Error {}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ROOM_PROJECTION = `{ _id, name, location, beds, notes }`;

// In-memory store used only when no Sanity project is configured.
let mockRooms: Room[] = [];

type RawRoom = { _id: string; name?: string | null; location?: string | null; beds?: number | null; notes?: string | null };

function normalizeRoom(doc: RawRoom): Room {
  return {
    _id: doc._id,
    name: doc.name?.trim() || "Unnamed room",
    location: doc.location?.trim() || undefined,
    beds: Number.isInteger(doc.beds) && (doc.beds as number) > 0 ? (doc.beds as number) : 1,
    notes: doc.notes?.trim() || undefined,
  };
}

function readText(value: unknown, label: string, { required = false, max = 100 } = {}): string {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new RoomError(`${label} is invalid.`);
  }
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) {
    throw new RoomError(`${label} is required.`);
  }
  if (text.length > max) {
    throw new RoomError(`${label} must be at most ${max} characters.`);
  }
  return text;
}

function parseRoomInput(input: unknown): RoomInput {
  if (!input || typeof input !== "object") {
    throw new RoomError("Invalid room details.");
  }
  const data = input as Record<string, unknown>;
  const name = readText(data.name, "Room name", { required: true, max: 80 });
  const location = readText(data.location, "Location", { max: 80 });
  const notes = readText(data.notes, "Notes", { max: 1000 });
  const beds = typeof data.beds === "number" ? data.beds : Number.NaN;
  if (!Number.isInteger(beds) || beds < 1 || beds > ROOM_MAX_BEDS) {
    throw new RoomError(`Beds must be a whole number between 1 and ${ROOM_MAX_BEDS}.`);
  }
  return { name, location: location || undefined, beds, notes: notes || undefined };
}

function parseId(value: unknown): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value) || value.startsWith("drafts.") || value.startsWith("versions.")) {
    throw new RoomError("Invalid room id.");
  }
  return value;
}

function sanityStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return undefined;
}

async function authorize() {
  try {
    return await assertActionRole(MANAGER_ROLES);
  } catch (error) {
    throw new RoomError(error instanceof Error && error.message ? error.message : "You do not have permission to do this.");
  }
}

function failure(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof RoomError) {
    return actionError(error);
  }
  console.error(fallback, error);
  const statusCode = sanityStatusCode(error);
  if (statusCode === 401 || statusCode === 403) {
    return actionError(null, "Sanity rejected the request. Check the API token permissions and try again.");
  }
  return actionError(null, fallback);
}

function revalidateRoomPages() {
  revalidatePath("/stays");
}

async function loadRooms(): Promise<Room[]> {
  if (!isSanityConfigured()) {
    return [...mockRooms].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }
  const docs = await sanityClient.fetch<RawRoom[]>(`*[_type == "room"] | order(lower(name) asc)${ROOM_PROJECTION}`);
  return docs.map(normalizeRoom);
}

function assertUniqueName(rooms: Room[], name: string, exceptId?: string) {
  const key = name.toLowerCase();
  if (rooms.some((room) => room._id !== exceptId && room.name.toLowerCase() === key)) {
    throw new RoomError(`A room called "${name}" already exists.`);
  }
}

/** All rooms, sorted by name. Managers only; throws when Sanity cannot be read. */
export async function getRoomsAction(): Promise<Room[]> {
  await assertActionRole(MANAGER_ROLES);
  try {
    return await loadRooms();
  } catch (error) {
    console.error("Failed to load rooms from Sanity:", error);
    throw new Error("Could not load rooms. Please try again.");
  }
}

export async function createRoomAction(input: RoomInput): Promise<ActionResult<Room>> {
  try {
    await authorize();
    const data = parseRoomInput(input);
    assertUniqueName(await loadRooms(), data.name);
    const createdAt = new Date().toISOString();

    if (!isSanityConfigured()) {
      const room: Room = { _id: `room-${Date.now().toString(36)}`, ...data };
      mockRooms = [...mockRooms, room];
      revalidateRoomPages();
      return actionOk(room);
    }

    const created = await sanityWriteClient.create({ _type: "room", ...stripUndefined(data), createdAt });
    revalidateRoomPages();
    return actionOk(normalizeRoom({ ...data, _id: created._id }));
  } catch (error) {
    return failure(error, "Could not create the room. Please try again.");
  }
}

export async function updateRoomAction(id: string, input: RoomInput): Promise<ActionResult<Room>> {
  try {
    await authorize();
    const roomId = parseId(id);
    const data = parseRoomInput(input);
    const rooms = await loadRooms();
    if (!rooms.some((room) => room._id === roomId)) {
      throw new RoomError("Room not found. It may have been deleted.");
    }
    assertUniqueName(rooms, data.name, roomId);

    if (!isSanityConfigured()) {
      const room: Room = { _id: roomId, ...data };
      mockRooms = mockRooms.map((item) => (item._id === roomId ? room : item));
      revalidateRoomPages();
      return actionOk(room);
    }

    const unset = (["location", "notes"] as const).filter((key) => data[key] === undefined);
    let patch = sanityWriteClient.patch(roomId).set(stripUndefined(data));
    if (unset.length > 0) {
      patch = patch.unset([...unset]);
    }
    await patch.commit();
    revalidateRoomPages();
    return actionOk({ _id: roomId, ...data });
  } catch (error) {
    return failure(error, "Could not update the room. Please try again.");
  }
}

/** Deletes a room. Refused while any stay (including cancelled ones) still has this room assigned. */
export async function deleteRoomAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await authorize();
    const roomId = parseId(id);

    if (!isSanityConfigured()) {
      if (!mockRooms.some((room) => room._id === roomId)) {
        throw new RoomError("Room not found. It may already have been deleted.");
      }
      const linked = (await getStaysAction()).filter((stay) => stay.roomId === roomId).length;
      if (linked > 0) {
        throw new RoomError(
          `${linked} stay${linked === 1 ? " is" : "s are"} still assigned to this room. Move ${linked === 1 ? "it" : "them"} to another room first.`
        );
      }
      mockRooms = mockRooms.filter((room) => room._id !== roomId);
      revalidateRoomPages();
      return actionOk({ id: roomId });
    }

    const linked = await sanityClient.fetch<{ exists: boolean; stays: number; draftIds: string[] }>(
      `{
        "exists": defined(*[_type == "room" && _id == $id][0]._id),
        "stays": count(*[_type == "stay" && room._ref == $id]),
        "draftIds": *[_id == $draftId]._id
      }`,
      { id: roomId, draftId: `drafts.${roomId}` },
      { perspective: "raw" }
    );
    if (!linked.exists) {
      throw new RoomError("Room not found. It may already have been deleted.");
    }
    if (linked.stays > 0) {
      throw new RoomError(
        `${linked.stays} stay${linked.stays === 1 ? " is" : "s are"} still assigned to this room. Move ${linked.stays === 1 ? "it" : "them"} to another room first.`
      );
    }

    const transaction = sanityWriteClient.transaction();
    for (const docId of [...linked.draftIds, roomId]) {
      transaction.delete(docId);
    }
    await transaction.commit();
    revalidateRoomPages();
    return actionOk({ id: roomId });
  } catch (error) {
    if (sanityStatusCode(error) === 409) {
      console.error("Room delete blocked by references:", error);
      return actionError(null, "Other documents in Sanity still reference this room, so it can't be deleted yet.");
    }
    return failure(error, "Could not delete the room. Please try again.");
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
