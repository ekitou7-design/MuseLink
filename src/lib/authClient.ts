import { apiFetch, clearAuthToken, setAuthToken } from "./api";
import { MUSE_ID_REGEX } from "./authUtils";

export type UserRole = "user" | "admin";
export type LoginChannel = "phone" | "email";

export type MeResponse = {
  id: number;
  museId?: string;
  createdAt: string;
  profile: {
    displayName?: string;
    photoURL?: string;
    bio?: string;
    headerUrl?: string;
    role?: UserRole;
    [key: string]: unknown;
  };
};

type AuthPayload = Record<string, unknown>;
type RegisterResponse = { museId: string };
type LoginResponse = { token: string; museId: string; role: UserRole };
type CodeRequestResponse = { expiresIn: number; devCode?: string; message?: string };

/**
 * 从对象中获取值，支持嵌套查询
 */
function getNestedValue(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * 将值转换为字符串
 */
function coerceToString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

/**
 * 从响应中提取并验证 MuseLink ID
 */
function getMuseIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as AuthPayload;
  const nestedUser = (typeof record.user === "object" && record.user) ? (record.user as AuthPayload) : null;

  // 尝试多个字段名，按优先级查询
  const candidates = [
    record.museId,
    record.userNumber,
    record.user_number,
    nestedUser?.museId,
    nestedUser?.userNumber,
    nestedUser?.user_number,
  ];

  for (const candidate of candidates) {
    const museId = coerceToString(candidate);
    if (MUSE_ID_REGEX.test(museId)) {
      return museId;
    }
  }

  return null;
}

function requireMuseId(payload: unknown, action: "注册" | "登录"): { museId: string } {
  const museId = getMuseIdFromPayload(payload);
  if (!museId) {
    throw new Error(`${action}成功，但接口没有返回有效的 MuseLink ID。`);
  }
  return { museId };
}

/**
 * 从响应中提取并验证用户角色
 */
function getRoleFromPayload(payload: unknown): UserRole | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as AuthPayload;
  const nestedUser = (typeof record.user === "object" && record.user) ? (record.user as AuthPayload) : null;
  const nestedProfile = (typeof record.profile === "object" && record.profile) ? (record.profile as AuthPayload) : null;

  // 尝试多个位置查询角色信息
  const roles = [record.role, nestedUser?.role, nestedProfile?.role];
  for (const role of roles) {
    if (role === "admin" || role === "user") {
      return role as UserRole;
    }
  }

  return null;
}

function requireRole(payload: unknown, action: "登录"): UserRole {
  const role = getRoleFromPayload(payload);
  if (!role) {
    throw new Error(`${action}成功，但接口没有返回有效的角色信息。`);
  }
  return role;
}

export async function register(password: string, confirmPassword: string): Promise<RegisterResponse> {
  const res = await apiFetch<{ museId?: string; userNumber?: number | string; user_number?: number | string }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ password, confirmPassword }),
    },
  );

  return requireMuseId(res, "注册");
}

export async function login(museId: string, password: string): Promise<LoginResponse> {
  const res = await apiFetch<{
    token: string;
    role?: UserRole;
    museId?: string;
    user?: { museId?: string; userNumber?: number | string; user_number?: number | string };
    userNumber?: number | string;
    user_number?: number | string;
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ museId, password }),
  });
  const normalized = requireMuseId(res, "登录");
  const role = requireRole(res, "登录");
  setAuthToken(res.token);
  return { token: res.token, museId: normalized.museId, role };
}

export async function requestLoginCode(
  channel: LoginChannel,
  target: string,
): Promise<CodeRequestResponse> {
  return apiFetch<CodeRequestResponse>("/api/auth/code/request", {
    method: "POST",
    body: JSON.stringify({ channel, target }),
  });
}

export async function loginWithCode(
  channel: LoginChannel,
  target: string,
  code: string,
): Promise<LoginResponse> {
  const res = await apiFetch<{
    token: string;
    role?: UserRole;
    museId?: string;
    user?: { museId?: string; userNumber?: number | string; user_number?: number | string };
    userNumber?: number | string;
    user_number?: number | string;
  }>("/api/auth/code/login", {
    method: "POST",
    body: JSON.stringify({ channel, target, code }),
  });
  const normalized = requireMuseId(res, "登录");
  const role = requireRole(res, "登录");
  setAuthToken(res.token);
  return { token: res.token, museId: normalized.museId, role };
}

export async function logout() {
  clearAuthToken();
}

export async function me() {
  return apiFetch<MeResponse>("/api/auth/me");
}
