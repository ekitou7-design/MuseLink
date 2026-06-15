import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Plus, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Artifact, Exhibition } from '../../../types';
import { SafeImage } from '../../../components/SafeImage';
import { rankArtifactsByKeywordQuery } from '../../../lib/artifactSearch';
import { artifactImageUrlRaw, artifactMuseumRaw, artifactNameRaw, displayDbString } from '../../../lib/dbDisplay';
import { cn } from '../../../lib/utils';
import { findArtifactsByIds } from '../../../shared/lib/domainUtils';
import { DEFAULT_EXHIBITION_COVER } from '../constants/covers';
import { ExhibitionCoverPicker } from './ExhibitionCoverPicker';

export const ManualExhibitionModal = ({
  isOpen,
  onClose,
  onCreate,
  artifacts,
  isCreating,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (draft: Pick<Exhibition, 'title' | 'intro' | 'coverUrl' | 'artifactIds' | 'isPublic'>) => void;
  artifacts: Artifact[];
  isCreating: boolean;
}) => {
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setIntro('');
    setCoverUrl(DEFAULT_EXHIBITION_COVER);
    setIsPublic(false);
    setSelectedIds([]);
    setSearch('');
  }, [isOpen]);

  const filtered = search.trim()
    ? rankArtifactsByKeywordQuery(artifacts, search).slice(0, 80)
    : artifacts.slice(0, 80);

  const selectedArtifacts = findArtifactsByIds(selectedIds, artifacts);
  const effectiveCoverUrl = coverUrl || DEFAULT_EXHIBITION_COVER;
  const canCreate = title.trim().length > 0 && selectedIds.length > 0 && !isCreating;

  const toggleArtifact = (id: string) => {
    setSelectedIds(prev => (
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    ));
  };

  const moveSelected = (id: string, direction: -1 | 1) => {
    setSelectedIds(prev => {
      const index = prev.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          className="fixed inset-0 z-[200] bg-white flex flex-col"
        >
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <button onClick={onClose} className="p-2 text-gray-400"><X size={20} /></button>
            <h2 className="text-lg font-serif font-bold">新建策展</h2>
            <button
              onClick={() => onCreate({
                title: title.trim(),
                intro: intro.trim(),
                coverUrl: effectiveCoverUrl,
                artifactIds: selectedIds,
                isPublic,
              })}
              disabled={!canCreate}
              className="px-4 py-1.5 bg-primary text-white rounded-full text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
            >
              {isCreating && <Loader2 size={14} className="animate-spin" />}
              保存
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
            <div className="space-y-4">
              <div className="space-y-4">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="展览标题"
                  className="w-full border-b border-gray-100 py-2 text-xl font-serif font-bold outline-none focus:border-primary"
                />
                <textarea
                  value={intro}
                  onChange={e => setIntro(e.target.value)}
                  placeholder="写下展览导言、叙事线索或观众入口"
                  className="w-full min-h-[92px] resize-none rounded-2xl bg-gray-50 p-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-primary/15"
                />
                <ExhibitionCoverPicker value={effectiveCoverUrl} onChange={setCoverUrl} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-neutral px-4 py-3 border border-gray-100">
              <div>
                <p className="text-xs font-bold text-secondary">公开到展陈广场</p>
                <p className="text-[10px] text-gray-400">关闭时仅保存在“我的策展”</p>
              </div>
              <button
                onClick={() => setIsPublic(prev => !prev)}
                className={cn("w-12 h-6 rounded-full transition-all relative", isPublic ? "bg-primary" : "bg-gray-200")}
              >
                <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", isPublic ? "right-1" : "left-1")} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">展线顺序</h3>
                <span className="text-[10px] font-bold text-primary bg-neutral px-2 py-0.5 rounded-full">{selectedIds.length} 件</span>
              </div>
              {selectedArtifacts.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {selectedArtifacts.map((artifact, index) => (
                    <div key={`manual-selected-${artifact.id}`} className="w-28 flex-shrink-0 rounded-2xl border border-gray-100 bg-white overflow-hidden">
                      <SafeImage src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")} width={112} height={112} className="aspect-square w-full object-cover bg-gray-50" />
                      <div className="p-2 space-y-2">
                        <p className="h-8 overflow-hidden text-[10px] font-bold leading-4 text-gray-800">{displayDbString(artifactNameRaw(artifact))}</p>
                        <div className="grid grid-cols-3 gap-1">
                          <button onClick={() => moveSelected(artifact.id, -1)} disabled={index === 0} className="h-7 rounded-lg bg-gray-50 text-gray-500 disabled:opacity-30 flex items-center justify-center">
                            <ArrowLeft size={12} />
                          </button>
                          <button onClick={() => toggleArtifact(artifact.id)} className="h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                            <X size={12} />
                          </button>
                          <button onClick={() => moveSelected(artifact.id, 1)} disabled={index === selectedArtifacts.length - 1} className="h-7 rounded-lg bg-gray-50 text-gray-500 disabled:opacity-30 flex items-center justify-center">
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center text-xs text-gray-400">
                  从下方馆藏中选择文物，组成你的展览动线
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索文物名称、博物馆、年代、材质"
                  className="w-full rounded-2xl bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {filtered.map(artifact => {
                  const isSelected = selectedIds.includes(artifact.id);
                  return (
                    <button
                      key={`manual-art-${artifact.id}`}
                      onClick={() => toggleArtifact(artifact.id)}
                      className={cn(
                        "relative overflow-hidden rounded-2xl border text-left transition-all",
                        isSelected ? "border-primary shadow-sm" : "border-gray-100 bg-gray-50"
                      )}
                    >
                      <SafeImage src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")} width={180} height={180} className="aspect-square w-full object-cover bg-gray-100" />
                      <div className="p-3 space-y-1">
                        <p className="h-8 overflow-hidden text-[10px] font-bold leading-4 text-gray-900">{displayDbString(artifactNameRaw(artifact))}</p>
                        <p className="h-4 overflow-hidden text-[9px] text-gray-400">{displayDbString(artifactMuseumRaw(artifact))}</p>
                      </div>
                      <div className={cn(
                        "absolute right-2 top-2 w-7 h-7 rounded-full flex items-center justify-center border transition-all",
                        isSelected ? "bg-primary text-white border-primary" : "bg-white/90 text-gray-300 border-white"
                      )}>
                        <Plus size={14} className={cn(isSelected && "rotate-45")} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
