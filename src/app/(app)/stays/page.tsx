import { unstable_rethrow } from "next/navigation";
import StaysClient, { type StaysTab } from "./StaysClient";
import { getStaysAction } from "@/app/actions/stays";
import { getRoomsAction } from "@/app/actions/rooms";
import { getVolunteersAction } from "@/app/actions/volunteers";
import { getProjectsAction } from "@/app/actions/projects";
import { getPortalSettingsAction } from "@/app/actions/settings";
import { requireRouteAccess } from "@/lib/auth";
import { formatDateKey } from "@/lib/dates";
import { DEFAULT_LOCATIONS, DEFAULT_WHATSAPP_TEMPLATES } from "@/lib/domain";
import type { StayProjectOption, StayVolunteerOption } from "./components/stayUtils";

export const revalidate = 0;

const TABS: StaysTab[] = ["arrivals", "all", "rooms"];
const DEFAULT_ORGANIZATION = "Volunteer in Morocco";

async function load<T>(loader: () => Promise<T>, fallback: T, label: string): Promise<{ data: T; error: string | null }> {
  try {
    return { data: await loader(), error: null };
  } catch (error) {
    unstable_rethrow(error);
    console.error(`Failed to load ${label} for the stays page:`, error);
    return { data: fallback, error: `${label.charAt(0).toUpperCase()}${label.slice(1)} could not be loaded.` };
  }
}

/** Today in Morocco (the organisation's time zone), used until the browser reports its own date. */
function moroccoToday(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return formatDateKey(new Date());
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StaysPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [, params] = await Promise.all([requireRouteAccess("/stays"), searchParams]);

  const [stays, rooms, volunteers, projects, settings] = await Promise.all([
    load(getStaysAction, [], "stays"),
    load(getRoomsAction, [], "rooms"),
    load(getVolunteersAction, [], "volunteers"),
    load(getProjectsAction, [], "projects"),
    load(getPortalSettingsAction, null, "portal settings"),
  ]);

  const volunteerOptions: StayVolunteerOption[] = volunteers.data.map((volunteer) => ({
    _id: volunteer._id,
    firstName: volunteer.firstName ?? "",
    lastName: volunteer.lastName ?? "",
    phoneNumber: volunteer.phoneNumber || undefined,
    country: volunteer.country || undefined,
    nationality: volunteer.nationality || undefined,
    dateOfBirth: volunteer.dateOfBirth || undefined,
    diet: volunteer.diet,
    volunteerType: volunteer.volunteerType,
    active: volunteer.active !== false,
  }));

  const projectOptions: StayProjectOption[] = projects.data.map((project) => ({
    _id: project._id,
    name: project.name,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    location: project.location,
    maxParticipants: project.maxParticipants,
    ageMin: project.ageMin,
    ageMax: project.ageMax,
    funding: project.funding,
  }));

  const requestedProject = firstParam(params.project);
  const initialProject =
    requestedProject === "none" || (requestedProject && projectOptions.some((project) => project._id === requestedProject))
      ? requestedProject
      : "all";
  const requestedTab = firstParam(params.tab);
  const initialTab: StaysTab = TABS.includes(requestedTab as StaysTab)
    ? (requestedTab as StaysTab)
    : initialProject !== "all"
      ? "all"
      : "arrivals";

  const templates = settings.data?.whatsappTemplates?.length ? settings.data.whatsappTemplates : DEFAULT_WHATSAPP_TEMPLATES;
  const pickupTemplate =
    templates.find((template) => template.key === "pickup")?.text ??
    DEFAULT_WHATSAPP_TEMPLATES.find((template) => template.key === "pickup")?.text ??
    "";

  const loadErrors = [stays.error, rooms.error, volunteers.error, projects.error].filter((error): error is string => !!error);

  return (
    <StaysClient
      initialStays={stays.data}
      initialRooms={rooms.data}
      volunteers={volunteerOptions}
      projects={projectOptions}
      loadErrors={loadErrors.length > 0 ? [...loadErrors, "Check the Sanity connection and try again."] : []}
      serverToday={moroccoToday()}
      initialTab={initialTab}
      initialProject={initialProject}
      pickupTemplate={pickupTemplate}
      organizationName={settings.data?.organizationName || DEFAULT_ORGANIZATION}
      locations={settings.data?.locations?.length ? settings.data.locations : [...DEFAULT_LOCATIONS]}
    />
  );
}
