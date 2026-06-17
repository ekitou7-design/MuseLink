// Authorization checks shared utilities
import { UserSession } from "../auth/UserSession";
import { isAdminMuseId } from "../auth/admin";
import { me } from "../lib/authClient";

/**
 * 检查用户是否已认证
 */
export function isUserAuthenticated(): boolean {
  const session = UserSession.snapshot();
  return Boolean(session.isLoggedIn && session.token && session.museId);
}

/**
 * 检查用户是否为管理员
 */
export function isUserAdmin(): boolean {
  const session = UserSession.snapshot();
  return session.role === "admin" || isAdminMuseId(session.museId);
}

/**
 * 从后端确认当前 token 对应账号是否为管理员
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!isUserAuthenticated()) return false;

  try {
    const currentUser = await me();
    return currentUser.profile.role === "admin";
  } catch {
    return false;
  }
}
