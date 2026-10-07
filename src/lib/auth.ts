import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  ensureAppUser,
  getAppUserByClerkId,
  getAppUserCount,
  promotePendingAppUser,
  type AppUserData,
} from "@/lib/appUsers";
import type { AppRole } from "@/lib/roles";
import { canRoleAccessRoute } from "@/lib/roles";

export type RoleUser = AppUserData & { role: AppRole };

/** Emails listed in OWNER_EMAILS (comma-separated) always get the owner role, e.g. after switching Clerk instances. */
function isBootstrapOwner(email: string | undefined): boolean {
  if (!email) {
    return false;
  }
  const owners = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(email.trim().toLowerCase());
}

export const getOrCreateAppUser = cache(async (): Promise<AppUserData | null> => {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const existing = await getAppUserByClerkId(userId);
  if (existing?.role) {
    return existing;
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.verification?.status === "verified"
      ? clerkUser.primaryEmailAddress.emailAddress
      : "";

  if (existing) {
    return isBootstrapOwner(email) ? promotePendingAppUser(existing, "owner") : existing;
  }

  const isFirstUser = (await getAppUserCount()) === 0;

  return ensureAppUser({
    clerkUserId: userId,
    email: email || (clerkUser?.emailAddresses[0]?.emailAddress ?? ""),
    firstName: clerkUser?.firstName ?? undefined,
    lastName: clerkUser?.lastName ?? undefined,
    // The very first account (or a configured bootstrap owner) becomes the owner so someone can assign roles.
    role: isFirstUser || isBootstrapOwner(email) ? "owner" : null,
  });
});

export function getDisplayName(user: Pick<AppUserData, "firstName" | "lastName" | "email">): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User";
}

export async function requireAuthenticatedAppUser(): Promise<AppUserData> {
  const appUser = await getOrCreateAppUser();
  if (!appUser) {
    redirect("/sign-in");
  }
  return appUser;
}

export async function requireAssignedRole(): Promise<RoleUser> {
  const appUser = await requireAuthenticatedAppUser();
  if (!appUser.role) {
    redirect("/pending-role");
  }
  return appUser as RoleUser;
}

/** For pages/layouts: redirects to the dashboard when the role is not allowed. */
export async function requireRole(allowedRoles: AppRole[]): Promise<RoleUser> {
  const appUser = await requireAssignedRole();
  if (!allowedRoles.includes(appUser.role)) {
    redirect("/dashboard");
  }
  return appUser;
}

export async function requireRouteAccess(pathname: string): Promise<RoleUser> {
  const appUser = await requireAssignedRole();
  if (!canRoleAccessRoute(appUser.role, pathname)) {
    redirect("/dashboard");
  }
  return appUser;
}

/**
 * For server actions: throws (instead of redirecting) when the caller is not signed in
 * or lacks one of the allowed roles. Wrap with try/catch + actionError() in mutating actions.
 */
export async function assertActionRole(allowedRoles: AppRole[]): Promise<RoleUser> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("You must be signed in.");
  }
  // Shares the request-cached lookup with the layout, so a first sign-in (where the layout
  // creates the user record while the page renders in parallel) isn't seen as "no account".
  const appUser = await getOrCreateAppUser();
  if (!appUser?.role || !allowedRoles.includes(appUser.role)) {
    throw new Error("You do not have permission to do this.");
  }
  return appUser as RoleUser;
}
