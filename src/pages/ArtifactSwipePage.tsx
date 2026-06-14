import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bookmark, BookmarkCheck, Heart, Library, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Artifact, Exhibition } from "../types";
import { cn } from "../lib/utils";
import { SwipeArtifactCard } from "../modules/swipe/components/SwipeArtifactCard";
import { SwipeExhibitionCard } from "../modules/swipe/components/SwipeExhibitionCard";
import { SwipeSummaryPanel } from "../modules/swipe/components/SwipeSummaryPanel";
import { useSwipeArtifacts } from "../modules/swipe/hooks/useSwipeArtifacts";
import { useSwipeExhibitions } from "../modules/swipe/hooks/useSwipeExhibitions";
import {
  recordArtifactSwipeAction,
  recordExhibitionSwipeAction,
  type UserPreferenceProfile,
} from "../modules/swipe/utils/preferenceProfile";

type SwipeMode = "artifact" | "exhibition";

type ArtifactSwipePageProps = {
  artifacts: Artifact[];
  exhibitions: Exhibition[];
  favoriteArtifactIds: string[];
  favoriteExhibitionIds: string[];
  preferenceProfile: UserPreferenceProfile;
  onToggleArtifactFavorite: (id: string) => void | Promise<void>;
  onToggleExhibitionFavorite: (id: string) => void | Promise<void>;
  onOpenArtifact: (artifact: Artifact) => void;
  onOpenExhibition: (exhibition: Exhibition) => void;
  onViewArtifactFavorites: () => void;
  onViewExhibitionFavorites: () => void;
  onBackToExplore: () => void;
};

export function ArtifactSwipePage({
  artifacts,
  exhibitions,
  favoriteArtifactIds,
  favoriteExhibitionIds,
  preferenceProfile,
  onToggleArtifactFavorite,
  onToggleExhibitionFavorite,
  onOpenArtifact,
  onOpenExhibition,
  onViewArtifactFavorites,
  onViewExhibitionFavorites,
  onBackToExplore,
}: ArtifactSwipePageProps) {
  const [mode, setMode] = useState<SwipeMode>("artifact");
  const artifactSwipe = useSwipeArtifacts(artifacts);
  const publicExhibitions = useMemo(() => exhibitions.filter((exhibition) => exhibition.isPublic), [exhibitions]);
  const exhibitionSwipe = useSwipeExhibitions(publicExhibitions);
  const isArtifactMode = mode === "artifact";
  const artifact = artifactSwipe.current;
  const exhibition = exhibitionSwipe.current;
  const isArtifactFavorite = Boolean(artifact && favoriteArtifactIds.includes(artifact.id));
  const isExhibitionFavorite = Boolean(exhibition && favoriteExhibitionIds.includes(exhibition.id));

  const handleArtifactSwipe = (action: "interested" | "dislike") => {
    if (!artifact) return;
    recordArtifactSwipeAction(artifact, action);
    artifactSwipe.advance(artifact.id, action);
  };

  const handleExhibitionSwipe = (action: "interested" | "dislike") => {
    if (!exhibition) return;
    recordExhibitionSwipeAction(exhibition, action);
    exhibitionSwipe.advance(exhibition.id, action);
  };

  const handleArtifactFavorite = async () => {
    if (!artifact) return;
    recordArtifactSwipeAction(artifact, "favorite");
    if (!isArtifactFavorite) {
      await onToggleArtifactFavorite(artifact.id);
    }
    artifactSwipe.advance(artifact.id, "favorite");
  };

  const handleExhibitionFavorite = async () => {
    if (!exhibition) return;
    recordExhibitionSwipeAction(exhibition, "favorite");
    if (!isExhibitionFavorite) {
      await onToggleExhibitionFavorite(exhibition.id);
    }
    exhibitionSwipe.advance(exhibition.id, "favorite");
  };

  const handleArtifactDetail = () => {
    if (!artifact) return;
    recordArtifactSwipeAction(artifact, "view_detail");
    onOpenArtifact(artifact);
  };

  const handleExhibitionDetail = () => {
    if (!exhibition) return;
    recordExhibitionSwipeAction(exhibition, "view_detail");
    onOpenExhibition(exhibition);
  };

  const isComplete = isArtifactMode ? artifactSwipe.isComplete : exhibitionSwipe.isComplete;
  const activeStats = isArtifactMode ? artifactSwipe.stats : exhibitionSwipe.stats;

  return (
    <div className="flex min-h-full flex-col bg-[#F6F3EE]">
      <div className="sticky top-[60px] z-40 border-b border-black/5 bg-[var(--app-bar-bg)] px-5 py-3 backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={onBackToExplore}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm active:scale-95"
                aria-label="返回探索"
              >
                <ArrowLeft size={17} />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Swipe</p>
                <h1 className="break-words text-xl font-black leading-tight text-gray-950">刷一刷，让推荐更懂你</h1>
              </div>
            </div>
            <span className="flex-shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-primary shadow-sm">
              {isArtifactMode ? `${artifactSwipe.index}/${artifactSwipe.deck.length}` : `${exhibitionSwipe.index}/${exhibitionSwipe.deck.length}`}
            </span>
          </div>

          <div className="ios-segment-tabs grid w-full grid-cols-2">
            {[
              { id: "artifact" as const, label: "文物", icon: Sparkles },
              { id: "exhibition" as const, label: "展陈", icon: Library },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1 rounded-full text-xs font-black transition-all",
                  mode === tab.id ? "bg-white text-gray-950 shadow-sm" : "text-gray-500",
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-4 py-5">
        <AnimatePresence mode="wait">
          {isComplete ? (
            <motion.div
              key={`${mode}-summary`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              <SwipeSummaryPanel
                mode={mode}
                stats={activeStats}
                profile={preferenceProfile}
                onRestart={isArtifactMode ? artifactSwipe.restart : exhibitionSwipe.restart}
                onViewFavorites={isArtifactMode ? onViewArtifactFavorites : onViewExhibitionFavorites}
              />
            </motion.div>
          ) : isArtifactMode && artifact ? (
            <motion.div
              key={`artifact-${artifact.id}`}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
            >
              <SwipeArtifactCard artifact={artifact} onSwipe={handleArtifactSwipe} onOpenDetail={handleArtifactDetail} />
            </motion.div>
          ) : !isArtifactMode && exhibition ? (
            <motion.div
              key={`exhibition-${exhibition.id}`}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
            >
              <SwipeExhibitionCard exhibition={exhibition} onSwipe={handleExhibitionSwipe} onOpenDetail={handleExhibitionDetail} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-[420px] rounded-[8px] bg-white p-8 text-center shadow-sm"
            >
              <p className="text-sm font-bold text-gray-500">暂无可刷内容</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isComplete && (
        <div className="sticky bottom-0 z-30 px-5 pb-4">
          <div className="mx-auto grid max-w-[420px] grid-cols-3 gap-3 rounded-full bg-white/82 p-2 shadow-xl shadow-stone-900/12 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => (isArtifactMode ? handleArtifactSwipe("dislike") : handleExhibitionSwipe("dislike"))}
              className="flex h-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 shadow-sm active:scale-95"
              aria-label="不感兴趣"
            >
              <X size={22} />
            </button>
            <button
              type="button"
              onClick={isArtifactMode ? handleArtifactFavorite : handleExhibitionFavorite}
              className="flex h-14 items-center justify-center rounded-full bg-amber-50 text-amber-800 shadow-sm active:scale-95"
              aria-label="收藏"
            >
              {(isArtifactMode ? isArtifactFavorite : isExhibitionFavorite) ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
            </button>
            <button
              type="button"
              onClick={() => (isArtifactMode ? handleArtifactSwipe("interested") : handleExhibitionSwipe("interested"))}
              className="flex h-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-sm active:scale-95"
              aria-label="感兴趣"
            >
              <Heart size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
