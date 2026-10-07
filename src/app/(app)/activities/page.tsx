import React from "react";
import ActivitiesClient from "./ActivitiesClient";
import { cleanOptions, PROJECT_FILTER_NONE, type ActivityProjectOption } from "./activityShared";
import { getActivitiesResultAction } from "@/app/actions/activities";
import { getProjectsAction } from "@/app/actions/projects";
import { getPortalSettingsAction } from "@/app/actions/settings";
import { requireAssignedRole } from "@/lib/auth";
import { MANAGER_ROLES } from "@/lib/roles";
import { DEFAULT_ACTIVITY_CATEGORIES, DEFAULT_LOCATIONS } from "@/lib/domain";

export const revalidate = 0;

const PROJECT_PARAM_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** ?project=<id> or ?project=none preselects the project filter; anything else is ignored. */
function parseProjectParam(value: string | string[] | undefined): string | null {
  const raw = firstParam(value)?.trim();
  if (!raw) return null;
  if (raw === PROJECT_FILTER_NONE) return raw;
  return PROJECT_PARAM_PATTERN.test(raw) && !raw.startsWith("drafts.") ? raw : null;
}

async function loadProjects(): Promise<ActivityProjectOption[]> {
  try {
    const projects = await getProjectsAction();
    return projects.map((project) => ({
      _id: project._id,
      name: project.name || "Untitled project",
      status: project.status,
      location: project.location,
      startDate: project.startDate,
      endDate: project.endDate,
    }));
  } catch (error) {
    console.error("Could not load projects for the activities page:", error);
    return [];
  }
}

async function loadPresets(): Promise<{ categories: string[]; locations: string[] }> {
  try {
    const settings = await getPortalSettingsAction();
    const categories = cleanOptions(settings.activityCategories);
    const locations = cleanOptions(settings.locations);
    return {
      categories: categories.length > 0 ? categories : [...DEFAULT_ACTIVITY_CATEGORIES],
      locations: locations.length > 0 ? locations : [...DEFAULT_LOCATIONS],
    };
  } catch (error) {
    console.error("Could not load portal presets for the activities page:", error);
    return { categories: [...DEFAULT_ACTIVITY_CATEGORIES], locations: [...DEFAULT_LOCATIONS] };
  }
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, params] = await Promise.all([requireAssignedRole(), searchParams]);
  const canManage = MANAGER_ROLES.includes(user.role);
  const [result, projects, presets] = await Promise.all([getActivitiesResultAction(), loadProjects(), loadPresets()]);

  return (
    <ActivitiesClient
      initialActivities={result.ok ? result.data : []}
      loadError={result.ok ? null : result.error}
      canManage={canManage}
      openCreateOnLoad={canManage && firstParam(params.new) === "1"}
      projects={projects}
      categoryOptions={presets.categories}
      locationOptions={presets.locations}
      initialProjectFilter={parseProjectParam(params.project)}
    />
  );
}
