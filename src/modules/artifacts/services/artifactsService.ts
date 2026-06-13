import type { Artifact } from "../../../types";
import { apiFetch, apiUrl } from "../../../shared/api/client";

export type RelicSearchResponse = {
  artifacts?: unknown[];
  relics?: unknown[];
  total?: number;
  keyword?: string;
};

export type ArtifactsResponse = {
  source?: string;
  total?: number;
  artifacts?: Artifact[];
};

export async function searchRelics(keyword: string, limit = 200) {
  return apiFetch<RelicSearchResponse>(
    `/api/relics/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
  );
}

export async function fetchMergedArtifacts({
  limit = 5000,
  signal,
  errorPrefix = "Failed to fetch artifacts",
}: {
  limit?: number;
  signal?: AbortSignal;
  errorPrefix?: string;
} = {}) {
  const response = await fetch(apiUrl(`/api/artifacts?limit=${limit}`), { signal });
  if (!response.ok) {
    throw new Error(`${errorPrefix}: ${response.status}`);
  }
  return (await response.json()) as ArtifactsResponse;
}
