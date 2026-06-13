import type { Artifact, ArtifactRecommendation, ArtifactTag } from "../../../types";
import { artifactSearchBlob } from "../../../lib/artifactSearch";
import {
  artifactCategoryRaw,
  artifactDescriptionRaw,
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  isStrictDbEmpty,
} from "../../../lib/dbDisplay";

export const SEARCH_HISTORY_KEY = "muselink_search_history";
export const RECOMMENDATION_PREFERENCES_KEY = "muselink_recommendation_preferences";

const IMPORTANT_KEYWORDS = ["禁止出境", "一级文物", "镇馆之宝", "国宝", "重点文物"];
const DEFAULT_RECOMMENDATION_LIMIT = 8;
const MAX_STORED_KEYWORDS = 20;

export type RecommendationContext = {
  favoriteArtifactIds: string[];
  viewHistoryIds: string[];
  searchKeywords: string[];
  curationKeywords: string[];
};

type SignalMaps = {
  favoriteTags: Map<string, number>;
  viewedTags: Map<string, number>;
  categories: Map<string, number>;
  eras: Map<string, number>;
  museums: Map<string, number>;
};

function tagText(tag: ArtifactTag): string {
  if (typeof tag === "string") return tag;
  return [tag.type, tag.name].filter(Boolean).join(" ");
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function readStringList(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function readSearchHistory(): string[] {
  return readStringList(SEARCH_HISTORY_KEY);
}

export function readRecommendationPreferences(): string[] {
  return readStringList(RECOMMENDATION_PREFERENCES_KEY);
}

export function rememberRecentText(current: string[], value: string, limit = MAX_STORED_KEYWORDS): string[] {
  const nextValue = normalizeKeyword(value);
  if (!nextValue) return current;
  return [nextValue, ...current.filter((item) => normalizeKeyword(item) !== nextValue)].slice(0, limit);
}

export function writeSearchHistory(values: string[]) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(values.slice(0, MAX_STORED_KEYWORDS)));
}

export function writeRecommendationPreferences(values: string[]) {
  localStorage.setItem(RECOMMENDATION_PREFERENCES_KEY, JSON.stringify(values.slice(0, MAX_STORED_KEYWORDS)));
}

function increment(map: Map<string, number>, value: unknown, weight = 1) {
  const key = cleanText(value);
  if (!key) return;
  map.set(key, (map.get(key) || 0) + weight);
}

function artifactTags(artifact: Artifact): string[] {
  return (artifact.tags || [])
    .map(tagText)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasImage(artifact: Artifact): boolean {
  return !isStrictDbEmpty(artifactImageUrlRaw(artifact));
}

function isImportantArtifact(artifact: Artifact): boolean {
  const blob = [
    artifactTags(artifact).join(" "),
    artifact.level,
    artifact.category,
    artifact.description,
    artifact.shortIntro,
  ].join(" ");
  return IMPORTANT_KEYWORDS.some((keyword) => blob.includes(keyword));
}

function artifactCompletenessScore(artifact: Artifact): number {
  let score = 0;
  if (!isStrictDbEmpty(artifactNameRaw(artifact))) score += 2;
  if (!isStrictDbEmpty(artifactMuseumRaw(artifact))) score += 2;
  if (!isStrictDbEmpty(artifactEraRaw(artifact))) score += 2;
  if (!isStrictDbEmpty(artifactDescriptionRaw(artifact))) score += 3;
  if (hasImage(artifact)) score += 4;
  return score;
}

function collectSignals(artifactsById: Map<string, Artifact>, context: RecommendationContext): SignalMaps {
  const maps: SignalMaps = {
    favoriteTags: new Map(),
    viewedTags: new Map(),
    categories: new Map(),
    eras: new Map(),
    museums: new Map(),
  };

  context.favoriteArtifactIds.forEach((id) => {
    const artifact = artifactsById.get(id);
    if (!artifact) return;
    artifactTags(artifact).forEach((tag) => increment(maps.favoriteTags, tag, 2));
    increment(maps.categories, artifactCategoryRaw(artifact), 2);
    increment(maps.eras, artifactEraRaw(artifact), 2);
    increment(maps.museums, artifactMuseumRaw(artifact), 1.5);
  });

  context.viewHistoryIds.forEach((id, index) => {
    const artifact = artifactsById.get(id);
    if (!artifact) return;
    const recencyWeight = Math.max(0.35, 1 - index * 0.08);
    artifactTags(artifact).forEach((tag) => increment(maps.viewedTags, tag, recencyWeight));
    increment(maps.categories, artifactCategoryRaw(artifact), recencyWeight);
    increment(maps.eras, artifactEraRaw(artifact), recencyWeight);
    increment(maps.museums, artifactMuseumRaw(artifact), recencyWeight * 0.75);
  });

  return maps;
}

function strongestMapKey(map: Map<string, number>, candidates: string[]): string {
  return candidates
    .map((candidate) => ({ candidate, score: map.get(candidate) || 0 }))
    .sort((a, b) => b.score - a.score)[0]?.candidate || "";
}

function keywordMatches(artifact: Artifact, keywords: string[]): string[] {
  const blob = artifactSearchBlob(artifact);
  return keywords
    .map(normalizeKeyword)
    .filter((keyword) => keyword.length >= 2 && blob.includes(keyword.toLowerCase()))
    .slice(0, 3);
}

function scoreArtifact(
  artifact: Artifact,
  context: RecommendationContext,
  signals: SignalMaps,
  isColdStart: boolean,
): ArtifactRecommendation {
  const tags = artifactTags(artifact);
  const reasons: string[] = [];
  const matchedTags = new Set<string>();
  let score = artifactCompletenessScore(artifact);

  // Lightweight explainable ranking: each behavior signal contributes an additive score.
  // Keep this pure and deterministic so it can later be swapped for an AI/service ranker.
  const favoriteTagScore = tags.reduce((sum, tag) => sum + (signals.favoriteTags.get(tag) || 0), 0);
  if (favoriteTagScore > 0) {
    score += favoriteTagScore * 18;
    const tag = strongestMapKey(signals.favoriteTags, tags);
    if (tag) {
      matchedTags.add(tag);
      reasons.push(`因为你收藏过${tag}相关文物`);
    }
  }

  const viewedTagScore = tags.reduce((sum, tag) => sum + (signals.viewedTags.get(tag) || 0), 0);
  if (viewedTagScore > 0) {
    score += viewedTagScore * 12;
    const tag = strongestMapKey(signals.viewedTags, tags);
    if (tag) {
      matchedTags.add(tag);
      reasons.push(`与你最近浏览的${tag}主题相关`);
    }
  }

  const searchMatches = keywordMatches(artifact, context.searchKeywords);
  if (searchMatches.length > 0) {
    score += searchMatches.length * 14;
    reasons.push(`与你搜索的“${searchMatches[0]}”相关`);
  }

  const curationMatches = keywordMatches(artifact, context.curationKeywords);
  if (curationMatches.length > 0) {
    score += curationMatches.length * 12;
    reasons.push(`适合延展你最近的“${curationMatches[0]}”策展主题`);
  }

  const category = cleanText(artifactCategoryRaw(artifact));
  const era = cleanText(artifactEraRaw(artifact));
  const museum = cleanText(artifactMuseumRaw(artifact));
  if (category && signals.categories.has(category)) {
    score += (signals.categories.get(category) || 0) * 7;
    reasons.push(`与你偏好的${category}类别相近`);
  }
  if (era && signals.eras.has(era)) {
    score += (signals.eras.get(era) || 0) * 6;
    reasons.push(`与你关注的${era}时期相关`);
  }
  if (museum && signals.museums.has(museum)) {
    score += (signals.museums.get(museum) || 0) * 5;
    reasons.push(`来自你常看的${museum}`);
  }

  const hotScore = Math.min(Math.log1p(artifact.favsCount || 0) * 4, 14);
  score += hotScore;
  if ((artifact.favsCount || 0) >= 20) {
    reasons.push("近期收藏热度较高");
  }

  if (isImportantArtifact(artifact)) {
    score += 18;
    const importantTag = tags.find((tag) => IMPORTANT_KEYWORDS.some((keyword) => tag.includes(keyword)));
    if (importantTag) matchedTags.add(importantTag);
    reasons.push(importantTag ? `同属${importantTag}` : "具有国家级重点文物线索");
  }

  if (!hasImage(artifact)) {
    score -= 8;
  }

  if (context.favoriteArtifactIds.includes(artifact.id)) {
    score -= 60;
  }

  if (isColdStart) {
    reasons.splice(0, reasons.length);
    reasons.push(isImportantArtifact(artifact)
      ? "国家级重点文物，适合作为初次探索入口"
      : "信息较完整、热度较高，适合作为初次探索入口");
  }

  const uniqueReasons = Array.from(new Set(reasons)).slice(0, 3);
  return {
    artifact,
    recommendationScore: Math.round(score * 10) / 10,
    reason: uniqueReasons[0] || "与你的浏览和馆藏兴趣相近",
    reasons: uniqueReasons,
    matchedTags: Array.from(new Set(Array.from(matchedTags).concat(tags.slice(0, 3)).filter(Boolean))).slice(0, 4),
  };
}

function selectDiverseRecommendations(scored: ArtifactRecommendation[], limit: number): ArtifactRecommendation[] {
  const selected: ArtifactRecommendation[] = [];
  const categoryCounts = new Map<string, number>();
  const museumCounts = new Map<string, number>();

  for (const item of scored) {
    const category = cleanText(artifactCategoryRaw(item.artifact)) || "其他";
    const museum = cleanText(artifactMuseumRaw(item.artifact)) || "未知馆藏";
    if ((categoryCounts.get(category) || 0) >= 2) continue;
    if ((museumCounts.get(museum) || 0) >= 2) continue;
    selected.push(item);
    increment(categoryCounts, category);
    increment(museumCounts, museum);
    if (selected.length >= limit) return selected;
  }

  for (const item of scored) {
    if (selected.some((selectedItem) => selectedItem.artifact.id === item.artifact.id)) continue;
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function buildArtifactRecommendations(
  artifacts: Artifact[],
  context: RecommendationContext,
  limit = DEFAULT_RECOMMENDATION_LIMIT,
): ArtifactRecommendation[] {
  const uniqueArtifacts = Array.from(new Map(artifacts.map((artifact) => [artifact.id, artifact])).values());
  const artifactsById = new Map(uniqueArtifacts.map((artifact) => [artifact.id, artifact]));
  const isColdStart = (
    context.favoriteArtifactIds.length === 0 &&
    context.viewHistoryIds.length === 0 &&
    context.searchKeywords.length === 0 &&
    context.curationKeywords.length === 0
  );

  const signals = collectSignals(artifactsById, context);
  const scored = uniqueArtifacts
    .map((artifact) => scoreArtifact(artifact, context, signals, isColdStart))
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      return normalizeText(artifactNameRaw(a.artifact)).localeCompare(normalizeText(artifactNameRaw(b.artifact)), "zh-CN");
    });

  const recommendations = selectDiverseRecommendations(scored, Math.max(1, limit));
  if (recommendations.length > 0) return recommendations;

  return uniqueArtifacts
    .slice()
    .sort((a, b) => (b.favsCount || 0) - (a.favsCount || 0))
    .slice(0, limit)
    .map((artifact) => ({
      artifact,
      recommendationScore: Math.round(((artifact.favsCount || 0) + artifactCompletenessScore(artifact)) * 10) / 10,
      reason: "馆藏热度较高，适合作为探索入口",
      reasons: ["馆藏热度较高，适合作为探索入口"],
      matchedTags: artifactTags(artifact).slice(0, 4),
    }));
}
