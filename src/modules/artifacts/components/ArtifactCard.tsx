import { motion } from 'motion/react';
import { Bookmark, BookmarkCheck, Eye, Sparkles } from 'lucide-react';
import type { Artifact, ArtifactRecommendation } from '../../../types';
import { SafeImage } from '../../../components/SafeImage';
import {
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  displayDbString,
} from '../../../lib/dbDisplay';
import { cn } from '../../../lib/utils';

type ArtifactCardProps = {
  artifact: Artifact;
  onClick: () => void;
  recommendation?: Pick<ArtifactRecommendation, 'reason' | 'recommendationScore' | 'matchedTags'>;
  isFavorite?: boolean;
  onFavoriteClick?: () => void;
  onCurationClick?: () => void;
};

export const ArtifactCard = ({
  artifact,
  onClick,
  recommendation,
  isFavorite = false,
  onFavoriteClick,
  onCurationClick,
}: ArtifactCardProps) => {
  const recommendationTags = recommendation?.matchedTags?.slice(0, 3) || [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className="ios-card mb-3 cursor-pointer overflow-hidden break-inside-avoid group"
    >
      <SafeImage 
        src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? '')} 
        alt={typeof artifactNameRaw(artifact) === 'string' ? (artifactNameRaw(artifact) as string) : ''} 
        width={480}
        height={360}
        className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="space-y-1 p-3">
        <h3 className="min-w-0 break-words text-[13px] font-black leading-snug text-gray-950">{displayDbString(artifactNameRaw(artifact))}</h3>
        <p className="min-w-0 break-words text-[11px] leading-snug text-gray-500">{displayDbString(artifactMuseumRaw(artifact))}</p>
        {recommendation && (
          <>
            <p className="min-w-0 break-words text-[10px] leading-snug text-gray-400">{displayDbString(artifactEraRaw(artifact))}</p>
            <div className="rounded-[5px] bg-amber-50 px-2 py-1.5 text-[10px] font-bold leading-relaxed text-amber-800">
              {recommendation.reason}
            </div>
            {recommendationTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recommendationTags.map((tag) => (
                  <span key={tag} className="max-w-full truncate rounded-full bg-[#F6F3EE] px-2 py-0.5 text-[9px] font-bold text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="grid gap-1.5 pt-1">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClick();
                }}
                className="ios-button-small flex items-center justify-center gap-1 bg-gray-50 px-2 text-[10px] font-bold text-gray-700"
              >
                <Eye size={12} />
                查看详情
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFavoriteClick?.();
                  }}
                  disabled={!onFavoriteClick}
                  className={cn(
                    "ios-button-small flex min-w-0 items-center justify-center gap-1 px-2 text-[10px] font-bold disabled:opacity-50",
                    isFavorite ? "bg-amber-100 text-amber-700" : "bg-gray-50 text-gray-700",
                  )}
                >
                  {isFavorite ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                  {isFavorite ? "已收藏" : "收藏"}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCurationClick?.();
                  }}
                  disabled={!onCurationClick}
                  className="ios-button-small flex min-w-0 items-center justify-center gap-1 bg-primary px-2 text-[10px] font-bold text-white disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  生成展览
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
