import "server-only";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import type { AppRole } from "@/lib/roles";
import { normalizeRole } from "@/lib/roles";

// Server-only data access for app users. Deliberately NOT a "use server" module:
// these functions have no auth checks and must never be callable from the browser.

export interface AppUserData {
  _id?: string;
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: AppRole | null;
  status?: "pending" | "active";
  createdAt?: string;
}

export interface StoredAppUser extends Omit<AppUserData, "role" | "clerkUserId"> {
  _type?: string;
  clerkUserId?: string;
  clerkId?: string;
  role?: string | null;
}

export let mockAppUsers: AppUserData[] = [];

/** Deterministic document id per Clerk user, so concurrent first requests cannot create duplicates.
 *  The "." in the id also keeps these documents out of unauthenticated public reads. */
export const appUserDocId = (clerkUserId: string) => `appUser.${clerkUserId}`;

export function toAppUser(doc: StoredAppUser): AppUserData {
  const role = normalizeRole(doc.role);
  return {
    _id: doc._id,
    clerkUserId: doc.clerkUserId ?? doc.clerkId ?? "",
    email: doc.email ?? "",
    firstName: doc.firstName,
    lastName: doc.lastName,
    role,
    status: role ? "active" : "pending",
    createdAt: doc.createdAt,
  };
}

/** Collapses legacy duplicate records (same Clerk user) to a single entry, preferring one with a role. */
export function dedupeUsers(users: AppUserData[]): AppUserData[] {
  const byClerkId = new Map<string, AppUserData>();
  for (const user of users) {
    const existing = byClerkId.get(user.clerkUserId);
    if (!existing || (!existing.role && user.role)) {
      byClerkId.set(user.clerkUserId, user);
    }
  }
  return [...byClerkId.values()];
}

export async function getAppUserByClerkId(
  clerkUserId: string
): Promise<AppUserData | null> {
  if (!isSanityConfigured()) {
    return mockAppUsers.find((user) => user.clerkUserId === clerkUserId) ?? null;
  }

  try {
    const doc = await sanityClient.getDocument<StoredAppUser>(appUserDocId(clerkUserId));
    if (doc) {
      return toAppUser(doc);
    }

    // Legacy records were created with random ids; prefer the oldest one that has a role.
    const query = `*[_type == "appUser" && (clerkUserId == $clerkId || clerkId == $clerkId)] | order(defined(role) desc, createdAt asc)[0]`;
    const legacy = await sanityClient.fetch<StoredAppUser | null>(query, { clerkId: clerkUserId });
    return legacy ? toAppUser(legacy) : null;
  } catch (error) {
    console.error("Failed to fetch app user from Sanity CMS:", error);
    throw new Error("Could not load your account. Please try again.");
  }
}

export async function getAppUserCount(): Promise<number> {
  if (!isSanityConfigured()) {
    return mockAppUsers.length;
  }

  return sanityClient.fetch<number>(`count(*[_type == "appUser"])`);
}

/** Creates the app user record for a Clerk user. Idempotent: returns the existing record if one exists. */
export async function ensureAppUser(data: {
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: AppRole | null;
}): Promise<AppUserData> {
  const newDoc = {
    _id: appUserDocId(data.clerkUserId),
    _type: "appUser" as const,
    clerkUserId: data.clerkUserId,
    email: data.email,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    role: data.role,
    status: (data.role ? "active" : "pending") as AppUserData["status"],
    createdAt: new Date().toISOString(),
  };

  if (!isSanityConfigured()) {
    const existing = mockAppUsers.find((user) => user.clerkUserId === data.clerkUserId);
    if (existing) {
      return existing;
    }
    const mockDoc = toAppUser(newDoc);
    mockAppUsers = [mockDoc, ...mockAppUsers];
    return mockDoc;
  }

  const created = await sanityWriteClient.createIfNotExists(newDoc);
  return toAppUser(created as unknown as StoredAppUser);
}

/** Grants a role to a user record that has none yet (used for bootstrap owners). */
export async function promotePendingAppUser(user: AppUserData, role: AppRole): Promise<AppUserData> {
  if (!user._id || user.role) {
    return user;
  }
  if (!isSanityConfigured()) {
    const promoted = { ...user, role, status: "active" as const };
    mockAppUsers = mockAppUsers.map((existing) => (existing._id === user._id ? promoted : existing));
    return promoted;
  }
  const updated = await sanityWriteClient
    .patch(user._id)
    .setIfMissing({ role: null })
    .set({ role, status: "active" })
    .commit<StoredAppUser>();
  return toAppUser(updated);
}

export function setMockAppUsers(users: AppUserData[]) {
  mockAppUsers = users;
}
