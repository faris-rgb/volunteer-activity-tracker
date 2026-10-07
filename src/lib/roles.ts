export const APP_ROLES = ["owner", "admin", "staff", "volunteer"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  volunteer: "Volunteer",
};

/** Roles that may manage (create/update/delete) volunteers, activities and attendance. */
export const MANAGER_ROLES: AppRole[] = ["owner", "admin", "staff"];

/** Roles that may manage users and portal settings. */
export const ADMIN_ROLES: AppRole[] = ["owner", "admin"];

export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/": ["owner", "admin", "staff", "volunteer"],
  "/volunteers": MANAGER_ROLES,
  "/activities": ["owner", "admin", "staff", "volunteer"],
  "/attendance": ["owner", "admin", "staff", "volunteer"],
  "/projects": MANAGER_ROLES,
  "/stays": MANAGER_ROLES,
  "/settings": ADMIN_ROLES,
  "/admin/assign-roles": ADMIN_ROLES,
};

export function canRoleAccessRoute(role: AppRole, pathname: string): boolean {
  const allowedRoles = ROUTE_PERMISSIONS[pathname];
  if (!allowedRoles) {
    return true;
  }
  return allowedRoles.includes(role);
}

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Normalizes a stored role value. Older records were saved with capitalized
 * values ("Admin", "Staff", "Volunteer"), so compare case-insensitively.
 */
export function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") {
    return null;
  }
  const lower = value.trim().toLowerCase();
  return isAppRole(lower) ? lower : null;
}
