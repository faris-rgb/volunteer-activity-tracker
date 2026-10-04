"use server";

import { revalidatePath } from "next/cache";
import { sanityClient, sanityWriteClient, isSanityConfigured } from "@/lib/sanity";
import type { AppRole } from "@/lib/roles";
import { ADMIN_ROLES, isAppRole } from "@/lib/roles";
import { assertActionRole } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import {
  dedupeUsers,
  mockAppUsers,
  setMockAppUsers,
  toAppUser,
  type AppUserData,
  type StoredAppUser,
} from "@/lib/appUsers";

export async function getAppUsersAction(): Promise<AppUserData[]> {
  await assertActionRole(ADMIN_ROLES);

  if (!isSanityConfigured()) {
    return mockAppUsers;
  }

  const query = `*[_type == "appUser"] | order(createdAt desc)`;
  const docs = await sanityClient.fetch<StoredAppUser[]>(query);
  return dedupeUsers(docs.map(toAppUser));
}

export async function assignUserRoleAction(
  userId: string,
  role: AppRole
): Promise<ActionResult<AppUserData>> {
  try {
    const caller = await assertActionRole(ADMIN_ROLES);

    if (!isAppRole(role)) {
      throw new Error("Invalid role");
    }
    if (role === "owner" && caller.role !== "owner") {
      throw new Error("Only an owner can grant the owner role");
    }

    const target = isSanityConfigured()
      ? await sanityClient.getDocument<StoredAppUser>(userId)
      : mockAppUsers.find((user) => user._id === userId);
    if (!target || ("_type" in target && target._type !== "appUser")) {
      throw new Error("User not found");
    }
    const targetUser = toAppUser(target as StoredAppUser);
    if (targetUser.clerkUserId === caller.clerkUserId) {
      throw new Error("You cannot change your own role");
    }
    if (targetUser.role === "owner" && caller.role !== "owner") {
      throw new Error("Only an owner can change another owner's role");
    }

    if (!isSanityConfigured()) {
      setMockAppUsers(
        mockAppUsers.map((user) =>
          user._id === userId ? { ...user, role, status: "active" } : user
        )
      );
      revalidatePath("/admin/assign-roles");
      return actionOk({ ...targetUser, role, status: "active" });
    }

    const updated = await sanityWriteClient
      .patch(userId)
      .set({ role, status: "active" })
      .commit<StoredAppUser>();
    revalidatePath("/admin/assign-roles");
    return actionOk(toAppUser(updated));
  } catch (error) {
    console.error("Failed to assign user role:", error);
    return actionError(error, "Failed to assign role");
  }
}
