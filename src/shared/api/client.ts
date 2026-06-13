export function getAuthToken() {
  return localStorage.getItem("muselink_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("muselink_token", token);
}

export function clearAuthToken() {
  localStorage.removeItem("muselink_token");
}

const DEFAULT_LOCAL_API_BASE_URL =
  typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;

function normalizeApiBaseUrl(value: string | undefined) {
  return (value || "").trim().replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const viteEnv = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string; DEV?: boolean } }).env;
  const configuredBaseUrl = normalizeApiBaseUrl(viteEnv?.VITE_API_BASE_URL);
  if (configuredBaseUrl) return configuredBaseUrl;
  return viteEnv?.DEV || typeof window === "undefined" ? DEFAULT_LOCAL_API_BASE_URL : "";
}

export function apiUrl(input: string) {
  if (/^https?:\/\//i.test(input)) return input;

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return input;

  const path = input.startsWith("/") ? input : `/${input}`;
  return `${baseUrl}${path}`;
}

export async function apiFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(input), { ...init, headers });
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message =
      typeof body === "object" && body && "error" in body ? String((body as any).error) : String(body);
    throw new Error(message || `Request failed: ${res.status}`);
  }
  return body as T;
}
