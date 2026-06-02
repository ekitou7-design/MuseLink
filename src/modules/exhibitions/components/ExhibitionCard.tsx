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
}: {
  exhibition: Exhibition,
  onClick: () => void,
  isFavorite?: boolean,
  onFavoriteClick?: () => void,
  showFavoriteButton?: boolean,
}) => {
  const artifactCount = exhibition.artifactIds?.length ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className="ios-card mb-3 cursor-pointer overflow-hidden break-inside-avoid group"
    >
      <div className="aspect-[4/5] relative">
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
      <div className="space-y-2 p-3">
        <h3 className="min-w-0 break-words text-[13px] font-black leading-snug text-gray-950">{exhibition.title}</h3>
        <div className="flex min-w-0 items-center gap-1.5">
          {exhibition.userPhoto && (
            <SafeImage 
               src={exhibition.userPhoto} 
               className="h-4 w-4 flex-shrink-0 rounded-full" 
             />
          )}
          <span className="min-w-0 break-words text-[11px] font-medium text-gray-500">{exhibition.userName}</span>
        </div>
      </div>
    </motion.div>
  );
};
