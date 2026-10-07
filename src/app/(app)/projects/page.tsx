import React from "react";
import { unstable_rethrow } from "next/navigation";
import ProjectsClient, { type ProjectsTab } from "./ProjectsClient";
import { getPartnersAction, getProjectsAction, type ProjectWithStats } from "@/app/actions/projects";
import { getPortalSettingsAction } from "@/app/actions/settings";
import { requireRouteAccess } from "@/lib/auth";
import { DEFAULT_LOCATIONS, type Partner, type PortalPresets } from "@/lib/domain";

export const revalidate = 0;

async function loadProjects(): Promise<ProjectWithStats[] | null> {
  try {
    return await getProjectsAction();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load projects:", error);
    return null;
  }
}

async function loadPartners(): Promise<Partner[] | null> {
  try {
    return await getPartnersAction();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load partners:", error);
    return null;
  }
}

/** Location presets from the portal settings, falling back to the organisation defaults. */
async function loadLocations(): Promise<string[]> {
  try {
    const settings: Partial<PortalPresets> = await getPortalSettingsAction();
    return Array.isArray(settings.locations) && settings.locations.length > 0
      ? settings.locations
      : [...DEFAULT_LOCATIONS];
  } catch (error) {
    unstable_rethrow(error);
    return [...DEFAULT_LOCATIONS];
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [, params] = await Promise.all([requireRouteAccess("/projects"), searchParams]);
  const [projects, partners, locations] = await Promise.all([loadProjects(), loadPartners(), loadLocations()]);

  const failed = [projects === null && "projects", partners === null && "partners"].filter(Boolean);
  const loadError =
    failed.length > 0
      ? `Could not load ${failed.join(" and ")}. Check the Sanity connection and try again.`
      : null;
  const initialTab: ProjectsTab = params.tab === "partners" ? "partners" : "projects";

  return (
    <ProjectsClient
      initialProjects={projects ?? []}
      initialPartners={partners ?? []}
      loadError={loadError}
      locationSuggestions={locations}
      initialTab={initialTab}
      openCreateOnLoad={initialTab === "projects" && params.new === "1"}
    />
  );
}
