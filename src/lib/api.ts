export function getAuthToken() {
  return localStorage.getItem("muselink_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("muselink_token", token);
}

export function clearAuthToken() {
  localStorage.removeItem("muselink_token");
}

export async function apiFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
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

