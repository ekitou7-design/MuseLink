import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  LayoutGrid,
  Library,
  MessageCircle,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Artifact } from '../../../types';
import { AmbientAudioPlayer, isAmbientBgmUrl } from '../../../lib/ambientAudio';
import { rankArtifactsByKeywordQuery } from '../../../lib/artifactSearch';
import { cn } from '../../../lib/utils';
import { ArtifactCard } from '../../artifacts/components/ArtifactCard';

export const ExhibitionDetail = ({ 
  exhibition, 
  onClose, 
  onArtifactClick, 
  artifacts,
  isFavorite, 
  toggleFavorite,
  user,
  onEdit,
  onSlideshowOpen,
  onBGMGeneratorOpen
}: any) => {
  const [search, setSearch] = useState('');
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBGMPaused, setIsBGMPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<AmbientAudioPlayer | null>(null);
  const isAmbientBgm = isAmbientBgmUrl(exhibition.bgmUrl);
  const artifactIds = useMemo(
    () => Array.isArray(exhibition.artifactIds) ? exhibition.artifactIds : [],
    [exhibition.artifactIds],
  );

  const isOwner = Boolean(user && String(exhibition.userId) === String(user.id));

  const filteredArtifactIds = useMemo(() => {
    if (!search.trim()) return artifactIds;
    const items = artifactIds
      .map((id: string) => artifacts.find((art: Artifact) => art.id === id))
      .filter(Boolean) as Artifact[];
    return rankArtifactsByKeywordQuery(items, search).map((a) => a.id);
  }, [artifactIds, artifacts, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (!exhibition.bgmUrl) return;

    if (isAmbientBgm) {
      if (!ambientRef.current) ambientRef.current = new AmbientAudioPlayer();
      if (!isBGMPaused) {
        ambientRef.current.start(exhibition.bgmUrl).catch(console.error);
      } else {
        ambientRef.current.stop();
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      if (!isBGMPaused) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [exhibition.bgmUrl, isAmbientBgm, isBGMPaused]);

  useEffect(() => {
    return () => {
      ambientRef.current?.dispose();
    };
  }, []);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 bg-white z-[110] overflow-y-auto no-scrollbar flex flex-col"
    >
      {exhibition.bgmUrl && !isAmbientBgm && (
        <audio ref={audioRef} src={exhibition.bgmUrl} loop />
      )}

      {/* Header Area (Playlist Style) */}
      <div className="relative h-[45vh] flex-shrink-0">
        {exhibition.coverUrl && (
          <img src={exhibition.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        
        <div className="absolute top-6 left-0 right-0 px-4 sm:px-6 flex items-center justify-between gap-3">
          <button onClick={onClose} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white flex-shrink-0"><ArrowLeft size={20} /></button>
          <div className="min-w-0 flex items-center justify-end gap-2">
            <button 
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSlideshowOpen(exhibition);
              }}
              className="min-w-0 max-w-[calc(100vw-9.5rem)] px-3 sm:px-4 py-2 bg-white text-black backdrop-blur-md rounded-full text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-black/20 force-nowrap active:scale-95"
            >
              <Sparkles size={20} className="flex-shrink-0" />
              <span className="force-nowrap">进入沉浸展览</span>
            </button>
            <button className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white"><Share2 size={20} /></button>
            <button 
              onClick={() => {
                if (isOwner) onBGMGeneratorOpen();
              }}
              className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white"
            >
              <Music size={20} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-10 left-6 right-6 flex gap-6 items-end">
          <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border-2 border-white/20">
            {exhibition.coverUrl && (
              <img src={exhibition.coverUrl} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 text-white space-y-3">
            <h2 className="text-2xl font-bold leading-tight">{exhibition.title}</h2>
            <div className="flex items-center gap-2">
              {exhibition.userPhoto && (
                <img src={exhibition.userPhoto} className="w-6 h-6 rounded-full border border-white/20" />
              )}
              <span className="text-xs font-bold opacity-90">{exhibition.userName}</span>
              <ChevronRight size={20} className="opacity-50" />
            </div>
            <p className="break-words text-[10px] leading-relaxed opacity-70">{exhibition.intro}</p>
          </div>
        </div>
      </div>

      {/* Interaction Bar */}
      <div className="px-6 py-4 flex items-center justify-around border-b border-gray-50">
        <button className="flex flex-col items-center gap-1 text-gray-500">
          <Share2 size={20} />
          <span className="text-[10px] font-bold">转发</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-500">
          <MessageCircle size={20} />
          <span className="text-[10px] font-bold">{exhibition.commentsCount || '评论'}</span>
        </button>
        <button 
          onClick={toggleFavorite}
          className={cn("flex flex-col items-center gap-1", isFavorite ? "text-primary" : "text-gray-500")}
        >
          {isFavorite ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
          <span className="text-[10px] font-bold">{isFavorite ? '已收藏' : '收藏'}</span>
        </button>
        {isOwner && (
          <button 
            onClick={onEdit}
            className="flex flex-col items-center gap-1 text-primary"
          >
            <Settings size={20} />
            <span className="text-[10px] font-bold">编辑</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library size={20} className="text-amber-800" />
            <h4 className="text-sm font-bold text-gray-900">展陈内容 ({artifactIds.length})</h4>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMultiSelect(!isMultiSelect)}
              className={cn("p-2 rounded-xl transition-all", isMultiSelect ? "bg-amber-800 text-white" : "bg-gray-100 text-gray-500")}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索展陈内的文物..." 
            className="w-full bg-gray-50 border-none rounded-xl py-2 pl-10 pr-4 text-xs" 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {filteredArtifactIds.map((id: string) => {
            const artifact = artifacts.find((a: Artifact) => a.id === id);
            if (!artifact) return null;
            const isSelected = selectedIds.includes(id);
            return (
              <div key={`exh-detail-art-${id}`} className="relative">
                <ArtifactCard artifact={artifact} onClick={() => isMultiSelect ? toggleSelect(id) : onArtifactClick(artifact)} />
                {isMultiSelect && (
                  <div 
                    onClick={() => toggleSelect(id)}
                    className={cn(
                      "absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-10",
                      isSelected ? "bg-amber-800 border-amber-800 text-white" : "bg-white/80 border-white text-transparent"
                    )}
                  >
                    <Plus size={14} className={cn(isSelected && "rotate-45")} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {artifactIds.length === 0 && (
          <div className="py-16 text-center text-gray-300 text-xs italic">
            这个展览暂时还没有添加文物
          </div>
        )}

        {isMultiSelect && selectedIds.length > 0 && (
          <div className="fixed bottom-24 left-6 right-6 bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 flex items-center justify-between z-[120]">
            <span className="text-xs font-bold text-gray-600">已选择 {selectedIds.length} 项</span>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-bold">加入收藏</button>
              {isOwner && (
                <button className="px-4 py-2 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-bold">从展陈移除</button>
              )}
            </div>
          </div>
        )}

        {/* Floating BGM Control */}
        {exhibition.bgmUrl && (
          <motion.div 
            drag
            dragConstraints={{ left: -100, right: 100, top: -500, bottom: 0 }}
            className="fixed bottom-28 right-6 z-[120]"
          >
            <button 
              onClick={() => setIsBGMPaused(!isBGMPaused)}
              className="w-14 h-14 bg-white rounded-full shadow-2xl border border-gray-100 flex items-center justify-center text-primary relative group"
            >
              <div className={cn(
                "absolute inset-0 bg-primary/5 rounded-full animate-ping",
                isBGMPaused && "hidden"
              )} />
              {isBGMPaused ? <Play size={24} fill="currentColor" className="ml-1" /> : <Pause size={24} fill="currentColor" />}
              
              {/* Volume Indicator */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-secondary text-white text-[8px] px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity force-nowrap">
                音量 30%
              </div>
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
