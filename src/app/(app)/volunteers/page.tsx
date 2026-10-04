import React from "react";
import { unstable_rethrow } from "next/navigation";
import VolunteersClient from "./VolunteersClient";
import { getVolunteersAction, type VolunteerData } from "@/app/actions/volunteers";
import { getPortalSettingsAction } from "@/app/actions/settings";
import { requireRouteAccess } from "@/lib/auth";
import { MANAGER_ROLES } from "@/lib/roles";

export const revalidate = 0; // Disable server caching for this page to ensure fresh queries

async function loadVolunteers(): Promise<{ volunteers: VolunteerData[]; loadError: string | null }> {
  try {
    return { volunteers: await getVolunteersAction(), loadError: null };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load the volunteer directory:", error);
    return {
      volunteers: [],
      loadError: "Volunteers could not be loaded. Check the Sanity connection and try again.",
    };
  }
}

async function loadDefaultCountry(): Promise<string> {
  try {
    return (await getPortalSettingsAction()).defaultCountry;
  } catch (error) {
    unstable_rethrow(error);
    return "";
  }
}

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, params] = await Promise.all([requireRouteAccess("/volunteers"), searchParams]);
  const canManage = MANAGER_ROLES.includes(user.role);
  const [{ volunteers, loadError }, defaultCountry] = await Promise.all([loadVolunteers(), loadDefaultCountry()]);

  return (
    <VolunteersClient
      initialVolunteers={volunteers}
      canManage={canManage}
      loadError={loadError}
      defaultCountry={defaultCountry}
      openCreateOnLoad={canManage && params.new === "1"}
    />
  );
}
