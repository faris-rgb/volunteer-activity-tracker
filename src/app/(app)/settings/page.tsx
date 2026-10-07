import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getDisplayName, requireRouteAccess, type RoleUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { getEditablePortalSettingsAction, type EditablePortalSettings } from "@/app/actions/settings";
import SettingsClient, { type SettingsProfile } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Settings",
};

async function loadProfile(user: RoleUser): Promise<SettingsProfile> {
  const roleLabel = ROLE_LABELS[user.role];
  try {
    const clerkUser = await currentUser();
    if (clerkUser?.id === user.clerkUserId) {
      const email = clerkUser.primaryEmailAddress?.emailAddress ?? user.email;
      return {
        name: getDisplayName({
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
          email,
        }),
        email,
        roleLabel,
      };
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load the current user from Clerk:", error);
  }
  return { name: getDisplayName(user), email: user.email, roleLabel };
}

async function loadSettings(): Promise<EditablePortalSettings | null> {
  try {
    return await getEditablePortalSettingsAction();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load portal settings:", error);
    return null;
  }
}

/** Today's date (YYYY-MM-DD) in Morocco, used for the ESC Quality Label expiry warning. */
function todayInMorocco(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function SettingsPage() {
  const user = await requireRouteAccess("/settings");
  const [profile, settings] = await Promise.all([loadProfile(user), loadSettings()]);

  return <SettingsClient initialSettings={settings} profile={profile} today={todayInMorocco()} />;
}
