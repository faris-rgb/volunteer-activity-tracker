import React from "react";
import ActivitiesClient from "./ActivitiesClient";
import { getActivitiesAction } from "@/app/actions/activities";

export const revalidate = 0; // Disable caching to fetch real-time updates

export default async function ActivitiesPage() {
  const initialActivities = await getActivitiesAction();

  return <ActivitiesClient initialActivities={initialActivities} />;
}
