import { requireRouteAccess } from "@/lib/auth";
import { getAppUsersAction } from "@/app/actions/users";
import AssignRolesClient from "./AssignRolesClient";

export default async function AssignRolesPage() {
  const currentUser = await requireRouteAccess("/admin/assign-roles");
  const users = await getAppUsersAction();

  return <AssignRolesClient users={users} currentUser={currentUser} />;
}
