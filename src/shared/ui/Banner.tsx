import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Library } from 'lucide-react';
import type { Artifact } from '../../types';
import { SafeImage } from '../../components/SafeImage';
import { cn } from '../../lib/utils';
import {
  DB_EMPTY_PLACEHOLDER,
  artifactDescriptionRaw,
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  displayDbString,
  isStrictDbEmpty,
} from '../../lib/dbDisplay';

const RECOMMENDATION_BANNER_LIMIT = 5;

type BannerProps = {
  artifacts: Artifact[];
  onArtifactClick?: (artifact: Artifact) => void;
};

export const Banner = ({ artifacts, onArtifactClick }: BannerProps) => {
  const [index, setIndex] = useState(0);
  const banners = useMemo(() => (
    artifacts
      .filter((artifact) => !isStrictDbEmpty(artifactNameRaw(artifact)))
      .slice(0, RECOMMENDATION_BANNER_LIMIT)
      .map((artifact) => {
        const museum = displayDbString(artifactMuseumRaw(artifact));
        const era = displayDbString(artifactEraRaw(artifact));
        const subtitle = [museum, era]
          .filter((item) => item && item !== DB_EMPTY_PLACEHOLDER)
          .join(' · ');

        return {
          artifact,
          id: artifact.id,
          title: displayDbString(artifactNameRaw(artifact)),
          subtitle: subtitle || '馆藏推荐',
          image: String(artifactImageUrlRaw(artifact) ?? ''),
          description: displayDbString(artifactDescriptionRaw(artifact)),
        };
      })
  ), [artifacts]);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) {
    return (
      <div className="relative h-[200px] rounded-[5px] overflow-hidden bg-white border border-gray-100 shadow-xl shadow-primary/10 flex flex-col items-center justify-center text-center px-6">
        <Library className="mb-3 text-gray-300" size={28} />
        <p className="text-sm font-bold text-gray-700">暂无可推荐文物</p>
        <p className="mt-1 text-[10px] text-gray-400">数据库加载后会自动显示馆藏轮播</p>
      </div>
    );
  }

  const activeBanner = banners[index] ?? banners[0];

  return (
    <button
      type="button"
      onClick={() => onArtifactClick?.(activeBanner.artifact)}
      aria-label={`查看文物详情：${activeBanner.title}`}
      className="group relative h-[200px] w-full overflow-hidden rounded-[5px] text-left shadow-xl shadow-primary/10 transition-transform active:scale-[0.99]"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeBanner.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <SafeImage 
            src={activeBanner.image} 
            alt={activeBanner.title}
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-white space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-tertiary rounded text-[8px] font-bold uppercase tracking-widest whitespace-nowrap">热门推荐</span>
              <span className="min-w-0 truncate text-[10px] opacity-80 font-medium">{activeBanner.subtitle}</span>
            </div>
            <h2 className="truncate text-2xl font-serif font-bold tracking-tight">{activeBanner.title}</h2>
            <p className="text-[10px] opacity-60 line-clamp-1">{activeBanner.description}</p>
          </div>
        </motion.div>
      </AnimatePresence>
      
      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
        {banners.map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i === index ? "w-6 bg-white" : "w-1.5 bg-white/30"
            )} 
          />
        ))}
      </div>
    </button>
  );
};
