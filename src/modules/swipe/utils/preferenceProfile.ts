import type { Artifact, Exhibition } from "../../../types";
import {
  artifactCategoryRaw,
  artifactDescriptionRaw,
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  displayDbString,
  isStrictDbEmpty,
} from "../../../lib/dbDisplay";

export const SWIPE_HISTORY_KEY = "muselink_swipe_history";
export const USER_PREFERENCE_PROFILE_KEY = "muselink_user_preference_profile";
export const PREFERENCE_PROFILE_UPDATED_EVENT = "muselink:preference-profile-updated";

const MAX_HISTORY_ITEMS = 500;

export type SwipeItemType = "artifact" | "exhibition";
export type SwipeAction = "interested" | "dislike" | "favorite" | "view_detail";

export type SwipeArtifactSnapshot = {
  id: string;
  name: string;
  imageUrl: string;
  dynasty: string;
  category: string;
  museum: string;
  summary: string;
  tags: string[];
};

export type SwipeExhibitionSnapshot = {
  id: string;
  title: string;
  coverUrl: string;
  curatorName: string;
  intro: string;
  artifactIds: string[];
  artifactCount: number;
  isPublic: boolean;
};

export type SwipeHistoryEntry = {
  itemType: SwipeItemType;
  artifactId?: string;
  exhibitionId?: string;
  action: SwipeAction;
  timestamp: string;
  artifact?: SwipeArtifactSnapshot;
  exhibition?: SwipeExhibitionSnapshot;
};

export type UserPreferenceProfile = {
  dynastyScores: Record<string, number>;
  categoryScores: Record<string, number>;
  tagScores: Record<string, number>;
  museumScores: Record<string, number>;
};

export type SwipeRoundStats = {
  interested: number;
  dislike: number;
  favorite: number;
};

const ACTION_WEIGHTS: Record<SwipeAction, number> = {
  dislike: -2,
  interested: 2,
  favorite: 4,
  view_detail: 1,
};

function cleanText(value: unknown): string {
  const text = displayDbString(value).trim();
  return text === "暂无信息" ? "" : text;
}

function firstPresent(...values: unknown[]): string {
  for (const value of values) {
    if (!isStrictDbEmpty(value)) return cleanText(value);
  }
  return "";
}

function tagText(tag: Artifact["tags"][number]): string {
  if (typeof tag === "string") return tag.trim();
  return [tag.type, tag.name].filter(Boolean).join(" ").trim();
}

function addScore(scores: Record<string, number>, key: string, weight: number) {
  const normalized = key.trim();
  if (!normalized) return;
  scores[normalized] = Math.round(((scores[normalized] || 0) + weight) * 100) / 100;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function normalizeSwipeArtifactSnapshot(artifact: Artifact): SwipeArtifactSnapshot {
  const source = artifact as unknown as Record<string, unknown>;
  const shortIntro = firstPresent(source.shortIntro, source.short_intro, source["一句话简介"], source.summary);
  const description = cleanText(artifactDescriptionRaw(artifact));
  return {
    id: String(artifact.id),
    name: cleanText(artifactNameRaw(artifact)),
    imageUrl: cleanText(artifactImageUrlRaw(artifact, "full")),
    dynasty: cleanText(artifactEraRaw(artifact)),
    category: cleanText(artifactCategoryRaw(artifact)),
    museum: cleanText(artifactMuseumRaw(artifact)),
    summary: shortIntro || description,
    tags: (artifact.tags || []).map(tagText).filter(Boolean),
  };
}

export function normalizeSwipeExhibitionSnapshot(exhibition: Exhibition): SwipeExhibitionSnapshot {
  return {
    id: String(exhibition.id),
    title: String(exhibition.title || "未命名展陈"),
    coverUrl: String(exhibition.coverUrl || ""),
    curatorName: String(exhibition.userName || "博悟用户"),
    intro: String(exhibition.intro || exhibition.exhibitionIntro || ""),
    artifactIds: Array.isArray(exhibition.artifactIds) ? exhibition.artifactIds.map(String) : [],
    artifactCount: Array.isArray(exhibition.artifactIds) ? exhibition.artifactIds.length : 0,
    isPublic: Boolean(exhibition.isPublic),
  };
}

export function readSwipeHistory(): SwipeHistoryEntry[] {
  const parsed = readJson<unknown>(SWIPE_HISTORY_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is SwipeHistoryEntry => {
    if (!item || typeof item !== "object") return false;
    const record = item as SwipeHistoryEntry;
    return (
      (record.itemType === "artifact" || record.itemType === "exhibition") &&
      Boolean(record.action) &&
      Boolean(record.timestamp)
    );
  });
}

export function buildPreferenceProfile(history: SwipeHistoryEntry[]): UserPreferenceProfile {
  const profile: UserPreferenceProfile = {
    dynastyScores: {},
    categoryScores: {},
    tagScores: {},
    museumScores: {},
  };

  history.forEach((entry) => {
    if (entry.itemType !== "artifact" || !entry.artifact) return;
    const weight = ACTION_WEIGHTS[entry.action] || 0;
    if (!weight) return;
    addScore(profile.dynastyScores, entry.artifact.dynasty, weight);
    addScore(profile.categoryScores, entry.artifact.category, weight);
    addScore(profile.museumScores, entry.artifact.museum, weight);
    entry.artifact.tags.forEach((tag) => addScore(profile.tagScores, tag, weight));
  });

  return profile;
}

export function readPreferenceProfile(): UserPreferenceProfile {
  const stored = readJson<UserPreferenceProfile | null>(USER_PREFERENCE_PROFILE_KEY, null);
  if (stored && typeof stored === "object") {
    return {
      dynastyScores: stored.dynastyScores || {},
      categoryScores: stored.categoryScores || {},
      tagScores: stored.tagScores || {},
      museumScores: stored.museumScores || {},
    };
  }
  return buildPreferenceProfile(readSwipeHistory());
}

export function writePreferenceProfile(profile: UserPreferenceProfile) {
  writeJson(USER_PREFERENCE_PROFILE_KEY, profile);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PREFERENCE_PROFILE_UPDATED_EVENT, { detail: profile }));
  }
}

export function appendSwipeHistoryEntry(entry: SwipeHistoryEntry): UserPreferenceProfile {
  const nextHistory = [...readSwipeHistory(), entry].slice(-MAX_HISTORY_ITEMS);
  writeJson(SWIPE_HISTORY_KEY, nextHistory);
  const profile = buildPreferenceProfile(nextHistory);
  writePreferenceProfile(profile);
  return profile;
}

export function recordArtifactSwipeAction(artifact: Artifact, action: SwipeAction): UserPreferenceProfile {
  return appendSwipeHistoryEntry({
    itemType: "artifact",
    artifactId: artifact.id,
    action,
    timestamp: new Date().toISOString(),
    artifact: normalizeSwipeArtifactSnapshot(artifact),
  });
}

export function recordExhibitionSwipeAction(exhibition: Exhibition, action: SwipeAction): UserPreferenceProfile {
  return appendSwipeHistoryEntry({
    itemType: "exhibition",
    exhibitionId: exhibition.id,
    action,
    timestamp: new Date().toISOString(),
    exhibition: normalizeSwipeExhibitionSnapshot(exhibition),
  });
}

export function readDislikedArtifactIds(): Set<string> {
  return new Set(
    readSwipeHistory()
      .filter((entry) => entry.itemType === "artifact" && entry.action === "dislike" && entry.artifactId)
      .map((entry) => String(entry.artifactId)),
  );
}

export function readActedArtifactIds(): Set<string> {
  return new Set(
    readSwipeHistory()
      .filter((entry) => entry.itemType === "artifact" && entry.action !== "view_detail" && entry.artifactId)
      .map((entry) => String(entry.artifactId)),
  );
}

export function readActedExhibitionIds(): Set<string> {
  return new Set(
    readSwipeHistory()
      .filter((entry) => entry.itemType === "exhibition" && entry.action !== "view_detail" && entry.exhibitionId)
      .map((entry) => String(entry.exhibitionId)),
  );
}

export function topPositiveKey(scores: Record<string, number>): string {
  return Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))[0]?.[0] || "";
}
