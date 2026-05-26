import type { UserProfile } from "../../../types";
import { apiFetch } from "../../../shared/api/client";

export async function fetchFavoriteArtifactIds() {
  return apiFetch<{ favorites: string[] }>("/api/users/me/favorites");
}

export async function toggleFavoriteArtifact(artifactId: string) {
  return apiFetch<{ favorites: string[] }>("/api/users/me/favorites/toggle", {
    method: "POST",
    body: JSON.stringify({ artifactId }),
  });
}

export async function fetchFavoriteExhibitionIds() {
  return apiFetch<{ favExhibitions: string[] }>("/api/users/me/fav-exhibitions");
}

export async function updateMyProfile(profile: Partial<UserProfile>) {
  return apiFetch<UserProfile>("/api/users/me/profile", {
    method: "PATCH",
    body: JSON.stringify(profile),
  });
}
