// Authorization checks shared utilities
import { UserSession } from "../auth/UserSession";

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
  return session.role === "admin";
}
