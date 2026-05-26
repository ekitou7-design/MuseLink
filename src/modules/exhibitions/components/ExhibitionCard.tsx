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
      className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer group break-inside-avoid mb-1.5"
    >
      <div className="aspect-[4/5] relative">
        <SafeImage 
           src={exhibition.coverUrl} 
           className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
         />
        <div className="absolute top-1.5 right-1.5 px-1 py-0.5 bg-black/30 backdrop-blur-sm text-white text-[7px] font-bold rounded force-nowrap">
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
              "absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full backdrop-blur-md shadow-sm flex items-center justify-center transition-all active:scale-95",
              isFavorite ? "bg-amber-800 text-white" : "bg-white/90 text-amber-800"
            )}
          >
            {isFavorite ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
        )}
      </div>
      <div className="p-1.5 space-y-1">
        <h3 className="min-w-0 break-words font-serif font-bold text-[11px] text-gray-900">{exhibition.title}</h3>
        <div className="flex min-w-0 items-center gap-1">
          {exhibition.userPhoto && (
            <SafeImage 
               src={exhibition.userPhoto} 
               className="h-3 w-3 flex-shrink-0 rounded-full" 
             />
          )}
          <span className="min-w-0 break-words text-[9px] font-medium text-gray-500">{exhibition.userName}</span>
        </div>
      </div>
    </motion.div>
  );
};
