import type { Artifact } from "../src/types";
import { artifactDescriptionRaw, artifactImageUrlRaw, artifactNameRaw, displayDbString } from "../src/lib/dbDisplay";
import { listAllPublicExhibitions, listPublicExhibitionsByIds, type ExhibitionRecord } from "./exhibitions";
import { readJsonFile, writeJsonFile } from "./store";
import { getArtifactFromStore, listArtifactsFromStore, searchArtifactsInStore } from "./api/services/artifactsStore";

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
  exhibition?: ExhibitionRecord;
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

const FILE = "home-recommendations.json";

export const DEFAULT_HOME_RECOMMENDATIONS: HomeRecommendationsConfig = {
  artifactRecommendations: [],
  exhibitionRecommendations: [],
  editorPicks: {
    sectionKey: "editor-picks",
    title: "编辑推荐",
    subtitle: "",
    enabled: true,
    items: [],
  },
};

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function bool(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function safeOrder(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function newRecommendationId(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 7)}`;
}

function normalizeItem(raw: unknown, fallbackType: RecommendationTargetType, index: number): HomeRecommendationItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const type = record.type === "exhibition" || record.type === "artifact" ? record.type : fallbackType;
  const targetId = text(record.targetId);
  if (!targetId) return null;
  return {
    id: text(record.id) || newRecommendationId(`rec-${type}`, index),
    type,
    targetId,
    title: text(record.title),
    reason: text(record.reason),
    coverUrl: text(record.coverUrl),
    order: safeOrder(record.order, index + 1),
    enabled: bool(record.enabled, true),
  };
}

function normalizeItems(raw: unknown, fallbackType: RecommendationTargetType) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeItem(item, fallbackType, index))
    .filter((item): item is HomeRecommendationItem => Boolean(item))
    .sort((left, right) => left.order - right.order);
}

export function normalizeHomeRecommendations(input: unknown): HomeRecommendationsConfig {
  const record = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const editorPicksRaw = record.editorPicks && typeof record.editorPicks === "object" && !Array.isArray(record.editorPicks)
    ? record.editorPicks as Record<string, unknown>
    : {};

  return {
    artifactRecommendations: normalizeItems(record.artifactRecommendations, "artifact")
      .filter((item) => item.type === "artifact"),
    exhibitionRecommendations: normalizeItems(record.exhibitionRecommendations, "exhibition")
      .filter((item) => item.type === "exhibition"),
    editorPicks: {
      sectionKey: "editor-picks",
      title: text(editorPicksRaw.title) || DEFAULT_HOME_RECOMMENDATIONS.editorPicks.title,
      subtitle: text(editorPicksRaw.subtitle),
      enabled: bool(editorPicksRaw.enabled, true),
      items: normalizeItems(editorPicksRaw.items, "artifact"),
    },
  };
}

export async function readHomeRecommendationsConfig() {
  const data = await readJsonFile<HomeRecommendationsConfig>(FILE, DEFAULT_HOME_RECOMMENDATIONS);
  return normalizeHomeRecommendations(data);
}

export async function writeHomeRecommendationsConfig(input: unknown) {
  const normalized = normalizeHomeRecommendations(input);
  await writeJsonFile<HomeRecommendationsConfig>(FILE, normalized);
  return normalized;
}

async function artifactMapByIds(ids: string[]) {
  const pairs = await Promise.all(ids.map(async (id) => [id, await getArtifactFromStore(id)] as const));
  return new Map(pairs.filter((pair): pair is readonly [string, Artifact] => Boolean(pair[1])));
}

async function exhibitionMapByIds(ids: string[]) {
  const exhibitions = await listPublicExhibitionsByIds(ids);
  return new Map(exhibitions.map((exhibition) => [exhibition.id, exhibition]));
}

function artifactFallbackReason(artifact: Artifact) {
  return displayDbString(artifact.shortIntro || artifactDescriptionRaw(artifact)).slice(0, 80);
}

function resolveItem(
  item: HomeRecommendationItem,
  artifacts: Map<string, Artifact>,
  exhibitions: Map<string, ExhibitionRecord>,
): ResolvedHomeRecommendationItem | null {
  if (item.type === "artifact") {
    const artifact = artifacts.get(item.targetId);
    if (!artifact) return null;
    return {
      ...item,
      artifact,
      displayTitle: item.title || displayDbString(artifactNameRaw(artifact)),
      displayReason: item.reason || artifactFallbackReason(artifact),
      displayCoverUrl: String(artifactImageUrlRaw(artifact, "thumbnail") || artifactImageUrlRaw(artifact) || ""),
    };
  }

  const exhibition = exhibitions.get(item.targetId);
  if (!exhibition) return null;
  return {
    ...item,
    exhibition,
    displayTitle: item.title || exhibition.title,
    displayReason: item.reason || exhibition.intro || "",
    displayCoverUrl: item.coverUrl || exhibition.coverUrl || "",
  };
}

export async function resolveHomeRecommendations(onlyEnabled: boolean): Promise<ResolvedHomeRecommendations> {
  const config = await readHomeRecommendationsConfig();
  const artifactItems = config.artifactRecommendations.filter((item) => !onlyEnabled || item.enabled);
  const exhibitionItems = config.exhibitionRecommendations.filter((item) => !onlyEnabled || item.enabled);
  const pickItems = config.editorPicks.items.filter((item) => !onlyEnabled || item.enabled);
  const artifactIds = [...artifactItems, ...pickItems].filter((item) => item.type === "artifact").map((item) => item.targetId);
  const exhibitionIds = [...exhibitionItems, ...pickItems].filter((item) => item.type === "exhibition").map((item) => item.targetId);
  const [artifacts, exhibitions] = await Promise.all([
    artifactMapByIds(Array.from(new Set(artifactIds))),
    exhibitionMapByIds(Array.from(new Set(exhibitionIds))),
  ]);

  return {
    artifactRecommendations: artifactItems
      .map((item) => resolveItem(item, artifacts, exhibitions))
      .filter((item): item is ResolvedHomeRecommendationItem => Boolean(item)),
    exhibitionRecommendations: exhibitionItems
      .map((item) => resolveItem(item, artifacts, exhibitions))
      .filter((item): item is ResolvedHomeRecommendationItem => Boolean(item)),
    editorPicks: {
      sectionKey: "editor-picks",
      title: config.editorPicks.title,
      subtitle: config.editorPicks.subtitle,
      enabled: config.editorPicks.enabled,
      items: (!onlyEnabled || config.editorPicks.enabled)
        ? pickItems
          .map((item) => resolveItem(item, artifacts, exhibitions))
          .filter((item): item is ResolvedHomeRecommendationItem => Boolean(item))
        : [],
    },
  };
}

export async function getAdminRecommendationsResponse() {
  const config = await readHomeRecommendationsConfig();
  const resolved = await resolveHomeRecommendations(false);
  return { config, resolved };
}

export async function searchRecommendationArtifactCandidates(q: string, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const keyword = q.trim();
  return keyword
    ? searchArtifactsInStore(keyword, safeLimit)
    : listArtifactsFromStore(safeLimit);
}

export async function searchRecommendationExhibitionCandidates(q: string, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const keyword = q.trim().toLowerCase();
  const exhibitions = await listAllPublicExhibitions(1000);
  const filtered = keyword
    ? exhibitions.filter((exhibition) => [
      exhibition.id,
      exhibition.title,
      exhibition.intro,
      exhibition.userName,
    ].join(" ").toLowerCase().includes(keyword))
    : exhibitions;
  return filtered.slice(0, safeLimit);
}
