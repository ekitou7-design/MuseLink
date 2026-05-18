import { useEffect, useState } from "react";

export type RoutePath = "/login" | "/register" | "/home" | "/profile" | "/admin";

function splitHash(hash: string) {
  const raw = hash.replace(/^#/, "");
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  const [path, query = ""] = normalized.split("?");
  return { path, query };
}

function normalize(hash: string): RoutePath {
  const { path } = splitHash(hash);
  if (path === "/register") return "/register";
  if (path === "/home") return "/home";
  if (path === "/profile") return "/profile";
  if (path === "/admin") return "/admin";
  return "/login";
}

export function navigate(to: RoutePath, query?: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();

  Object.entries(query || {}).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value);
    }
  });

  const search = params.toString();
  window.location.hash = `#${to}${search ? `?${search}` : ""}`;
}

export function getRouteSearchParams(hash = window.location.hash) {
  const { query } = splitHash(hash);
  return new URLSearchParams(query);
}

export function useRoute(): RoutePath {
  const [route, setRoute] = useState<RoutePath>(() => normalize(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(normalize(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
