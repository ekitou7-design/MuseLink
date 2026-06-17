import { motion } from 'motion/react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import type { Exhibition } from '../../../types';
import { SafeImage } from '../../../components/SafeImage';
import { cn } from '../../../lib/utils';

export const ExhibitionCard = ({
  exhibition,
  onClick,
  isFavorite = false,
  onFavoriteClick,
  showFavoriteButton = false,
  variant = 'default',
}: {
  exhibition: Exhibition,
  onClick: () => void,
  isFavorite?: boolean,
  onFavoriteClick?: () => void,
  showFavoriteButton?: boolean,
  variant?: 'default' | 'masonry',
}) => {
  const artifactCount = exhibition.artifactIds?.length ?? 0;
  const seed = Array.from(exhibition.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const masonryAspects = ['4 / 5', '1 / 1.18', '3 / 4', '1 / 1.05'];
  const coverAspect = variant === 'masonry' ? masonryAspects[seed % masonryAspects.length] : '4 / 5';
  const isMasonry = variant === 'masonry';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn(
        "cursor-pointer overflow-hidden break-inside-avoid group",
        isMasonry
          ? "rounded-[8px] border border-black/5 bg-white shadow-sm"
          : "ios-card mb-3",
      )}
    >
      <div className="relative bg-gray-100" style={{ aspectRatio: coverAspect }}>
        <SafeImage 
           src={exhibition.coverUrl} 
           className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
         />
        <div className="absolute right-2 top-2 rounded-full bg-black/35 px-2 py-1 text-[9px] font-bold text-white backdrop-blur-md force-nowrap">
          {artifactCount}件
        </div>
        {showFavoriteButton && (
          <button
            type="button"
            aria-label={isFavorite ? '取消收藏展陈' : '收藏展陈'}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onFavoriteClick?.();
            }}
            className={cn(
              "absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md shadow-sm transition-all active:scale-95",
              isFavorite ? "bg-amber-800 text-white" : "bg-white/90 text-amber-800"
            )}
          >
            {isFavorite ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
        )}
      </div>
      <div className={cn("space-y-2", isMasonry ? "p-2.5" : "p-3")}>
        <h3 className={cn(
          "min-w-0 break-words font-black leading-snug text-gray-950",
          isMasonry ? "text-[12px]" : "text-[13px]",
        )}>{exhibition.title}</h3>
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {exhibition.userPhoto && (
              <SafeImage 
                 src={exhibition.userPhoto} 
                 className="h-4 w-4 flex-shrink-0 rounded-full" 
               />
            )}
            <span className="min-w-0 truncate text-[10px] font-medium text-gray-500">{exhibition.userName}</span>
          </div>
          {isMasonry && (
            <span className="shrink-0 text-[10px] font-bold text-gray-400">{exhibition.likesCount || 0}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
