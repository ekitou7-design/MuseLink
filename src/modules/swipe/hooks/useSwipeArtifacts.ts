import { useMemo, useState } from "react";
import type { Artifact } from "../../../types";
import {
  normalizeSwipeArtifactSnapshot,
  readActedArtifactIds,
  type SwipeRoundStats,
} from "../utils/preferenceProfile";

const DEFAULT_STATS: SwipeRoundStats = {
  interested: 0,
  dislike: 0,
  favorite: 0,
};

function hasImage(artifact: Artifact): boolean {
  return normalizeSwipeArtifactSnapshot(artifact).imageUrl.trim().length > 0;
}

function completenessScore(artifact: Artifact): number {
  const snapshot = normalizeSwipeArtifactSnapshot(artifact);
  let score = 0;
  if (snapshot.name) score += 2;
  if (snapshot.imageUrl) score += 5;
  if (snapshot.dynasty) score += 2;
  if (snapshot.category) score += 2;
  if (snapshot.museum) score += 2;
  if (snapshot.summary) score += 2;
  if (snapshot.tags.length > 0) score += 1;
  score += Math.min(Math.log1p(artifact.favsCount || 0), 8);
  return score;
}

function seededRandom(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function qualityTier(artifact: Artifact): number {
  const score = completenessScore(artifact);
  if (score >= 12) return 3;
  if (score >= 8) return 2;
  if (score >= 4) return 1;
  return 0;
}

export function useSwipeArtifacts(artifacts: Artifact[]) {
  const [roundKey, setRoundKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [actedIds, setActedIds] = useState<Set<string>>(() => readActedArtifactIds());
  const [stats, setStats] = useState<SwipeRoundStats>(DEFAULT_STATS);

  const deck = useMemo(() => {
    const unique = Array.from(new Map(artifacts.map((artifact) => [artifact.id, artifact])).values());
    const sorted = unique
      .slice()
      .sort((a, b) => {
        const actedA = actedIds.has(a.id) ? 1 : 0;
        const actedB = actedIds.has(b.id) ? 1 : 0;
        if (actedA !== actedB) return actedA - actedB;
        const imageA = hasImage(a) ? 1 : 0;
        const imageB = hasImage(b) ? 1 : 0;
        if (imageA !== imageB) return imageB - imageA;
        const tierA = qualityTier(a);
        const tierB = qualityTier(b);
        if (tierA !== tierB) return tierB - tierA;
        return seededRandom(`${roundKey}:${a.id}`) - seededRandom(`${roundKey}:${b.id}`);
      });

    const preferred = sorted.filter((artifact) => !actedIds.has(artifact.id));
    return preferred.length > 0 ? preferred : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts, actedIds, roundKey]);

  const current = deck[index] || null;
  const isComplete = deck.length === 0 || index >= deck.length;

  const advance = (artifactId: string, stat?: keyof SwipeRoundStats) => {
    setActedIds((currentIds) => new Set(currentIds).add(artifactId));
    if (stat) {
      setStats((currentStats) => ({
        ...currentStats,
        [stat]: currentStats[stat] + 1,
      }));
    }
    setIndex((currentIndex) => currentIndex + 1);
  };

  const restart = () => {
    setStats(DEFAULT_STATS);
    setIndex(0);
    setActedIds(readActedArtifactIds());
    setRoundKey((key) => key + 1);
  };

  return {
    current,
    deck,
    index,
    isComplete,
    stats,
    advance,
    restart,
  };
}
