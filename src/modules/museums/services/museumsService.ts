import type { Artifact, Museum } from "../../../types";
import { apiFetch, apiUrl } from "../../../shared/api/client";

export type MuseumsResponse = {
  source?: string;
  total?: number;
  museums?: Museum[];
};

export type MuseumDetailResponse = {
  museum?: Museum;
  artifacts?: Artifact[];
  stats?: {
    artifactCount?: number;
  };
};

export async function fetchMergedMuseums({ signal }: { signal?: AbortSignal } = {}) {
  const response = await fetch(apiUrl("/api/museums"), { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch museums: ${response.status}`);
  }
  return (await response.json()) as MuseumsResponse;
}

export async function fetchMuseumDetail(id: string, { signal }: { signal?: AbortSignal } = {}) {
  return apiFetch<MuseumDetailResponse>(`/api/museums/${encodeURIComponent(id)}`, { signal });
}
