import {
  login as apiLogin,
  loginWithCode as apiLoginWithCode,
  logout as apiLogout,
  register as apiRegister,
  requestLoginCode as apiRequestLoginCode,
  type LoginChannel,
} from "../lib/authClient";
import { UserSession } from "./UserSession";

export class AuthService {
  static async register(password: string, confirmPassword: string) {
    const res = await apiRegister(password, confirmPassword);
    // Not logged in yet; user should login using museId + password
    UserSession.setMuseId(res.museId);
    UserSession.setLoggedIn(false);
    UserSession.clearRole();
    return res;
  }

  static async login(museId: string, password: string) {
    const trimmed = museId.trim();
    const res = await apiLogin(trimmed, password);
    UserSession.setMuseId(res.museId);
    UserSession.setRole(res.role);
    UserSession.setLoggedIn(true);
    return res;
  }

  static async requestLoginCode(channel: LoginChannel, target: string) {
    return apiRequestLoginCode(channel, target.trim());
  }

  static async loginWithCode(channel: LoginChannel, target: string, code: string) {
    const res = await apiLoginWithCode(channel, target.trim(), code.trim());
    UserSession.setMuseId(res.museId);
    UserSession.setRole(res.role);
    UserSession.setLoggedIn(true);
    return res;
  }

  static async logout() {
    await apiLogout();
    UserSession.clear();
  }
}
