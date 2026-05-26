import type { Exhibition } from "../../../types";
import { apiFetch } from "../../../shared/api/client";

export type FavoriteExhibitionToggleResponse = {
  favExhibitions: string[];
  isFavorite: boolean;
  favsCount: number;
};

export async function fetchFavoriteExhibitionDetails() {
  return apiFetch<{ exhibitions: Exhibition[] }>("/api/users/me/fav-exhibitions/details");
}

export async function toggleFavoriteExhibition(exhibitionId: string) {
  return apiFetch<FavoriteExhibitionToggleResponse>("/api/users/me/fav-exhibitions/toggle", {
    method: "POST",
    body: JSON.stringify({ exhibitionId }),
  });
}

export async function updateExhibition(exhibitionId: string, updated: Partial<Exhibition>) {
  return apiFetch<Exhibition>(`/api/exhibitions/${exhibitionId}`, {
    method: "PATCH",
    body: JSON.stringify(updated),
  });
}

export async function deleteExhibition(exhibitionId: string) {
  return apiFetch(`/api/exhibitions/${exhibitionId}`, { method: "DELETE" });
}

export async function createExhibition(payload: Partial<Exhibition>) {
  return apiFetch<Exhibition>("/api/exhibitions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchSquareExhibitions(limit = 10) {
  return apiFetch<{ exhibitions: Exhibition[] }>(`/api/exhibitions/square?limit=${limit}`);
}

export async function fetchMyExhibitions() {
  return apiFetch<{ exhibitions: Exhibition[] }>("/api/exhibitions/mine");
}
