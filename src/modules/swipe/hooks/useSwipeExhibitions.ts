import { useMemo, useState } from "react";
import type { Exhibition } from "../../../types";
import {
  normalizeSwipeExhibitionSnapshot,
  readActedExhibitionIds,
  type SwipeRoundStats,
} from "../utils/preferenceProfile";

const DEFAULT_STATS: SwipeRoundStats = {
  interested: 0,
  dislike: 0,
  favorite: 0,
};

function hasCover(exhibition: Exhibition): boolean {
  return normalizeSwipeExhibitionSnapshot(exhibition).coverUrl.trim().length > 0;
}

function exhibitionScore(exhibition: Exhibition): number {
  const snapshot = normalizeSwipeExhibitionSnapshot(exhibition);
  let score = 0;
  if (snapshot.coverUrl) score += 5;
  if (snapshot.title) score += 2;
  if (snapshot.intro) score += 2;
  if (snapshot.artifactCount > 0) score += Math.min(snapshot.artifactCount, 8) * 0.5;
  score += Math.min(Math.log1p(exhibition.favsCount || 0), 8);
  return score;
}

export function useSwipeExhibitions(exhibitions: Exhibition[]) {
  const [roundKey, setRoundKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [actedIds, setActedIds] = useState<Set<string>>(() => readActedExhibitionIds());
  const [stats, setStats] = useState<SwipeRoundStats>(DEFAULT_STATS);

  const deck = useMemo(() => {
    const unique = Array.from(new Map(exhibitions.map((exhibition) => [exhibition.id, exhibition])).values());
    const sorted = unique
      .slice()
      .sort((a, b) => {
        const actedA = actedIds.has(a.id) ? 1 : 0;
        const actedB = actedIds.has(b.id) ? 1 : 0;
        if (actedA !== actedB) return actedA - actedB;
        const coverA = hasCover(a) ? 1 : 0;
        const coverB = hasCover(b) ? 1 : 0;
        if (coverA !== coverB) return coverB - coverA;
        return exhibitionScore(b) - exhibitionScore(a);
      });

    const preferred = sorted.filter((exhibition) => !actedIds.has(exhibition.id));
    return preferred.length > 0 ? preferred : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exhibitions, actedIds, roundKey]);

  const current = deck[index] || null;
  const isComplete = deck.length === 0 || index >= deck.length;

  const advance = (exhibitionId: string, stat?: keyof SwipeRoundStats) => {
    setActedIds((currentIds) => new Set(currentIds).add(exhibitionId));
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
    setActedIds(readActedExhibitionIds());
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
