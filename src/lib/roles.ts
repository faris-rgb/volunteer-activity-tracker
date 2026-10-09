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

/** Day-to-day work pages: admins (the boss) and staff. The owner works on the technical side only. */
export const OPERATIONS_ROLES: AppRole[] = ["admin", "staff"];

export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/dashboard": ["owner", "admin", "staff", "volunteer"],
  "/volunteers": OPERATIONS_ROLES,
  "/activities": ["admin", "staff", "volunteer"],
  "/attendance": ["admin", "staff", "volunteer"],
  "/projects": OPERATIONS_ROLES,
  "/stays": OPERATIONS_ROLES,
  "/volunteer-feedback": OPERATIONS_ROLES,
  // Public feedback form, linked in the menu for volunteers.
  "/feedback": ["volunteer"],
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
