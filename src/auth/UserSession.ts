import { clearAuthToken, getAuthToken } from "../lib/api";
import type { UserRole } from "../lib/authClient";
import { isAdminMuseId } from "./admin";

const KEY_MUSE_ID = "muselink_museId";
const KEY_LOGIN_STATE = "muselink_loginState";
const KEY_ROLE = "muselink_role";

export type SessionSnapshot = {
  museId: string | null;
  isLoggedIn: boolean;
  token: string | null;
  role: UserRole | null;
};

export class UserSession {
  static getMuseId() {
    return localStorage.getItem(KEY_MUSE_ID);
  }

  static setMuseId(museId: string) {
    localStorage.setItem(KEY_MUSE_ID, museId);
  }

  static getRole(): UserRole | null {
    if (isAdminMuseId(UserSession.getMuseId())) return "admin";
    const role = localStorage.getItem(KEY_ROLE);
    return role === "admin" || role === "user" ? role : null;
  }

  static setRole(role: UserRole) {
    localStorage.setItem(KEY_ROLE, role);
  }

  static clearRole() {
    localStorage.removeItem(KEY_ROLE);
  }

  static isLoggedIn() {
    return localStorage.getItem(KEY_LOGIN_STATE) === "true";
  }

  static setLoggedIn(value: boolean) {
    localStorage.setItem(KEY_LOGIN_STATE, value ? "true" : "false");
  }

  static clear() {
    localStorage.removeItem(KEY_MUSE_ID);
    localStorage.removeItem(KEY_LOGIN_STATE);
    UserSession.clearRole();
    clearAuthToken();
  }

  static snapshot(): SessionSnapshot {
    return {
      museId: UserSession.getMuseId(),
      isLoggedIn: UserSession.isLoggedIn(),
      token: getAuthToken(),
      role: UserSession.getRole(),
    };
  }
}
