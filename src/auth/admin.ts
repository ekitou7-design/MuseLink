import type { UserRole } from "../lib/authClient";

export const ADMIN_MUSE_ID = "jiangzhong";

export function isAdminMuseId(museId: string | null | undefined) {
  return museId?.trim().toLowerCase() === ADMIN_MUSE_ID;
}

export function resolveUserRole(role: UserRole | null | undefined, museId: string | null | undefined): UserRole {
  if (role === "admin" || isAdminMuseId(museId)) return "admin";
  return "user";
}
