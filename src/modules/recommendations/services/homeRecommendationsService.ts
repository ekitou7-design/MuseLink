import type { Artifact, Exhibition } from "../../../types";
import { apiFetch } from "../../../shared/api/client";

export type RecommendationTargetType = "artifact" | "exhibition";

export type HomeRecommendationItem = {
  id: string;
  type: RecommendationTargetType;
  targetId: string;
  title: string;
  reason: string;
  coverUrl?: string;
  order: number;
  enabled: boolean;
};

export type EditorPicksSection = {
  sectionKey: "editor-picks";
  title: string;
  subtitle: string;
  enabled: boolean;
  items: HomeRecommendationItem[];
};

export type HomeRecommendationsConfig = {
  artifactRecommendations: HomeRecommendationItem[];
  exhibitionRecommendations: HomeRecommendationItem[];
  editorPicks: EditorPicksSection;
};

export type ResolvedHomeRecommendationItem = HomeRecommendationItem & {
  artifact?: Artifact;
  exhibition?: Exhibition;
  displayTitle: string;
  displayReason: string;
  displayCoverUrl: string;
};

export type ResolvedHomeRecommendations = {
  artifactRecommendations: ResolvedHomeRecommendationItem[];
  exhibitionRecommendations: ResolvedHomeRecommendationItem[];
  editorPicks: Omit<EditorPicksSection, "items"> & {
    items: ResolvedHomeRecommendationItem[];
  };
};

export type AdminRecommendationsResponse = {
  config: HomeRecommendationsConfig;
  resolved: ResolvedHomeRecommendations;
};

export const emptyHomeRecommendationsConfig = (): HomeRecommendationsConfig => ({
  artifactRecommendations: [],
  exhibitionRecommendations: [],
  editorPicks: {
    sectionKey: "editor-picks",
    title: "编辑推荐",
    subtitle: "",
    enabled: true,
    items: [],
  },
});

export async function fetchHomeRecommendations() {
  return apiFetch<ResolvedHomeRecommendations>("/api/home/recommendations");
}

export async function fetchAdminRecommendations() {
  return apiFetch<AdminRecommendationsResponse>("/api/admin/recommendations");
}

export async function saveAdminRecommendations(config: HomeRecommendationsConfig) {
  return apiFetch<AdminRecommendationsResponse>("/api/admin/recommendations", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function searchRecommendationArtifactCandidates(q: string) {
  return apiFetch<{ artifacts: Artifact[] }>(
    `/api/admin/recommendation-candidates/artifacts?q=${encodeURIComponent(q)}&limit=20`,
  );
}

export async function searchRecommendationExhibitionCandidates(q: string) {
  return apiFetch<{ exhibitions: Exhibition[] }>(
    `/api/admin/recommendation-candidates/exhibitions?q=${encodeURIComponent(q)}&limit=20`,
  );
}
