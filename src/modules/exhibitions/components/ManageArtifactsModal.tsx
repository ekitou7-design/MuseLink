import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Artifact, Exhibition } from '../../../types';
import { rankArtifactsByKeywordQuery } from '../../../lib/artifactSearch';
import { artifactImageUrlRaw, artifactMuseumRaw, artifactNameRaw, displayDbString } from '../../../lib/dbDisplay';
import { cn } from '../../../lib/utils';
import { SafeImage } from '../../../components/SafeImage';

export const ManageArtifactsModal = ({ 
  isOpen, 
  onClose, 
  exhibition,
  onUpdateArtifacts,
  artifacts
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  exhibition: Exhibition | null,
  onUpdateArtifacts: (ids: string[]) => void,
  artifacts: Artifact[]
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (exhibition) {
      setSelectedIds(Array.isArray(exhibition.artifactIds) ? exhibition.artifactIds : []);
    }
  }, [exhibition]);

  if (!exhibition) return null;

  const filtered = search.trim()
    ? rankArtifactsByKeywordQuery(artifacts, search)
    : artifacts;

  const toggleArtifact = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          className="fixed inset-0 z-[210] bg-white flex flex-col"
        >
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <button onClick={onClose} className="p-2 text-gray-400"><ArrowLeft size={24} /></button>
            <h2 className="text-lg font-serif font-bold">管理展陈文物</h2>
            <button 
              onClick={() => {
                onUpdateArtifacts(selectedIds);
                onClose();
              }}
              className="px-4 py-1.5 bg-primary text-white rounded-full text-xs font-bold"
            >
              完成 ({selectedIds.length})
            </button>
          </div>

          <div className="p-4 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索文物名称、博物馆、文化..."
                className="w-full bg-white border-none rounded-xl py-2.5 pl-10 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              {filtered.map(artifact => {
                const isSelected = selectedIds.includes(artifact.id);
                return (
                  <div 
                    key={`manage-art-${artifact.id}`}
                    onClick={() => toggleArtifact(artifact.id)}
                    className={cn(
                      "relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group",
                      isSelected ? "border-primary shadow-md" : "border-transparent bg-gray-50 grayscale-[0.5] opacity-80"
                    )}
                  >
                    <div className="aspect-square">
                      <SafeImage
                        src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")}
                        width={180}
                        height={180}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className={cn(
                      "absolute inset-0 flex items-center justify-center transition-all",
                      isSelected ? "bg-primary/20" : "bg-transparent group-hover:bg-black/5"
                    )}>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all",
                        isSelected ? "bg-primary border-primary text-white" : "bg-white/80 border-white text-transparent"
                      )}>
                        <Plus size={14} className={cn(isSelected && "rotate-45")} />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="break-words text-[10px] font-bold text-white">{displayDbString(artifactNameRaw(artifact))}</p>
                      <p className="break-words text-[8px] text-white/70">{displayDbString(artifactMuseumRaw(artifact))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
