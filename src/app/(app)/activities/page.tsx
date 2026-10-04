import React from "react";
import ActivitiesClient from "./ActivitiesClient";
import { getActivitiesResultAction } from "@/app/actions/activities";
import { requireAssignedRole } from "@/lib/auth";
import { MANAGER_ROLES } from "@/lib/roles";

export const revalidate = 0;

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, params] = await Promise.all([requireAssignedRole(), searchParams]);
  const canManage = MANAGER_ROLES.includes(user.role);
  const result = await getActivitiesResultAction();

  return (
    <ActivitiesClient
      initialActivities={result.ok ? result.data : []}
      loadError={result.ok ? null : result.error}
      canManage={canManage}
      openCreateOnLoad={canManage && params.new === "1"}
    />
  );
}
