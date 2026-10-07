import React from "react";
import { unstable_rethrow } from "next/navigation";
import VolunteersClient, { type VolunteerView } from "./VolunteersClient";
import { getVolunteersAction, type VolunteerData } from "@/app/actions/volunteers";
import { getPortalSettingsAction } from "@/app/actions/settings";
import { requireRouteAccess } from "@/lib/auth";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { DEFAULT_LANGUAGES, DEFAULT_SKILLS, DEFAULT_WHATSAPP_TEMPLATES } from "@/lib/domain";
import type { VolunteerPresets } from "./volunteerUtils";

export const revalidate = 0; // Disable server caching for this page to ensure fresh queries

const FALLBACK_SETTINGS: VolunteerPresets & { defaultCountry: string } = {
  organizationName: "Volunteer in Morocco",
  defaultCountry: "",
  skills: [...DEFAULT_SKILLS],
  languages: [...DEFAULT_LANGUAGES],
  whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES.map((template) => ({ ...template })),
};

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

/** Presets only drive form suggestions and WhatsApp templates, so the built-in defaults are a safe fallback. */
async function loadPresets(): Promise<VolunteerPresets & { defaultCountry: string }> {
  try {
    const settings = await getPortalSettingsAction();
    return {
      organizationName: settings.organizationName || FALLBACK_SETTINGS.organizationName,
      defaultCountry: settings.defaultCountry,
      skills: settings.skills,
      languages: settings.languages,
      whatsappTemplates: settings.whatsappTemplates,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load portal settings for the volunteer directory:", error);
    return FALLBACK_SETTINGS;
  }
}

/** Today's date (YYYY-MM-DD) in Morocco, so ages and membership states match on server and client. */
function todayInMorocco(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, params] = await Promise.all([requireRouteAccess("/volunteers"), searchParams]);
  const canManage = MANAGER_ROLES.includes(user.role);
  const [{ volunteers, loadError }, { defaultCountry, ...presets }] = await Promise.all([
    loadVolunteers(),
    loadPresets(),
  ]);
  const initialView: VolunteerView = params.view === "pipeline" ? "pipeline" : "list";

  return (
    <VolunteersClient
      initialVolunteers={volunteers}
      canManage={canManage}
      canViewEmergency={MANAGER_ROLES.includes(user.role)}
      canViewMedical={ADMIN_ROLES.includes(user.role)}
      loadError={loadError}
      defaultCountry={defaultCountry}
      presets={presets}
      today={todayInMorocco()}
      initialView={initialView}
      openCreateOnLoad={canManage && params.new === "1"}
    />
  );
}
