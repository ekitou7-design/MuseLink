import type { Museum } from "../../../types";
import { apiUrl } from "../../../shared/api/client";

export type MuseumsResponse = {
  source?: string;
  total?: number;
  museums?: Museum[];
};

export async function fetchMergedMuseums({ signal }: { signal?: AbortSignal } = {}) {
  const response = await fetch(apiUrl("/api/museums?source=merged"), { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch museums: ${response.status}`);
  }
  return (await response.json()) as MuseumsResponse;
}
